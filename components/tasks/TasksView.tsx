'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, List, Columns3, ArrowUpDown, Filter, X } from 'lucide-react';
import { deleteTask, listAttachments, listComments, listTasks, updateTask } from '@/lib/supabase';
import type { Priority, Status, Task } from '@/lib/types';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/ConfirmDialog';
import { TaskList } from './TaskList';
import { KanbanBoard } from './KanbanBoard';
import { TaskModal } from './TaskModal';
import { TaskDetail } from './TaskDetail';
import {
  PRIORITIES,
  PRIORITY_LABEL,
  PRIORITY_ORDER,
  STATUSES,
  STATUS_LABEL,
  cn,
  formatDate,
  isOverdue,
} from '@/lib/utils';
import { maybeReschedule } from '@/lib/recurrence';
import { SkeletonRow } from '@/components/Skeleton';
import { fireConfetti } from '@/components/Confetti';

type SortKey = 'priority' | 'due_date' | 'created' | 'title';
const SORT_LABEL: Record<SortKey, string> = {
  priority: 'Prioridade',
  due_date: 'Prazo',
  created: 'Mais recentes',
  title: 'Alfabética',
};

export function TasksView({
  title,
  subtitle,
  clientId,
  createdBy,
  authorName,
  brandColor,
  readOnly = false,
  onTaskCreated,
  onTaskCompleted,
}: {
  title: string;
  subtitle?: string;
  clientId: string | null;
  createdBy: 'admin' | 'client';
  authorName: string;
  brandColor?: string;
  readOnly?: boolean;
  onTaskCreated?: (t: Task) => Promise<boolean | void> | boolean | void;
  onTaskCompleted?: (t: Task) => Promise<boolean | void> | boolean | void;
}) {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'kanban'>('list');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('priority');
  const [filterStatus, setFilterStatus] = useState<Set<Status>>(new Set());
  const [filterPriority, setFilterPriority] = useState<Set<Priority>>(new Set());
  const [filterOverdue, setFilterOverdue] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [selected, setSelected] = useState<Task | null>(null);
  const [meta, setMeta] = useState<Record<string, { comments: number; attachments: number }>>({});

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    (async () => {
      const data = await listTasks({ clientId });
      if (!mounted) return;
      setTasks(data);
      setLoading(false);
      const counts: Record<string, { comments: number; attachments: number }> = {};
      await Promise.all(
        data.map(async (t) => {
          const [cs, as] = await Promise.all([listComments(t.id), listAttachments(t.id)]);
          counts[t.id] = { comments: cs.length, attachments: as.length };
        }),
      );
      if (mounted) setMeta(counts);
    })();
    return () => {
      mounted = false;
    };
  }, [clientId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = tasks;
    if (q) out = out.filter((t) => t.title.toLowerCase().includes(q));
    if (filterStatus.size > 0) out = out.filter((t) => filterStatus.has(t.status));
    if (filterPriority.size > 0) out = out.filter((t) => filterPriority.has(t.priority));
    if (filterOverdue) out = out.filter((t) => isOverdue(t.due_date, t.status));
    return [...out].sort((a, b) => {
      switch (sortKey) {
        case 'priority':
          return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
        case 'due_date': {
          const da = a.due_date ? new Date(a.due_date).getTime() : Number.MAX_SAFE_INTEGER;
          const db = b.due_date ? new Date(b.due_date).getTime() : Number.MAX_SAFE_INTEGER;
          return da - db;
        }
        case 'created':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'title':
          return a.title.localeCompare(b.title);
      }
    });
  }, [tasks, search, sortKey, filterStatus, filterPriority, filterOverdue]);

  const hasFilters =
    filterStatus.size > 0 || filterPriority.size > 0 || filterOverdue;

  function clearFilters() {
    setFilterStatus(new Set());
    setFilterPriority(new Set());
    setFilterOverdue(false);
  }

  function toggleStatus(s: Status) {
    setFilterStatus((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }
  function togglePriority(p: Priority) {
    setFilterPriority((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }

  function applyTask(updated: Task) {
    setTasks((prev) => {
      const idx = prev.findIndex((t) => t.id === updated.id);
      if (idx === -1) return [updated, ...prev];
      const next = [...prev];
      next[idx] = updated;
      return next;
    });
  }

  async function changeStatus(task: Task, newStatus: Status) {
    const prev = task.status;
    applyTask({ ...task, status: newStatus });
    try {
      const saved = await updateTask(task.id, { status: newStatus });
      applyTask(saved);
      if (newStatus === 'concluída' && prev !== 'concluída') {
        // Confetti for important tasks (delight moment)
        if (saved.priority === 'urgente' || saved.priority === 'alta') {
          fireConfetti(28, 0.5, 0.45);
        }
        const { created, nextDate } = await maybeReschedule(saved);
        if (created) {
          setTasks((prevList) => [created, ...prevList]);
          toast(`Tarefa recorrente reagendada para ${formatDate(nextDate)}`, 'info');
        }
        await onTaskCompleted?.(saved);
      }
    } catch (err) {
      console.error(err);
      applyTask({ ...task, status: prev });
      toast('Erro ao atualizar status', 'error');
    }
  }

  async function toggleComplete(t: Task) {
    const newStatus: Status = t.status === 'concluída' ? 'pendente' : 'concluída';
    await changeStatus(t, newStatus);
  }

  function requestDelete(t: Task) {
    confirm({
      title: 'Excluir tarefa?',
      message: (
        <span>
          Esta ação não pode ser desfeita. A tarefa{' '}
          <span className="font-medium text-ink">"{t.title}"</span> será removida
          junto com todos os comentários e anexos vinculados.
        </span>
      ),
      confirmLabel: 'Excluir',
      tone: 'danger',
      onConfirm: async () => {
        try {
          await deleteTask(t.id);
          setTasks((prev) => prev.filter((x) => x.id !== t.id));
          if (selected?.id === t.id) setSelected(null);
          toast('Tarefa excluída', 'success');
        } catch {
          toast('Erro ao excluir', 'error');
        }
      },
    });
  }

  const accent = brandColor ?? '#7C3AED';

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:px-10 md:py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-ink">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-ink-muted">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
          className="btn-primary"
          style={{ backgroundColor: accent }}
        >
          <Plus className="h-3.5 w-3.5" />
          Nova tarefa
        </button>
      </header>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
          <input
            className="input pl-9"
            placeholder="Buscar tarefa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Dropdown
          icon={<ArrowUpDown className="h-3.5 w-3.5" />}
          label={`Ordenar: ${SORT_LABEL[sortKey]}`}
        >
          {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
            <DropdownItem
              key={k}
              active={sortKey === k}
              onClick={() => setSortKey(k)}
            >
              {SORT_LABEL[k]}
            </DropdownItem>
          ))}
        </Dropdown>

        <Dropdown
          icon={<Filter className="h-3.5 w-3.5" />}
          label={hasFilters ? `Filtros · ${filterStatus.size + filterPriority.size + (filterOverdue ? 1 : 0)}` : 'Filtros'}
          tone={hasFilters ? 'active' : undefined}
        >
          <p className="px-2 pb-1 pt-1 text-2xs font-semibold uppercase tracking-wider text-ink-faint">Status</p>
          {STATUSES.map((s) => (
            <DropdownItem key={s} active={filterStatus.has(s)} onClick={() => toggleStatus(s)} checkmark>
              {STATUS_LABEL[s]}
            </DropdownItem>
          ))}
          <div className="my-1 border-t border-border" />
          <p className="px-2 pb-1 pt-1 text-2xs font-semibold uppercase tracking-wider text-ink-faint">Prioridade</p>
          {PRIORITIES.map((p) => (
            <DropdownItem key={p} active={filterPriority.has(p)} onClick={() => togglePriority(p)} checkmark>
              {PRIORITY_LABEL[p]}
            </DropdownItem>
          ))}
          <div className="my-1 border-t border-border" />
          <DropdownItem active={filterOverdue} onClick={() => setFilterOverdue((v) => !v)} checkmark>
            Apenas vencidas
          </DropdownItem>
          {hasFilters && (
            <>
              <div className="my-1 border-t border-border" />
              <DropdownItem onClick={clearFilters}>
                <span className="text-accent-rose-700">Limpar filtros</span>
              </DropdownItem>
            </>
          )}
        </Dropdown>

        <div className="flex rounded-lg border border-border-strong bg-surface-raised p-0.5">
          <button
            type="button"
            onClick={() => setView('list')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              view === 'list' ? 'bg-surface-sunken text-ink' : 'text-ink-muted hover:text-ink',
            )}
          >
            <List className="h-3.5 w-3.5" /> Lista
          </button>
          <button
            type="button"
            onClick={() => setView('kanban')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              view === 'kanban' ? 'bg-surface-sunken text-ink' : 'text-ink-muted hover:text-ink',
            )}
          >
            <Columns3 className="h-3.5 w-3.5" /> Kanban
          </button>
        </div>
      </div>

      {/* Active filter chips */}
      {hasFilters && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {Array.from(filterStatus).map((s) => (
            <Chip key={s} onRemove={() => toggleStatus(s)} label={STATUS_LABEL[s]} />
          ))}
          {Array.from(filterPriority).map((p) => (
            <Chip key={p} onRemove={() => togglePriority(p)} label={PRIORITY_LABEL[p]} />
          ))}
          {filterOverdue && (
            <Chip onRemove={() => setFilterOverdue(false)} label="Vencidas" tone="rose" />
          )}
          <button
            type="button"
            onClick={clearFilters}
            className="text-2xs font-medium text-ink-subtle hover:text-ink"
          >
            limpar todos
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      ) : view === 'list' ? (
        <TaskList
          tasks={filtered}
          meta={meta}
          brandColor={accent}
          onSelect={setSelected}
          onToggleComplete={toggleComplete}
          onDelete={readOnly ? undefined : requestDelete}
        />
      ) : (
        <KanbanBoard
          tasks={filtered}
          onSelect={setSelected}
          onChangeStatus={changeStatus}
          onDelete={readOnly ? undefined : requestDelete}
        />
      )}

      <TaskModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        task={editing}
        clientId={clientId}
        createdBy={createdBy}
        onSaved={async (t) => {
          applyTask(t);
          if (!editing) await onTaskCreated?.(t);
        }}
      />

      <TaskDetail
        task={selected}
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        authorName={authorName}
        readOnly={readOnly}
        brandColor={accent}
        onEdit={(t) => {
          setSelected(null);
          setEditing(t);
          setModalOpen(true);
        }}
        onDeleted={(id) => setTasks((prev) => prev.filter((t) => t.id !== id))}
      />
    </div>
  );
}

