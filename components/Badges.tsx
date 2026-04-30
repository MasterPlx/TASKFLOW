import type { Priority, Recurrence, Status } from '@/lib/types';
import {
  PRIORITY_LABEL,
  RECURRENCE_LABEL,
  STATUS_LABEL,
} from '@/lib/utils';
import { Repeat } from 'lucide-react';

// Bolder, more saturated palette (Notion-template-style):
// pastel background (100) + dot (500/600) + dark text (700) → vibrante mas legível.

const PRIORITY_STYLES: Record<Priority, { dot: string; text: string; bg: string; border: string }> = {
  urgente: { dot: 'bg-accent-rose-600',    text: 'text-accent-rose-700',    bg: 'bg-accent-rose-100',   border: 'border-accent-rose-200/70' },
  alta:    { dot: 'bg-accent-peach-600',   text: 'text-accent-peach-700',   bg: 'bg-accent-peach-100',  border: 'border-accent-peach-200/70' },
  média:   { dot: 'bg-accent-amber-600',   text: 'text-accent-amber-700',   bg: 'bg-accent-amber-100',  border: 'border-accent-amber-200/70' },
  baixa:   { dot: 'bg-accent-emerald-600', text: 'text-accent-emerald-700', bg: 'bg-accent-emerald-100',border: 'border-accent-emerald-200/70' },
};

const STATUS_STYLES: Record<Status, { dot: string; text: string; bg: string; border: string }> = {
  pendente:  { dot: 'bg-ink-faint',          text: 'text-ink-muted',         bg: 'bg-surface-sunken',     border: 'border-border' },
  andamento: { dot: 'bg-accent-sky-600',     text: 'text-accent-sky-700',    bg: 'bg-accent-sky-100',     border: 'border-accent-sky-200/70' },
  concluída: { dot: 'bg-accent-emerald-600', text: 'text-accent-emerald-700',bg: 'bg-accent-emerald-100', border: 'border-accent-emerald-200/70' },
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  const s = PRIORITY_STYLES[priority];
  return (
    <span className={`badge border ${s.bg} ${s.text} ${s.border}`}>
      <span className={`dot ${s.dot}`} aria-hidden />
      {PRIORITY_LABEL[priority]}
    </span>
  );
}

export function StatusBadge({ status }: { status: Status }) {
  const s = STATUS_STYLES[status];
  return (
    <span className={`badge border ${s.bg} ${s.text} ${s.border}`}>
      <span className={`dot ${s.dot}`} aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function RecurrenceBadge({ recurrence }: { recurrence: Recurrence }) {
  if (recurrence === 'none') return null;
  return (
    <span className="badge border border-accent-violet-200/70 bg-accent-violet-100 text-accent-violet-700">
      <Repeat className="h-2.5 w-2.5" />
      {RECURRENCE_LABEL[recurrence]}
    </span>
  );
}
