import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SendBody {
  phone?: string;
  key?: string;
  message?: string;
  clientId?: string | null;
  taskId?: string | null;
}

export async function POST(req: Request) {
  let body: SendBody;
  try {
    body = (await req.json()) as SendBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const { phone, key, message, clientId = null, taskId = null } = body;
  if (!phone || !key || !message) {
    await logNotification(clientId, taskId, message ?? '', 'failed');
    return NextResponse.json(
      { ok: false, error: 'missing_fields' },
      { status: 400 },
    );
  }

  const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(
    phone,
  )}&text=${encodeURIComponent(message)}&apikey=${encodeURIComponent(key)}`;

  let ok = false;
  let detail = '';
  try {
    const res = await fetch(url, { method: 'GET' });
    detail = await res.text();
    // CallMeBot returns 200 with HTML on success and on rate-limit. We treat
    // HTTP 2xx as success unless the body explicitly says otherwise.
    ok = res.ok && !/error|fail|invalid/i.test(detail);
  } catch (err) {
    console.error('[whatsapp] fetch failed', err);
    ok = false;
  }

  await logNotification(clientId, taskId, message, ok ? 'sent' : 'failed');

  return NextResponse.json({ ok, detail: detail.slice(0, 500) });
}

async function logNotification(
  client_id: string | null,
  task_id: string | null,
  message: string,
  status: 'sent' | 'failed',
): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  if (!supabaseUrl || !supabaseKey) return;
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });
  const { error } = await supabase.from('notifications').insert({
    client_id,
    task_id,
    message,
    channel: 'whatsapp',
    status,
  });
  if (error) console.error('[whatsapp] log failed', error);
}