// ── Reusable dropdown (anchored, click-outside) ─────────────────────────────
function Dropdown({
  icon,
  label,
  tone,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  tone?: 'active';
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-dropdown]')) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);
  return (
    <div className="relative" data-dropdown>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
          tone === 'active'
            ? 'border-brand-300 bg-brand-50 text-brand-700'
            : 'border-border-strong bg-surface-raised text-ink-muted hover:bg-surface-sunken hover:text-ink',
        )}
      >
        {icon}
        {label}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1.5 min-w-[200px] overflow-hidden rounded-lg border border-border bg-surface-raised p-1 shadow-floating animate-scale-in">
          {children}
        </div>
      )}
    </div>
  );
}

function DropdownItem({
  active,
  checkmark,
  onClick,
  children,
}: {
  active?: boolean;
  checkmark?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
        active
          ? 'bg-surface-sunken text-ink'
          : 'text-ink-muted hover:bg-surface-sunken/60 hover:text-ink',
      )}
    >
      <span className="flex-1">{children}</span>
      {checkmark && active && <span className="text-brand-600">✓</span>}
    </button>
  );
}

function Chip({ label, tone, onRemove }: { label: string; tone?: 'rose'; onRemove: () => void }) {
  const cls =
    tone === 'rose'
      ? 'bg-accent-rose-100 text-accent-rose-700 border-accent-rose-200/70'
      : 'bg-surface-sunken text-ink-muted border-border-strong';
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-2xs font-medium', cls)}>
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="rounded-full p-0.5 hover:bg-black/5 dark:hover:bg-white/10"
        aria-label={`Remover ${label}`}
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </span>
  );
}
