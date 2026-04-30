// Phase 5+: real implementation calling /api/whatsapp.
// Templates come from app_settings (configurable in /admin/configuracoes).

import type { AppSettings, Client, Task } from './types';
import { formatDate, PRIORITY_LABEL } from './utils';
import { getAppSettings } from './supabase';
import { render } from './templates';
import { getAdminRecipient, isNotifiableClient } from './domain';

interface SendArgs {
  phone: string;
  key: string;
  message: string;
  clientId?: string | null;
  taskId?: string | null;
}

// Cache settings per session — but only cache successful loads, so transient
// network errors don't lock us into a bad state for the rest of the page.
let settingsCache: AppSettings | null = null;
let settingsLoadingPromise: Promise<AppSettings | null> | null = null;

async function loadSettings(): Promise<AppSettings | null> {
  if (settingsCache) return settingsCache;
  if (!settingsLoadingPromise) {
    settingsLoadingPromise = (async () => {
      try {
        const s = await getAppSettings();
        if (s) settingsCache = s;
        return s;
      } catch (err) {
        console.error('[notifications] settings load failed', err);
        return null;
      } finally {
        // Clear loading so a future call can retry on next access if it failed
        if (!settingsCache) settingsLoadingPromise = null;
      }
    })();
  }
  return settingsLoadingPromise;
}

export function invalidateSettingsCache(): void {
  settingsCache = null;
  settingsLoadingPromise = null;
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

/**
 * Admin created a task for a client → notify the client (with full context).
 * Returns true on success, false otherwise.
 */
export async function notifyTaskCreatedByAdmin(client: Client, task: Task): Promise<boolean> {
  if (!isNotifiableClient(client)) return false;
  const settings = await loadSettings();
  const template = settings?.task_created_template || FALLBACKS.task_created;
  const baseLine = render(template, { title: task.title });
  const message =
    baseLine +
    `\nPrazo: ${formatDate(task.due_date)}\nPrioridade: ${PRIORITY_LABEL[task.priority]}`;
  return sendViaApi({
    phone: client.phone,
    key: client.callmebot_key,
    message,
    clientId: client.id,
    taskId: task.id,
  });
}

/**
 * Client created a task in the portal → notify the ADMIN.
 * Admin needs to know there's a new request to triage.
 */
export async function notifyTaskCreatedByClient(client: Client, task: Task): Promise<boolean> {
  const settings = await loadSettings();
  const admin = getAdminRecipient(settings);
  if (!admin) return false;
  const clientName = client.brand_name ?? client.name;
  const lines: string[] = [
    `📥 Novo pedido de ${clientName}`,
    `Tarefa: ${task.title}`,
  ];
  if (task.description) {
    const desc =
      task.description.length > 160 ? task.description.slice(0, 160) + '...' : task.description;
    lines.push(`Detalhes: ${desc}`);
  }
  if (task.due_date) {
    const d = new Date(`${task.due_date}T12:00:00`).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
    });
    lines.push(`Prazo desejado: ${d}`);
  }
  return sendViaApi({
    phone: admin.phone,
    key: admin.key,
    message: lines.join('\n'),
    clientId: client.id,
    taskId: task.id,
  });
}

/**
 * Client completed a task in the portal → confirmation to the client itself.
 */
export async function notifyTaskCompletedByClient(client: Client, task: Task): Promise<boolean> {
  if (!isNotifiableClient(client)) return false;
  const settings = await loadSettings();
  const template = settings?.task_completed_template || FALLBACKS.task_completed;
  return sendViaApi({
    phone: client.phone,
    key: client.callmebot_key,
    message: render(template, { title: task.title }),
    clientId: client.id,
    taskId: task.id,
  });
}

/**
 * Admin marked a client task as complete → notify the client so they know.
 */
export async function notifyTaskCompletedByAdmin(client: Client, task: Task): Promise<boolean> {
  if (!isNotifiableClient(client)) return false;
  const settings = await loadSettings();
  const template = settings?.task_completed_template || FALLBACKS.task_completed;
  return sendViaApi({
    phone: client.phone,
    key: client.callmebot_key,
    message: render(template, { title: task.title }),
    clientId: client.id,
    taskId: task.id,
  });
}

/**
 * Admin pressed the "Send reminder" button on a client card → list of pending
 * tasks delivered to the client's WhatsApp.
 */
export async function sendReminder(client: Client, pendingTasks: Task[]): Promise<boolean> {
  if (!isNotifiableClient(client)) return false;
  const settings = await loadSettings();
  const name = client.brand_name ?? client.name;
  const template = settings?.reminder_template || FALLBACKS.reminder;
  const header = render(template, { name, count: pendingTasks.length });
  const lines = pendingTasks
    .slice(0, 10)
    .map((t) => `• ${t.title}${t.due_date ? ` (${formatDate(t.due_date)})` : ''}`)
    .join('\n');
  return sendViaApi({
    phone: client.phone,
    key: client.callmebot_key,
    message: `${header}\n${lines}`,
    clientId: client.id,
    taskId: null,
  });
}
