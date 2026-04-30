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

/**
 * Convert a hex color to a CSS-friendly RGBA string.
 * Used to layer translucent overlays of the brand color.
 */
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
      const data = await listTasks({ clientId: client.id });
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
  }, [client.id]);

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
        // Always celebrate when client checks off — they're the customer
        fireConfetti(32, 0.5, 0.4);
        const { created, nextDate } = await maybeReschedule(saved);
        if (created) {
          setTasks((prevList) => [created, ...prevList]);
          toast(`Tarefa recorrente reagendada para ${formatDate(nextDate)}`, 'info');
        }
        await notifyTaskCompletedByClient(client, saved);
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

  return (
    <div className="min-h-screen bg-surface">
      {/* Hero with brand color background — strong gradient softens saturated colors */}
      <header className="relative overflow-hidden">
        {/* Solid base (the raw brand color) */}
        <div className="absolute inset-0" style={{ backgroundColor: accent }} aria-hidden />
        {/* Strong vertical darkening: top brighter, bottom-right much darker.
            This is the workhorse — turns flat saturated colors into a depth field. */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              `linear-gradient(155deg, ${hexToRgba('#FFFFFF', 0.18)} 0%, transparent 30%, ${hexToRgba('#000000', 0.55)} 100%)`,
          }}
          aria-hidden
        />
        {/* Light bloom in top-left (gives a "lit from above" feel) */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              `radial-gradient(60% 80% at 10% -10%, ${hexToRgba('#FFFFFF', 0.20)} 0%, transparent 55%)`,
          }}
          aria-hidden
        />
        {/* Vignette in bottom-right corner */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              `radial-gradient(70% 100% at 100% 110%, ${hexToRgba('#000000', 0.40)} 0%, transparent 55%)`,
          }}
          aria-hidden
        />
        {/* Tiny SVG grain texture so cor sólida não pareça PVC */}
        <div
          className="absolute inset-0 opacity-[0.06] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.7'/></svg>\")",
          }}
          aria-hidden
        />

        <div className="relative mx-auto max-w-4xl px-6 pb-16 pt-8">
          <div className="flex items-center gap-3">
            {client.brand_logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={client.brand_logo_url}
                alt={displayName}
                className="h-12 w-12 rounded-xl bg-white/20 object-cover backdrop-blur-sm"
              />
            ) : (
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                <ListTodo className="h-5 w-5 text-white" />
              </span>
            )}
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-white/70">
                Portal de tarefas
              </p>
              <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-white">
                {displayName}
              </h1>
            </div>
          </div>

          {/* Big progress headline */}
          <div className="mt-8 grid gap-4 sm:grid-cols-[1fr,auto]">
            <div>
              <p className="text-sm text-white/80">
                {metrics.total === 0
                  ? 'Você ainda não tem tarefas por aqui'
                  : metrics.percent === 100
                    ? 'Tudo em dia! 🎉'
                    : `${metrics.pending + metrics.inProgress} ${
                        metrics.pending + metrics.inProgress === 1
                          ? 'tarefa em aberto'
                          : 'tarefas em aberto'
                      }`}
              </p>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full rounded-full bg-white transition-[width] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
                  style={{ width: `${metrics.percent}%` }}
                />
              </div>
            </div>
            <div className="flex items-end gap-3 text-right">
              <p className="tabular text-5xl font-semibold tracking-tight text-white">
                {metrics.percent}
                <span className="text-2xl text-white/70">%</span>
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto -mt-8 max-w-4xl px-6 pb-12">
        {/* Floating metric cards (sit on top of hero edge) */}
        <section className="grid grid-cols-3 gap-3">
          <MetricCard label="A fazer" value={metrics.pending} tint="amber" />
          <MetricCard label="Em andamento" value={metrics.inProgress} tint="sky" />
          <MetricCard label="Concluídas" value={metrics.done} tint="emerald" />
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
            style={{ backgroundColor: accent }}
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
        onSaved={async (t) => {
          applyTask(t);
          await notifyTaskCreatedByClient(client, t);
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

function MetricCard({
  label,
  value,
  tint,
}: {
  label: string;
  value: number;
  tint: 'amber' | 'sky' | 'emerald';
}) {
  const styles =
    tint === 'amber'
      ? { bg: 'card-tint-amber', value: 'text-accent-amber-700' }
      : tint === 'sky'
        ? { bg: 'card-tint-sky', value: 'text-accent-sky-700' }
        : { bg: 'card-tint-emerald', value: 'text-accent-emerald-700' };
  return (
    <div className={cn(styles.bg, 'p-4 shadow-elevated')}>
      <p className="text-xs font-medium text-ink-muted">{label}</p>
      <p className={cn('tabular mt-2 text-2xl font-semibold', styles.value)}>{value}</p>
    </div>
  );
}

function EmptyState({ onCreate, accent }: { onCreate: () => void; accent: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-border-strong bg-surface-raised p-12 text-center">
      <div
        className="flex h-12 w-12 items-center justify-center rounded-2xl text-white"
        style={{ backgroundColor: accent }}
      >
        <ListTodo className="h-5 w-5" />
      </div>
      <p className="text-sm font-semibold text-ink">Nenhuma tarefa por aqui</p>
      <p className="text-xs text-ink-subtle">
        Crie a primeira tarefa para começar a acompanhar seus pedidos
      </p>
      <button
        onClick={onCreate}
        className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium text-white"
        style={{ backgroundColor: accent }}
      >
        <Sparkles className="h-3.5 w-3.5" />
        Criar primeira tarefa
      </button>
    </div>
  );
}
