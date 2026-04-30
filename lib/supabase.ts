import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  AppSettings,
  Attachment,
  Client,
  ClientInput,
  Comment,
  Notification,
  NotificationStatus,
  Task,
  TaskInput,
} from './types';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('[supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

export const ATTACHMENTS_BUCKET = 'attachments';
export const LOGOS_BUCKET = 'logos';

export async function uploadClientLogo(file: File): Promise<string> {
  const safeName = file.name.replace(/[^\w.\-]+/g, '_');
  const path = `${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from(LOGOS_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(LOGOS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function updateClient(
  id: string,
  patch: Partial<ClientInput>,
): Promise<Client> {
  const { data, error } = await supabase
    .from('clients')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as Client;
}

// ──────────────────────────────────────────────────────────────────────────────
// CLIENTS
// ──────────────────────────────────────────────────────────────────────────────

export async function listClients(): Promise<Client[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Client[];
}

export async function getClientBySlug(slug: string): Promise<Client | null> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  return (data as Client | null) ?? null;
}

export async function getClientById(id: string): Promise<Client | null> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as Client | null) ?? null;
}

export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export async function createClientRecord(input: ClientInput): Promise<Client> {
  const baseSlug = slugify(input.name) || `cliente-${Date.now()}`;
  let slug = baseSlug;
  let attempt = 1;
  while (true) {
    const { data: existing } = await supabase
      .from('clients')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (!existing) break;
    attempt += 1;
    slug = `${baseSlug}-${attempt}`;
  }
  const { data, error } = await supabase
    .from('clients')
    .insert({
      name: input.name,
      slug,
      phone: input.phone ?? null,
      callmebot_key: input.callmebot_key ?? null,
      brand_color: input.brand_color ?? '#3C3489',
      brand_name: input.brand_name ?? null,
      brand_logo_url: input.brand_logo_url ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as Client;
}

export async function deleteClient(id: string): Promise<void> {
  const { error } = await supabase.from('clients').delete().eq('id', id);
  if (error) throw error;
}

// ──────────────────────────────────────────────────────────────────────────────
// TASKS
// ──────────────────────────────────────────────────────────────────────────────

export async function listTasks(filter?: { clientId?: string | null }): Promise<Task[]> {
  let query = supabase.from('tasks').select('*').order('created_at', { ascending: false });
  if (filter?.clientId === null) query = query.is('client_id', null);
  else if (filter?.clientId) query = query.eq('client_id', filter.clientId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Task[];
}

export async function getTask(id: string): Promise<Task | null> {
  const { data, error } = await supabase.from('tasks').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as Task | null) ?? null;
}

export async function createTask(input: TaskInput): Promise<Task> {
  const { data, error } = await supabase.from('tasks').insert(input).select('*').single();
  if (error) throw error;
  return data as Task;
}

export async function updateTask(id: string, patch: Partial<TaskInput>): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as Task;
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) throw error;
}

// ──────────────────────────────────────────────────────────────────────────────
// COMMENTS
// ──────────────────────────────────────────────────────────────────────────────

export async function listComments(taskId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Comment[];
}

export async function createComment(input: {
  task_id: string;
  author: string;
  content: string;
}): Promise<Comment> {
  const { data, error } = await supabase.from('comments').insert(input).select('*').single();
  if (error) throw error;
  return data as Comment;
}

export async function deleteComment(id: string): Promise<void> {
  const { error } = await supabase.from('comments').delete().eq('id', id);
  if (error) throw error;
}

// ──────────────────────────────────────────────────────────────────────────────
// ATTACHMENTS
// ──────────────────────────────────────────────────────────────────────────────

export async function listAttachments(taskId: string): Promise<Attachment[]> {
  const { data, error } = await supabase
    .from('attachments')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Attachment[];
}

export async function createAttachment(input: {
  task_id: string;
  file_name: string;
  file_url: string;
  file_size?: number | null;
  mime_type?: string | null;
}): Promise<Attachment> {
  const { data, error } = await supabase.from('attachments').insert(input).select('*').single();
  if (error) throw error;
  return data as Attachment;
}

export async function deleteAttachment(id: string): Promise<void> {
  const { error } = await supabase.from('attachments').delete().eq('id', id);
  if (error) throw error;
}

export async function uploadAttachmentFile(
  taskId: string,
  file: File,
): Promise<{ url: string; path: string }> {
  const safeName = file.name.replace(/[^\w.\-]+/g, '_');
  const path = `${taskId}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from(ATTACHMENTS_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(ATTACHMENTS_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path };
}

// ──────────────────────────────────────────────────────────────────────────────
// NOTIFICATIONS
// ──────────────────────────────────────────────────────────────────────────────

export async function listNotifications(): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('sent_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Notification[];
}

// ──────────────────────────────────────────────────────────────────────────────
// SETTINGS
// ──────────────────────────────────────────────────────────────────────────────

export async function getAppSettings(): Promise<AppSettings | null> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('*')
    .eq('id', 'global')
    .maybeSingle();
  if (error) throw error;
  return (data as AppSettings | null) ?? null;
}

export async function updateAppSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const { data, error } = await supabase
    .from('app_settings')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', 'global')
    .select('*')
    .single();
  if (error) throw error;
  return data as AppSettings;
}

export async function logNotification(input: {
  client_id: string | null;
  task_id: string | null;
  message: string;
  status: NotificationStatus;
}): Promise<void> {
  const { error } = await supabase.from('notifications').insert({
    client_id: input.client_id,
    task_id: input.task_id,
    message: input.message,
    channel: 'whatsapp',
    status: input.status,
  });
  if (error) console.error('[notifications] log failed', error);
}
