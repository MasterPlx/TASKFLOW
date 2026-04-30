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
  reminder_attempts: number | null;
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

const MAX_ATTEMPTS = 5; // After 5 failures, give up so we don't loop forever

export async function POST(req: Request) {
  return handleRequest(req);
}

export async function GET(req: Request) {
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

  // ── Fetch candidate tasks ─────────────────────────────────────────────
  const { data: tasksRaw, error: tasksErr } = await supabase
    .from('tasks')
    .select(
      'id, client_id, title, due_date, priority, reminder_offset_minutes, reminder_sent_at, reminder_attempts',
    )
    .not('due_date', 'is', null)
    .not('reminder_offset_minutes', 'is', null)
    .is('reminder_sent_at', null)
    .neq('status', 'concluída');
  if (tasksErr) {
    return NextResponse.json({ ok: false, error: tasksErr.message }, { status: 500 });
  }

  const tasks = (tasksRaw ?? []) as TaskRow[];
  const now = Date.now();

  // Filter to "due_date - offset <= now"
  // due_date is a DATE; treat the deadline as 23:59 LOCAL of that day so
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

  // ── Fetch clients + settings (fail loudly if either query fails) ──────
  const clientIds = Array.from(
    new Set(dueByOffset.map((t) => t.client_id).filter((x): x is string => Boolean(x))),
  );

  const [clientsResult, settingsResult] = await Promise.all([
    clientIds.length > 0
      ? supabase
          .from('clients')
          .select('id, name, brand_name, phone, callmebot_key')
          .in('id', clientIds)
      : Promise.resolve({ data: [] as ClientRow[], error: null }),
    supabase
      .from('app_settings')
      .select('admin_name, admin_phone, admin_callmebot_key')
      .eq('id', 'global')
      .maybeSingle(),
  ]);

  if (clientsResult.error || settingsResult.error) {
    console.error('[cron/reminders] supabase fetch failed', {
      clientsErr: clientsResult.error,
      settingsErr: settingsResult.error,
    });
    return NextResponse.json(
      {
        ok: false,
        error: 'supabase_fetch_failed',
        detail: clientsResult.error?.message ?? settingsResult.error?.message,
      },
      { status: 500 },
    );
  }

  const clients = (clientsResult.data ?? []) as ClientRow[];
  const settings = (settingsResult.data ?? null) as SettingsRow | null;
  const clientMap = new Map<string, ClientRow>(clients.map((c) => [c.id, c]));

  const adminRecipient =
    settings?.admin_phone && settings.admin_callmebot_key
      ? {
          phone: settings.admin_phone,
          key: settings.admin_callmebot_key,
          name: settings.admin_name ?? 'Admin',
        }
      : null;

  // ── Process each task ────────────────────────────────────────────────
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let givenUp = 0;

  for (const task of dueByOffset) {
    const attempts = task.reminder_attempts ?? 0;

    // No admin configured → log a SYSTEM error (client_id=null so it doesn't
    // leak into the client's portal view) and DO NOT consume retry budget.
    // Once the admin configures their WhatsApp, the next cron tick will send.
    if (!adminRecipient) {
      const { error: insErr } = await supabase.from('notifications').insert({
        client_id: null, // system-level error, not client-facing
        task_id: task.id,
        message: `⚠️ Lembrete pendente: configure seu WhatsApp em /admin/configuracoes. Tarefa: ${task.title}`,
        channel: 'whatsapp',
        status: 'failed',
      });
      if (insErr) console.error('[cron] notification insert failed', insErr);
      skipped++;
      continue;
    }

    // Build message
    const dateStr = task.due_date
      ? new Date(`${task.due_date}T12:00:00`).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: 'short',
        })
      : 'em breve';

    const clientName = task.client_id
      ? (() => {
          const c = clientMap.get(task.client_id);
          return c ? c.brand_name ?? c.name : null;
        })()
      : null;

    const clientLine = clientName ? `Cliente: ${clientName}\n` : '';
    const message = `🔔 Lembrete: ${task.title}\n${clientLine}Prazo: ${dateStr}\nPrioridade: ${task.priority}`;

    // Call CallMeBot — whitelist success keywords (more robust than blacklist)
    const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(
      adminRecipient.phone,
    )}&text=${encodeURIComponent(message)}&apikey=${encodeURIComponent(adminRecipient.key)}`;

    let ok = false;
    let detail = '';
    try {
      const res = await fetch(url, { method: 'GET' });
      detail = await res.text();
      // Whitelist: only consider success if CallMeBot says so explicitly
      ok =
        res.ok &&
        /message\s+(queued|sent|will\s+be\s+sent)|messages\s+using\s+the\s+api/i.test(detail);
    } catch (err) {
      console.error('[cron/reminders] fetch failed', err);
    }

    if (ok) {
      const { error: updErr } = await supabase
        .from('tasks')
        .update({
          reminder_sent_at: new Date().toISOString(),
          reminder_attempts: attempts + 1,
        })
        .eq('id', task.id);
      if (updErr) console.error('[cron] task update failed', updErr);
      const { error: notifErr } = await supabase.from('notifications').insert({
        client_id: task.client_id,
        task_id: task.id,
        message,
        channel: 'whatsapp',
        status: 'sent',
      });
      if (notifErr) console.error('[cron] sent-notification insert failed', notifErr);
      sent++;
    } else {
      // Failed — log it (system-level, client_id=null so client doesn't see),
      // increment attempts, give up after MAX
      const { error: notifErr } = await supabase.from('notifications').insert({
        client_id: null, // failure log = system-side, not client-visible
        task_id: task.id,
        message: `❌ Falha no envio (tentativa ${attempts + 1}/${MAX_ATTEMPTS}): ${message}`,
        channel: 'whatsapp',
        status: 'failed',
      });
      if (notifErr) console.error('[cron] failed-notification insert failed', notifErr);
      if (attempts + 1 >= MAX_ATTEMPTS) {
        const { error: gErr } = await supabase
          .from('tasks')
          .update({
            reminder_sent_at: new Date().toISOString(),
            reminder_attempts: attempts + 1,
          })
          .eq('id', task.id);
        if (gErr) console.error('[cron] given-up update failed', gErr);
        givenUp++;
      } else {
        const { error: aErr } = await supabase
          .from('tasks')
          .update({ reminder_attempts: attempts + 1 })
          .eq('id', task.id);
        if (aErr) console.error('[cron] attempt-increment failed', aErr);
        failed++;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    processed: dueByOffset.length,
    sent,
    failed,
    skipped,
    givenUp,
  });
}
