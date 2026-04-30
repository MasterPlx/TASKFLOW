// Phase 5+: real implementation calling /api/whatsapp.
// Templates come from app_settings (configurable in /admin/configuracoes).

import type { AppSettings, Client, Task } from './types';
import { formatDate, PRIORITY_LABEL } from './utils';
import { getAppSettings } from './supabase';
import { render } from './templates';

interface SendArgs {
  phone: string;
  key: string;
  message: string;
  clientId?: string | null;
  taskId?: string | null;
}

// Cache settings for the session — they don't change frequently and we don't
// want to fetch on every notification.
let settingsCache: AppSettings | null = null;
let settingsPromise: Promise<AppSettings | null> | null = null;

async function loadSettings(): Promise<AppSettings | null> {
  if (settingsCache) return settingsCache;
  if (!settingsPromise) {
    settingsPromise = getAppSettings()
      .then((s) => {
        settingsCache = s;
        return s;
      })
      .catch(() => null);
  }
  return settingsPromise;
}

export function invalidateSettingsCache(): void {
  settingsCache = null;
  settingsPromise = null;
}

async function sendViaApi(args: SendArgs): Promise<boolean> {
  try {
    const res = await fetch('/api/whatsapp', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(args),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { ok: boolean };
    return Boolean(data.ok);
  } catch (err) {
    console.error('[notifications] api call failed', err);
    return false;
  }
}

const FALLBACKS = {
  task_created: 'Nova tarefa: {{title}}\nPrazo: {{due}}\nPrioridade: {{priority}}',
  task_completed: 'Tarefa concluída: {{title}} ✓',
  reminder: 'Olá {{name}}! Você tem {{count}} tarefa(s) pendente(s):',
};

export async function notifyTaskCreatedByAdmin(client: Client, task: Task): Promise<void> {
  if (!client.phone || !client.callmebot_key) return;
  const settings = await loadSettings();
  // The admin-creates flow uses the same task_created_template but enriches
  // with prazo + prioridade in case the template only includes {{title}}.
  const template = settings?.task_created_template || FALLBACKS.task_created;
  const baseLine = render(template, { title: task.title });
  const message =
    baseLine +
    `\nPrazo: ${formatDate(task.due_date)}\nPrioridade: ${PRIORITY_LABEL[task.priority]}`;
  await sendViaApi({
    phone: client.phone,
    key: client.callmebot_key,
    message,
    clientId: client.id,
    taskId: task.id,
  });
}

export async function notifyTaskCreatedByClient(client: Client, task: Task): Promise<void> {
  if (!client.phone || !client.callmebot_key) return;
  const settings = await loadSettings();
  const template = settings?.task_created_template || FALLBACKS.task_created;
  const message = render(template, { title: task.title });
  await sendViaApi({
    phone: client.phone,
    key: client.callmebot_key,
    message: `Você criou: ${task.title}\n${message}`,
    clientId: client.id,
    taskId: task.id,
  });
}

export async function notifyTaskCompletedByClient(client: Client, task: Task): Promise<void> {
  if (!client.phone || !client.callmebot_key) return;
  const settings = await loadSettings();
  const template = settings?.task_completed_template || FALLBACKS.task_completed;
  await sendViaApi({
    phone: client.phone,
    key: client.callmebot_key,
    message: render(template, { title: task.title }),
    clientId: client.id,
    taskId: task.id,
  });
}

export async function sendReminder(client: Client, pendingTasks: Task[]): Promise<void> {
  if (!client.phone || !client.callmebot_key) return;
  const settings = await loadSettings();
  const name = client.brand_name ?? client.name;
  const template = settings?.reminder_template || FALLBACKS.reminder;
  const header = render(template, { name, count: pendingTasks.length });
  const lines = pendingTasks
    .slice(0, 10)
    .map((t) => `• ${t.title}${t.due_date ? ` (${formatDate(t.due_date)})` : ''}`)
    .join('\n');
  await sendViaApi({
    phone: client.phone,
    key: client.callmebot_key,
    message: `${header}\n${lines}`,
    clientId: client.id,
    taskId: null,
  });
}
