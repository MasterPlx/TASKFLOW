// Match exact DB enum values (Postgres CHECK constraints)
export type Priority = 'urgente' | 'alta' | 'média' | 'baixa';
export type Status = 'pendente' | 'andamento' | 'concluída';
export type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly';
export type NotificationStatus = 'sent' | 'failed' | 'pending';
export type NotificationChannel = 'whatsapp';

export interface Client {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  callmebot_key: string | null;
  brand_color: string | null;
  brand_name: string | null;
  brand_logo_url: string | null;
  created_at: string;
}

export interface Task {
  id: string;
  client_id: string | null;
  title: string;
  description: string | null;
  priority: Priority;
  status: Status;
  due_date: string | null;
  recurrence: Recurrence;
  created_by: 'admin' | 'client';
  created_at: string;
  reminder_offset_minutes: number | null;
  reminder_sent_at: string | null;
}

export interface Comment {
  id: string;
  task_id: string;
  author: string;
  content: string;
  created_at: string;
}

export interface Attachment {
  id: string;
  task_id: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  client_id: string | null;
  task_id: string | null;
  message: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  sent_at: string;
}

export interface TaskInput {
  title: string;
  description?: string | null;
  priority: Priority;
  status: Status;
  due_date?: string | null;
  recurrence: Recurrence;
  client_id?: string | null;
  created_by: 'admin' | 'client';
  reminder_offset_minutes?: number | null;
  reminder_sent_at?: string | null;
}

export interface ClientInput {
  name: string;
  phone?: string | null;
  callmebot_key?: string | null;
  brand_name?: string | null;
  brand_color?: string | null;
  brand_logo_url?: string | null;
}

export interface AppSettings {
  id: string;
  brand_color: string;
  default_greeting: string;
  reminder_template: string;
  task_created_template: string;
  task_completed_template: string;
  admin_phone: string | null;
  admin_callmebot_key: string | null;
  admin_name: string | null;
  updated_at: string;
}

// ── Notes module ──────────────────────────────────────────────────────────
export interface NoteGroup {
  id: string;
  name: string;
  color: string;
  icon: string;
  position: number;
  created_at: string;
}

export interface Note {
  id: string;
  group_id: string | null;
  title: string;
  content: string;
  pinned: boolean;
  color: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface NoteGroupInput {
  name: string;
  color?: string;
  icon?: string;
}

export interface NoteInput {
  group_id?: string | null;
  title?: string;
  content?: string;
  pinned?: boolean;
  color?: string | null;
}
