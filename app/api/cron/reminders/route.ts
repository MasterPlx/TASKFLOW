import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface TaskRow {
  id: string;
  client_id: string | null;
  title: string;
  due_date: string | null;
  priority: string;
  reminder_offset_minutes: number | null;
  reminder_sent_at: string | null;
}

interface ClientRow {
  id: string;
  name: string;
  brand_name: string | null;
  phone: string | null;
  callmebot_key: string | null;
}

interface SettingsRow {
  admin_name: string | null;
  admin_phone: string | null;
  admin_callmebot_key: string | null;
}

/**
 * Cron endpoint — call from VPS crontab once per minute.
 * Checks tasks whose deadline minus offset has passed and that haven't been
 * notified yet, then sends the WhatsApp reminder + marks reminder_sent_at.
 *
 * Auth: header `Authorization: Bearer <CRON_SECRET>`
 */
export async function POST(req: Request) {
  return handleRequest(req);
}

export async function GET(req: Request) {
  // Allow GET so a simple `curl` from cron works without -X POST
  return handleRequest(req);
}

async function handleRequest(req: Request): Promise<Response> {
  // ── Auth ────────────────────────────────────────────────────────────────
  const expected = process.env.CRON_SECRET ?? '';
  const authHeader = req.headers.get('authorization') ?? '';
  const provided = authHeader.replace(/^Bearer\s+/i, '');
  if (!expected) {
    return NextResponse.json({ ok: false, error: 'cron_secret_not_set' }, { status: 500 });
  }
  if (provided !== expected) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ ok: false, error: 'supabase_not_configured' }, { status: 500 });
  }
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  // ── Fetch candidates ───────────────────────────────────────────────────
  // Tasks with reminder configured, not yet sent, not done.
  const { data: tasksRaw, error: tasksErr } = await supabase
    .from('tasks')
    .select('id, client_id, title, due_date, priority, reminder_offset_minutes, reminder_sent_at')
    .not('due_date', 'is', null)
    .not('reminder_offset_minutes', 'is', null)
    .is('reminder_sent_at', null)
    .neq('status', 'concluída');
  if (tasksErr) {
    return NextResponse.json({ ok: false, error: tasksErr.message }, { status: 500 });
  }

  const tasks = (tasksRaw ?? []) as TaskRow[];
  const now = Date.now();

  // Filter by "due_date - offset <= now"
  // due_date is a DATE (no time). Treat the deadline as 23:59 of that day so
  // "1 day before" sends in the morning of the day before, not 24h sharp.
  const dueByOffset = tasks.filter((t) => {
    if (!t.due_date || t.reminder_offset_minutes === null) return false;
    const deadline = new Date(`${t.due_date}T23:59:59`);
    const fireAt = deadline.getTime() - t.reminder_offset_minutes * 60_000;
    return fireAt <= now;
  });

  if (dueByOffset.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, sent: 0 });
  }

  // ── Fetch related clients + settings in parallel ───────────────────────
  const clientIds = Array.from(
    new Set(dueByOffset.map((t) => t.client_id).filter((x): x is string => Boolean(x))),
  );

  const [{ data: clientsRaw }, { data: settingsRaw }] = await Promise.all([
    clientIds.length > 0
      ? supabase
          .from('clients')
          .select('id, name, brand_name, phone, callmebot_key')
          .in('id', clientIds)
      : Promise.resolve({ data: [] as ClientRow[] }),
    supabase
      .from('app_settings')
      .select('admin_name, admin_phone, admin_callmebot_key')
      .eq('id', 'global')
      .maybeSingle(),
  ]);

  const clients = (clientsRaw ?? []) as ClientRow[];
  const settings = (settingsRaw ?? null) as SettingsRow | null;
  const clientMap = new Map<string, ClientRow>(clients.map((c) => [c.id, c]));

  // ── Send + mark ────────────────────────────────────────────────────────
  // Reminders ALWAYS go to the admin (the agency operator), with the client
  // name included in the message so they know which account it's about.
  let sent = 0;
  let skipped = 0;

  const adminRecipient =
    settings?.admin_phone && settings.admin_callmebot_key
      ? {
          phone: settings.admin_phone,
          key: settings.admin_callmebot_key,
          name: settings.admin_name ?? 'Admin',
        }
      : null;

  for (const task of dueByOffset) {
    if (!adminRecipient) {
      skipped++;
      // No admin configured — still mark as sent so we don't loop forever
      await supabase
        .from('tasks')
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq('id', task.id);
      continue;
    }

    const recipient = adminRecipient;

    const dateStr = task.due_date
      ? new Date(`${task.due_date}T00:00:00`).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: 'short',
        })
      : 'em breve';

    // Include client name so admin knows which account
    const clientName = task.client_id
      ? (() => {
          const c = clientMap.get(task.client_id);
          return c ? c.brand_name ?? c.name : null;
        })()
      : null;

    const clientLine = clientName ? `Cliente: ${clientName}\n` : '';
    const message = `🔔 Lembrete: ${task.title}\n${clientLine}Prazo: ${dateStr}\nPrioridade: ${task.priority}`;

    const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(
      recipient.phone,
    )}&text=${encodeURIComponent(message)}&apikey=${encodeURIComponent(recipient.key)}`;

    let ok = false;
    try {
      const res = await fetch(url, { method: 'GET' });
      const body = await res.text();
      ok = res.ok && !/error|fail|invalid/i.test(body);
    } catch (err) {
      console.error('[cron/reminders] fetch failed', err);
    }

    // Always mark sent_at (success or fail) to avoid spamming.
    await supabase
      .from('tasks')
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq('id', task.id);

    // Log to notifications table
    await supabase.from('notifications').insert({
      client_id: task.client_id,
      task_id: task.id,
      message,
      channel: 'whatsapp',
      status: ok ? 'sent' : 'failed',
    });

    if (ok) sent++;
    else skipped++;
  }

  return NextResponse.json({
    ok: true,
    processed: dueByOffset.length,
    sent,
    skipped,
  });
}
