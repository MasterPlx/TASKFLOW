import type { Priority, Recurrence, Status } from './types';

export const PRIORITIES: Priority[] = ['urgente', 'alta', 'média', 'baixa'];
export const STATUSES: Status[] = ['pendente', 'andamento', 'concluída'];
export const RECURRENCES: Recurrence[] = ['none', 'daily', 'weekly', 'monthly'];

export const PRIORITY_ORDER: Record<Priority, number> = {
  urgente: 0,
  alta: 1,
  média: 2,
  baixa: 3,
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  urgente: 'Urgente',
  alta: 'Alta',
  média: 'Média',
  baixa: 'Baixa',
};

export const STATUS_LABEL: Record<Status, string> = {
  pendente: 'A fazer',
  andamento: 'Em andamento',
  concluída: 'Concluído',
};

export const RECURRENCE_LABEL: Record<Recurrence, string> = {
  none: 'Não recorrente',
  daily: 'Diária',
  weekly: 'Semanal',
  monthly: 'Mensal',
};

// ── Reminder offsets (minutes before due_date) ─────────────────────────────
export interface ReminderOption {
  value: number | null;
  label: string;
  short: string;
}

export const REMINDER_OPTIONS: ReminderOption[] = [
  { value: null,  label: 'Não lembrar',           short: '' },
  { value: 30,    label: '30 minutos antes',      short: '30min' },
  { value: 60,    label: '1 hora antes',          short: '1h' },
  { value: 180,   label: '3 horas antes',         short: '3h' },
  { value: 1440,  label: '1 dia antes',           short: '1d' },
  { value: 2880,  label: '2 dias antes',          short: '2d' },
];

export function reminderShortLabel(offsetMinutes: number | null): string | null {
  if (offsetMinutes === null) return null;
  const opt = REMINDER_OPTIONS.find((o) => o.value === offsetMinutes);
  return opt?.short ?? `${offsetMinutes}min`;
}

export function priorityClasses(p: Priority): string {
  switch (p) {
    case 'urgente':
      return 'bg-red-100 text-red-800';
    case 'alta':
      return 'bg-orange-100 text-orange-800';
    case 'média':
      return 'bg-yellow-100 text-yellow-800';
    case 'baixa':
      return 'bg-green-100 text-green-800';
  }
}

export function statusClasses(s: Status): string {
  switch (s) {
    case 'pendente':
      return 'bg-gray-100 text-gray-700';
    case 'andamento':
      return 'bg-blue-100 text-blue-800';
    case 'concluída':
      return 'bg-emerald-100 text-emerald-800';
  }
}

export function isOverdue(dueDate: string | null, status: Status): boolean {
  if (!dueDate || status === 'concluída') return false;
  const d = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d.getTime() < today.getTime();
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatRelative(iso: string): string {
  const d = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - d);
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min}min atrás`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h atrás`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d atrás`;
  return formatDate(new Date(d).toISOString());
}

export function nextDueDate(current: string | null, recurrence: Recurrence): string | null {
  if (recurrence === 'none') return null;
  const base = current ? new Date(current) : new Date();
  if (recurrence === 'daily') base.setDate(base.getDate() + 1);
  if (recurrence === 'weekly') base.setDate(base.getDate() + 7);
  if (recurrence === 'monthly') base.setMonth(base.getMonth() + 1);
  return base.toISOString().slice(0, 10);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Normalize a Brazilian phone for CallMeBot (full international format).
 *
 * Rules:
 *   - Strip everything except digits
 *   - If 10 or 11 digits (DDD + number, typical "I'll just type my WhatsApp"),
 *     auto-prepend the Brazilian country code (55).
 *   - Otherwise return as-is. CallMeBot validates server-side anyway.
 *
 * Returns:
 *   - normalized: digits only, ready to send to the API
 *   - hasAutoCountry: true if we added the 55 prefix (so we can hint in UI)
 *   - valid: heuristic — at least 12 digits, max 15 (E.164 max)
 */
export function normalizePhone(input: string): {
  normalized: string;
  hasAutoCountry: boolean;
  valid: boolean;
} {
  const digits = input.replace(/\D/g, '');
  let normalized = digits;
  let hasAutoCountry = false;
  if (digits.length === 10 || digits.length === 11) {
    normalized = '55' + digits;
    hasAutoCountry = true;
  }
  const valid = normalized.length >= 12 && normalized.length <= 15;
  return { normalized, hasAutoCountry, valid };
}

/** Format a digits-only phone for display: +55 (14) 99907-8928 */
export function formatPhoneDisplay(digits: string): string {
  if (!digits) return '';
  if (digits.length < 12) return '+' + digits;
  // 55 + 2 (DDD) + 8 or 9 digits
  const country = digits.slice(0, 2);
  const ddd = digits.slice(2, 4);
  const rest = digits.slice(4);
  if (rest.length === 9) {
    return `+${country} (${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
  }
  if (rest.length === 8) {
    return `+${country} (${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  }
  return `+${digits}`;
}
