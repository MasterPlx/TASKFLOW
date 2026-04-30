'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, ListTodo, Sparkles } from 'lucide-react';
import { listAttachments, listComments, listTasks, updateTask } from '@/lib/supabase';
import type { Client, Status, Task } from '@/lib/types';
import { TaskList } from '@/components/tasks/TaskList';
import { TaskModal } from '@/components/tasks/TaskModal';
import { TaskDetail } from '@/components/tasks/TaskDetail';
import { useToast } from '@/components/Toast';
import { cn, formatDate } from '@/lib/utils';
import {
  notifyTaskCompletedByClient,
  notifyTaskCreatedByClient,
} from '@/lib/notifications';
import { maybeReschedule } from '@/lib/recurrence';
import { SkeletonRow } from '@/components/Skeleton';
import { fireConfetti } from '@/components/Confetti';

type Filter = 'todas' | 'pendente' | 'andamento' | 'concluída';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'pendente', label: 'A fazer' },
  { id: 'andamento', label: 'Em andamento' },
  { id: 'concluída', label: 'Concluídas' },
];

/** Convert a hex color to a CSS-friendly RGBA string. */
function hexToRgba(hex: string, alpha: number): string {
  const m = hex.replace('#', '').match(/.{1,2}/g);
  if (!m || m.length < 3) return `rgba(124, 58, 237, ${alpha})`;
  const [r, g, b] = m.map((x) => parseInt(x, 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function ClientPortal({ client }: { client: Client }) {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('todas');
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<Task | null>(null);
  const [meta, setMeta] = useState<Record<string, { comments: number; attachments: number }>>({});

  const accent = client.brand_color ?? '#7C3AED';
  const displayName = client.brand_name ?? client.name;

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await listTasks({ clientId: client.id });
        if (!mounted) return;
        setTasks(data);
        const counts: Record<string, { comments: number; attachments: number }> = {};
        await Promise.all(
          data.map(async (t) => {
            try {
              const [cs, as] = await Promise.all([listComments(t.id), listAttachments(t.id)]);
              counts[t.id] = { comments: cs.length, attachments: as.length };
            } catch {
              // Skip meta — list still works
            }
          }),
        );
        if (mounted) setMeta(counts);
      } catch (err) {
        console.error('[portal] load failed', err);
        if (mounted) toast('Não foi possível carregar as tarefas', 'error');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [client.id, toast]);

  const metrics = useMemo(() => {
    const pending = tasks.filter((t) => t.status === 'pendente').length;
    const inProgress = tasks.filter((t) => t.status === 'andamento').length;
    const done = tasks.filter((t) => t.status === 'concluída').length;
    const total = tasks.length;
    const percent = total === 0 ? 0 : Math.round((done / total) * 100);
    return { pending, inProgress, done, total, percent };
  }, [tasks]);

  const filtered = useMemo(() => {
    if (filter === 'todas') return tasks;
    return tasks.filter((t) => t.status === filter);
  }, [tasks, filter]);

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
        fireConfetti(32, 0.5, 0.4);
        const { created, nextDate } = await maybeReschedule(saved);
        if (created) {
          setTasks((prevList) => [created, ...prevList]);
          toast(`Tarefa recorrente reagendada para ${formatDate(nextDate)}`, 'info');
        }
        const ok = await notifyTaskCompletedByClient(client, saved);
        if (ok === false) {
          toast('Tarefa concluída — falha ao enviar confirmação WhatsApp', 'info');
        }
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

  // Shared brand-color helpers passed inline as CSS variables. This lets us
  // do `bg-[var(--brand)]` in nested children without prop drilling.
  const brandStyle = {
    ['--brand' as string]: accent,
    ['--brand-glow' as string]: hexToRgba(accent, 0.32),
    ['--brand-soft' as string]: hexToRgba(accent, 0.12),
  } as React.CSSProperties;

  return (
    <div className="min-h-screen bg-surface" style={brandStyle}>
      {/* ════════════════════════════════════════════════════════════════
          HERO — editorial dark with brand-color atmosphere
          ─────────────────────────────────────────────────────────────── */}
      <header className="relative overflow-hidden border-b border-border/60 bg-surface-sunken/40">
        {/* Atmospheric radial glow (the "soul" of this hero) */}
        <div
          className="absolute -left-[10%] -top-[60%] h-[700px] w-[700px] rounded-full opacity-50 blur-[120px]"
          style={{ backgroundColor: accent }}
          aria-hidden
        />
        {/* Counter glow (smaller, bottom-right) for spatial balance */}
        <div
          className="absolute -bottom-[40%] -right-[10%] h-[400px] w-[400px] rounded-full opacity-25 blur-[100px]"
          style={{ backgroundColor: accent }}
          aria-hidden
        />
        {/* Editorial grid pattern (very low opacity, gives "magazine spread" feel) */}
        <div
          className="absolute inset-0 opacity-[0.025] dark:opacity-[0.05]"
          style={{
            backgroundImage:
              'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
          aria-hidden
        />

        <div className="relative mx-auto max-w-4xl px-6 pb-12 pt-14">
          {/* Brand row */}
          <div className="flex items-center gap-4">
            {client.brand_logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={client.brand_logo_url}
                alt={displayName}
                className="h-14 w-14 flex-none rounded-2xl object-cover shadow-lg ring-1 ring-black/5 dark:ring-white/10"
              />
            ) : (
              <span
                className="flex h-14 w-14 flex-none items-center justify-center rounded-2xl text-white shadow-lg"
                style={{
                  backgroundColor: accent,
                  boxShadow: `0 8px 28px -6px ${hexToRgba(accent, 0.55)}`,
                }}
              >
                <ListTodo className="h-6 w-6" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-subtle">
                Portal de tarefas
              </p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight text-ink md:text-4xl">
                {displayName}
              </h1>
            </div>
            {/* Vertical brand accent — stamps identity without dominating */}
            <div
              className="hidden h-12 w-1 flex-none rounded-full sm:block"
              style={{
                backgroundColor: accent,
                boxShadow: `0 0 24px ${hexToRgba(accent, 0.7)}`,
              }}
              aria-hidden
            />
          </div>

          {/* Status / progress band — split layout */}
          <div className="mt-10 grid gap-6 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="min-w-0">
              <p className="text-sm text-ink-muted">
                {metrics.total === 0
                  ? 'Você ainda não tem tarefas por aqui'
                  : metrics.percent === 100
                    ? 'Tudo em dia 🎉'
                    : `${metrics.pending + metrics.inProgress} ${
                        metrics.pending + metrics.inProgress === 1
                          ? 'tarefa em aberto'
                          : 'tarefas em aberto'
                      }`}
              </p>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-ink/[0.06] dark:bg-white/[0.08]">
                <div
                  className="h-full rounded-full transition-[width] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
                  style={{
                    width: `${metrics.percent}%`,
                    backgroundColor: accent,
                    boxShadow: `0 0 16px ${hexToRgba(accent, 0.6)}`,
                  }}
                />
              </div>
            </div>
            <div className="text-right">
              <p
                className="tabular text-5xl font-bold leading-none tracking-tight md:text-6xl"
                style={{ color: accent }}
              >
                {metrics.percent}
                <span className="ml-0.5 text-2xl text-ink-subtle">%</span>
              </p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-faint">
                concluído
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* ════════════════════════════════════════════════════════════════
          CONTENT
          ─────────────────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-4xl px-6 pb-16 pt-8">
        {/* Floating metric cards — 3 column, tinted dark cards */}
        <section className="grid grid-cols-3 gap-3">
          <BrandMetric label="A fazer" value={metrics.pending} accent={accent} tone="warm" />
          <BrandMetric label="Em andamento" value={metrics.inProgress} accent={accent} tone="active" />
          <BrandMetric label="Concluídas" value={metrics.done} accent={accent} tone="done" />
        </section>

        {/* Filters + add */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1">
            {FILTERS.map((f) => {
              const active = filter === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-xs font-medium transition-all',
                    active
                      ? 'text-white shadow-elevated'
                      : 'border border-border bg-surface-raised text-ink-muted hover:bg-surface-sunken hover:text-ink',
                  )}
                  style={active ? { backgroundColor: accent } : undefined}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium text-white shadow-elevated transition-transform hover:scale-[1.02] active:scale-[0.98]"
            style={{
              backgroundColor: accent,
              boxShadow: `0 4px 16px -4px ${hexToRgba(accent, 0.5)}`,
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            Nova tarefa
          </button>
        </div>

        <section className="mt-4">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonRow key={i} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState onCreate={() => setModalOpen(true)} accent={accent} />
          ) : (
            <TaskList
              tasks={filtered}
              meta={meta}
              brandColor={accent}
              onSelect={setSelected}
              onToggleComplete={toggleComplete}
            />
          )}
        </section>
      </main>

      <TaskModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        clientId={client.id}
        createdBy="client"
        simplified
        onSaved={async (t) => {
          applyTask(t);
          const ok = await notifyTaskCreatedByClient(client, t);
          if (ok === false) {
            toast('Pedido criado — sem aviso WhatsApp (admin sem config)', 'info');
          }
        }}
      />

      <TaskDetail
        task={selected}
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        authorName={displayName}
        readOnly
        brandColor={accent}
      />
    </div>
  );
}

// ── Metric card — variant of the brand color, contained intensity ────────────
function BrandMetric({
  label,
  value,
  accent,
  tone,
}: {
  label: string;
  value: number;
  accent: string;
  /** Determines which secondary color tone to apply */
  tone: 'warm' | 'active' | 'done';
}) {
  // Each tone uses neutral chrome but the value number is colored differently
  const valueColor =
    tone === 'warm'
      ? 'text-accent-amber-700 dark:text-accent-amber-200'
      : tone === 'active'
        ? 'text-accent-sky-700 dark:text-accent-sky-200'
        : 'text-accent-emerald-700 dark:text-accent-emerald-200';

  const dotColor =
    tone === 'warm'
      ? 'bg-accent-amber-500'
      : tone === 'active'
        ? 'bg-accent-sky-500'
        : 'bg-accent-emerald-500';

  return (
    <div className="card relative overflow-hidden p-4">
      {/* Tiny brand-colored corner accent — ties the whole portal together */}
      <div
        aria-hidden
        className="absolute -right-6 -top-6 h-12 w-12 rounded-full opacity-[0.07] blur-md"
        style={{ backgroundColor: accent }}
      />
      <div className="relative flex items-center gap-1.5">
        <span className={cn('dot', dotColor)} />
        <p className="text-xs font-medium text-ink-muted">{label}</p>
      </div>
      <p className={cn('tabular relative mt-3 text-3xl font-bold tracking-tight', valueColor)}>
        {value}
      </p>
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────
function EmptyState({ onCreate, accent }: { onCreate: () => void; accent: string }) {
  return (
    <div className="relative overflow-hidden rounded-card border border-dashed border-border-strong bg-surface-raised p-12 text-center">
      {/* Subtle brand-colored ambient glow inside the empty state */}
      <div
        aria-hidden
        className="absolute -top-1/2 left-1/2 h-[300px] w-[300px] -translate-x-1/2 rounded-full opacity-[0.06] blur-[80px]"
        style={{ backgroundColor: accent }}
      />
      <div className="relative flex flex-col items-center gap-3">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-2xl text-white"
          style={{
            backgroundColor: accent,
            boxShadow: `0 12px 32px -8px ${hexToRgba(accent, 0.5)}`,
          }}
        >
          <ListTodo className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <p className="text-base font-semibold tracking-tight text-ink">
            Nenhuma tarefa por aqui
          </p>
          <p className="text-xs text-ink-subtle">
            Crie a primeira tarefa para começar a acompanhar seus pedidos
          </p>
        </div>
        <button
          onClick={onCreate}
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white"
          style={{
            backgroundColor: accent,
            boxShadow: `0 4px 16px -4px ${hexToRgba(accent, 0.5)}`,
          }}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Criar primeira tarefa
        </button>
      </div>
    </div>
  );
}
