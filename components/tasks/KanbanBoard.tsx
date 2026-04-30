'use client';

import { useState } from 'react';
import { ArrowRight, ArrowLeft, Plus } from 'lucide-react';
import type { Status, Task } from '@/lib/types';
import { PriorityBadge, RecurrenceBadge } from '@/components/Badges';
import { STATUS_LABEL, cn, formatDate, isOverdue, PRIORITY_ORDER } from '@/lib/utils';

const COLUMNS: Status[] = ['pendente', 'andamento', 'concluída'];

const COLUMN_STYLES: Record<Status, { dot: string; ring: string; tint: string }> = {
  pendente:  { dot: 'bg-ink-faint',          ring: 'ring-border-strong',           tint: '' },
  andamento: { dot: 'bg-accent-sky-500',     ring: 'ring-accent-sky-300',          tint: 'bg-accent-sky-50/30' },
  concluída: { dot: 'bg-accent-emerald-500', ring: 'ring-accent-emerald-300',      tint: 'bg-accent-emerald-50/30' },
};

export function KanbanBoard({
  tasks,
  onSelect,
  onChangeStatus,
}: {
  tasks: Task[];
  onSelect: (t: Task) => void;
  onChangeStatus: (t: Task, newStatus: Status) => void;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<Status | null>(null);

  const grouped = COLUMNS.reduce<Record<Status, Task[]>>(
    (acc, col) => {
      acc[col] = tasks
        .filter((t) => t.status === col)
        .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
      return acc;
    },
    { pendente: [], andamento: [], concluída: [] },
  );

  function onDrop(col: Status) {
    if (!draggingId) return;
    const task = tasks.find((t) => t.id === draggingId);
    if (task && task.status !== col) onChangeStatus(task, col);
    setDraggingId(null);
    setOverCol(null);
  }

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {COLUMNS.map((col) => {
        const styles = COLUMN_STYLES[col];
        const isOver = overCol === col;
        return (
          <div
            key={col}
            onDragOver={(e) => {
              e.preventDefault();
              setOverCol(col);
            }}
            onDragLeave={() => setOverCol((c) => (c === col ? null : c))}
            onDrop={() => onDrop(col)}
            className={cn(
              'flex min-h-[60vh] flex-col rounded-card border border-border p-3 transition-all duration-200',
              isOver
                ? `${styles.tint} ring-2 ring-offset-1 ${styles.ring}`
                : 'bg-surface-sunken/40',
            )}
          >
            <div className="mb-3 flex items-center gap-2 px-1">
              <span className={cn('dot', styles.dot)} />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                {STATUS_LABEL[col]}
              </h3>
              <span className="tabular ml-auto text-xs font-medium text-ink-faint">
                {grouped[col].length}
              </span>
            </div>
            <ul className="flex flex-col gap-2">
              {grouped[col].length === 0 && (
                <li className="rounded-lg border border-dashed border-border-strong px-3 py-4 text-center text-2xs text-ink-faint">
                  Sem tarefas
                </li>
              )}
              {grouped[col].map((t) => {
                const overdue = isOverdue(t.due_date, t.status);
                const idx = COLUMNS.indexOf(t.status);
                const prev = idx > 0 ? COLUMNS[idx - 1] : null;
                const next = idx < COLUMNS.length - 1 ? COLUMNS[idx + 1] : null;
                return (
                  <li
                    key={t.id}
                    draggable
                    onDragStart={() => setDraggingId(t.id)}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setOverCol(null);
                    }}
                    onClick={() => onSelect(t)}
                    className={cn(
                      'group cursor-grab rounded-lg border border-border bg-surface-raised p-3 shadow-sm transition-all duration-150 hover:border-border-strong hover:shadow-elevated active:cursor-grabbing',
                      draggingId === t.id && 'opacity-50',
                    )}
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <p className="text-sm leading-snug text-ink">{t.title}</p>
                      <div className="hidden flex-none gap-0.5 group-hover:flex">
                        {prev && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onChangeStatus(t, prev);
                            }}
                            aria-label={`Mover para ${STATUS_LABEL[prev]}`}
                            className="btn-icon h-6 w-6"
                          >
                            <ArrowLeft className="h-3 w-3" />
                          </button>
                        )}
                        {next && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onChangeStatus(t, next);
                            }}
                            aria-label={`Mover para ${STATUS_LABEL[next]}`}
                            className="btn-icon h-6 w-6"
                          >
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      <PriorityBadge priority={t.priority} />
                      <RecurrenceBadge recurrence={t.recurrence} />
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
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
