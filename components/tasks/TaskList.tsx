'use client';

import { MessageSquare, Paperclip, ListChecks, Bell, Trash2 } from 'lucide-react';
import type { Task } from '@/lib/types';
import { PriorityBadge, RecurrenceBadge, StatusBadge } from '@/components/Badges';
import { AnimatedCheckbox } from '@/components/AnimatedCheckbox';
import { cn, formatDate, isOverdue, PRIORITY_ORDER, reminderShortLabel } from '@/lib/utils';

export function TaskList({
  tasks,
  onSelect,
  onToggleComplete,
  onDelete,
  brandColor,
  meta,
}: {
  tasks: Task[];
  onSelect: (t: Task) => void;
  onToggleComplete: (t: Task) => void;
  /** When provided, a hover-revealed trash button appears on each row */
  onDelete?: (t: Task) => void;
  brandColor?: string;
  meta?: Record<string, { comments: number; attachments: number }>;
}) {
  const sorted = [...tasks].sort(
    (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority],
  );

  if (sorted.length === 0) {
    return (
      <div className="card-tint-violet flex flex-col items-center justify-center gap-3 p-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-violet-200 text-accent-violet-700">
          <ListChecks className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-ink">Nenhuma tarefa por aqui</p>
          <p className="mt-1 text-xs text-ink-subtle">
            Use o botão <span className="font-medium text-ink">Adicionar</span> acima para criar a primeira
          </p>
        </div>
      </div>
    );
  }

  return (
    <ul className="overflow-hidden rounded-card border border-border bg-surface-raised">
      {sorted.map((t, idx) => {
        const overdue = isOverdue(t.due_date, t.status);
        const done = t.status === 'concluída';
        const m = meta?.[t.id];
        return (
          <li
            key={t.id}
            className={cn(
              'stagger-item group flex items-center gap-3 px-4 py-3 transition-colors',
              idx !== sorted.length - 1 && 'border-b border-border-subtle',
              'hover:bg-surface-sunken/50',
            )}
            style={{ animationDelay: `${Math.min(idx, 8) * 30}ms` }}
          >
            <AnimatedCheckbox
              checked={done}
              onToggle={() => onToggleComplete(t)}
              color={brandColor}
            />
            <button
              type="button"
              onClick={() => onSelect(t)}
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
            >
              <span
                className={cn(
                  'truncate text-sm transition-colors',
                  done ? 'text-ink-faint line-through' : 'text-ink',
                )}
              >
                {t.title}
              </span>
              <span className="ml-auto flex flex-none items-center gap-1.5">
                {m && m.comments > 0 && (
                  <span className="flex items-center gap-1 text-2xs text-ink-faint">
                    <MessageSquare className="h-3 w-3" />
                    <span className="tabular">{m.comments}</span>
                  </span>
                )}
                {m && m.attachments > 0 && (
                  <span className="flex items-center gap-1 text-2xs text-ink-faint">
                    <Paperclip className="h-3 w-3" />
                    <span className="tabular">{m.attachments}</span>
                  </span>
                )}
                <PriorityBadge priority={t.priority} />
                {!done && <StatusBadge status={t.status} />}
                <RecurrenceBadge recurrence={t.recurrence} />
                {t.reminder_offset_minutes !== null && !t.reminder_sent_at && !done && (
                  <span className="badge border border-accent-amber-200/70 bg-accent-amber-50 text-accent-amber-700">
                    <Bell className="h-2.5 w-2.5" />
                    {reminderShortLabel(t.reminder_offset_minutes)}
                  </span>
                )}
                {t.due_date && (
                  <span
                    className={cn(
                      'badge border',
                      overdue
                        ? 'border-accent-rose-200 bg-accent-rose-50 text-accent-rose-700'
                        : 'border-border bg-surface-sunken text-ink-muted',
                    )}
                  >
                    {formatDate(t.due_date)}
                  </span>
                )}
              </span>
            </button>
            {onDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(t);
                }}
                className="invisible flex-none rounded-md p-1.5 text-ink-faint transition-colors hover:bg-accent-rose-50 hover:text-accent-rose-700 group-hover:visible"
                aria-label="Excluir tarefa"
                title="Excluir tarefa"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
