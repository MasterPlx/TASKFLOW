'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  CheckCheck,
  Clock,
  AlertCircle,
  Users,
  ArrowRight,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { getAppSettings, listClients, listTasks } from '@/lib/supabase';
import type { AppSettings, Client, Task } from '@/lib/types';
import { cn, initials, isOverdue } from '@/lib/utils';
import { SkeletonCard, Skeleton } from '@/components/Skeleton';

interface DashboardData {
  clients: Client[];
  tasks: Task[];
  settings: AppSettings | null;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [clients, tasks, settings] = await Promise.all([
        listClients(),
        listTasks(),
        getAppSettings(),
      ]);
      if (mounted) setData({ clients, tasks, settings });
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const metrics = useMemo(() => {
    if (!data) return null;
    const total = data.tasks.length;
    const pending = data.tasks.filter((t) => t.status === 'pendente').length;
    const inProgress = data.tasks.filter((t) => t.status === 'andamento').length;
    const overdue = data.tasks.filter((t) => isOverdue(t.due_date, t.status)).length;
    const done = data.tasks.filter((t) => t.status === 'concluída').length;
    const overall = total === 0 ? 0 : Math.round((done / total) * 100);
    return { total, pending, inProgress, overdue, done, overall, clientsCount: data.clients.length };
  }, [data]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 6) return 'Boa madrugada';
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  }, []);

  return (
    <div className="relative">
      {/* Decorative gradient mesh behind the hero */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-mesh-violet opacity-90"
        aria-hidden
      />

      <div className="relative mx-auto max-w-6xl px-5 py-8 md:px-10 md:py-10">
        {/* Hero */}
        <header className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-ink-subtle">{greeting}</p>
            <h1 className="mt-1 text-4xl font-semibold tracking-tight text-ink">
              {data?.settings?.default_greeting || 'Bem-vindo de volta'}{' '}
              <span className="text-gradient-brand">✨</span>
            </h1>
            <p className="mt-2 text-sm text-ink-muted">
              Aqui está um resumo das suas operações de hoje
            </p>
          </div>
          {data && metrics && metrics.overdue > 0 && (
            <div className="hidden items-center gap-2 rounded-full border border-accent-rose-200 bg-accent-rose-50 px-3 py-1.5 text-xs font-medium text-accent-rose-700 sm:flex">
              <span className="relative flex h-2 w-2 items-center justify-center">
                <span className="absolute inline-flex h-full w-full rounded-full bg-accent-rose-600 opacity-50 animate-pulse-ring" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent-rose-600" />
              </span>
              <span className="tabular">
                {metrics.overdue} {metrics.overdue === 1 ? 'tarefa vencida' : 'tarefas vencidas'}
              </span>
            </div>
          )}
        </header>

        {/* Tinted metric cards (Notion-style colored backgrounds) */}
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {!data || !metrics ? (
            Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          ) : (
            <>
              <TintedMetric
                label="Total"
                value={metrics.total}
                hint={`${metrics.clientsCount} ${metrics.clientsCount === 1 ? 'cliente' : 'clientes'}`}
                tint="violet"
                icon={Sparkles}
              />
              <TintedMetric
                label="Pendentes"
                value={metrics.pending}
                tint="amber"
                icon={Clock}
              />
              <TintedMetric
                label="Em andamento"
                value={metrics.inProgress}
                tint="sky"
                icon={TrendingUp}
              />
              <TintedMetric
                label="Vencidas"
                value={metrics.overdue}
                tint="rose"
                icon={AlertCircle}
              />
            </>
          )}
        </section>

        {/* Progress overview with horizontal status bars */}
        {data && metrics && (
          <section className="mt-4">
            <div className="card p-6">
              <div className="mb-5 flex items-end justify-between">
                <div>
                  <h2 className="text-base font-semibold text-ink">Progresso geral</h2>
                  <p className="mt-0.5 text-xs text-ink-subtle">
                    Distribuição das tarefas por status
                  </p>
                </div>
                <div className="text-right">
                  <p className="tabular text-3xl font-semibold tracking-tight text-ink">
                    {metrics.overall}%
                  </p>
                  <p className="text-2xs text-ink-subtle">concluído</p>
                </div>
              </div>

              <StatusBars
                pending={metrics.pending}
                inProgress={metrics.inProgress}
                done={metrics.done}
              />
            </div>
          </section>
        )}

        {/* Clients */}
        <section className="mt-6">
          <div className="mb-3 flex items-end justify-between">
            <div>
              <h2 className="text-base font-semibold text-ink">Clientes</h2>
              <p className="mt-0.5 text-xs text-ink-subtle">
                Progresso individual de cada marca
              </p>
            </div>
            <Link href="/admin/clientes" className="btn-ghost">
              Ver todos
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {!data ? (
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="card flex items-center gap-3 p-4">
                  <Skeleton className="h-9 w-9 flex-none rounded-full" />
                  <Skeleton className="h-3 flex-1" />
                </div>
              ))}
            </div>
          ) : data.clients.length === 0 ? (
            <EmptyState />
          ) : (
            <ul className="space-y-2">
              {data.clients.map((c) => (
                <ClientProgressRow key={c.id} client={c} tasks={data.tasks} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

// ── Components ───────────────────────────────────────────────────────────────

const TINT_VARIANTS = {
  violet:  { card: 'card-tint-violet',  icon: 'bg-accent-violet-200 text-accent-violet-700',   value: 'text-accent-violet-700' },
  amber:   { card: 'card-tint-amber',   icon: 'bg-accent-amber-200 text-accent-amber-700',     value: 'text-accent-amber-700' },
  sky:     { card: 'card-tint-sky',     icon: 'bg-accent-sky-200 text-accent-sky-700',         value: 'text-accent-sky-700' },
  rose:    { card: 'card-tint-rose',    icon: 'bg-accent-rose-200 text-accent-rose-700',       value: 'text-accent-rose-700' },
  emerald: { card: 'card-tint-emerald', icon: 'bg-accent-emerald-200 text-accent-emerald-700', value: 'text-accent-emerald-700' },
  peach:   { card: 'card-tint-peach',   icon: 'bg-accent-peach-200 text-accent-peach-700',     value: 'text-accent-peach-700' },
  pink:    { card: 'card-tint-pink',    icon: 'bg-accent-pink-200 text-accent-pink-700',       value: 'text-accent-pink-700' },
};

function TintedMetric({
  label,
  value,
  hint,
  tint,
  icon: Icon,
}: {
  label: string;
  value: number;
  hint?: string;
  tint: keyof typeof TINT_VARIANTS;
  icon: LucideIcon;
}) {
  const v = TINT_VARIANTS[tint];
  return (
    <div className={cn(v.card, 'p-4')}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-ink-muted">{label}</p>
        <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg', v.icon)}>
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <p className={cn('tabular mt-3 text-3xl font-semibold tracking-tight', v.value)}>
        {value}
      </p>
      {hint && <p className="mt-1 text-2xs text-ink-subtle">{hint}</p>}
    </div>
  );
}

function StatusBars({
  pending,
  inProgress,
  done,
}: {
  pending: number;
  inProgress: number;
  done: number;
}) {
  const total = pending + inProgress + done;
  if (total === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border-strong p-6 text-center text-xs text-ink-subtle">
        Sem tarefas para exibir ainda
      </p>
    );
  }

  const rows = [
    {
      label: 'A fazer',
      value: pending,
      color: 'bg-ink-faint',
      textColor: 'text-ink-muted',
    },
    {
      label: 'Em andamento',
      value: inProgress,
      color: 'bg-accent-sky-500',
      textColor: 'text-accent-sky-700',
    },
    {
      label: 'Concluídas',
      value: done,
      color: 'bg-accent-emerald-500',
      textColor: 'text-accent-emerald-700',
    },
  ];

  const max = Math.max(...rows.map((r) => r.value), 1);

  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const percent = total === 0 ? 0 : Math.round((r.value / total) * 100);
        const width = (r.value / max) * 100;
        return (
          <div key={r.label}>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className={cn('font-medium', r.textColor)}>{r.label}</span>
              <span className="tabular text-ink-subtle">
                {r.value} <span className="text-ink-faint">· {percent}%</span>
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-sunken">
              <div
                className={cn('h-full rounded-full transition-[width] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]', r.color)}
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ProgressBar({ percent, color }: { percent: number; color?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
      <div
        className="h-full rounded-full transition-[width] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{ width: `${percent}%`, backgroundColor: color ?? '#7C3AED' }}
      />
    </div>
  );
}

function ClientProgressRow({ client, tasks }: { client: Client; tasks: Task[] }) {
  const ts = tasks.filter((t) => t.client_id === client.id);
  const total = ts.length;
  const done = ts.filter((t) => t.status === 'concluída').length;
  const pending = total - done;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  const accent = client.brand_color ?? '#7C3AED';
  return (
    <li>
      <Link
        href={`/admin/clientes/${client.id}`}
        className="card-hover group flex items-center gap-3 p-4 transition-shadow hover:shadow-elevated"
      >
        <span
          className="flex h-10 w-10 flex-none items-center justify-center rounded-xl text-xs font-semibold text-white shadow-elevated"
          style={{ backgroundColor: accent }}
        >
          {initials(client.brand_name ?? client.name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="truncate text-sm font-medium text-ink">
              {client.brand_name ?? client.name}
            </p>
            <span className="tabular flex-none text-xs text-ink-subtle">
              {pending} pendente{pending === 1 ? '' : 's'} · <span className="font-medium text-ink">{percent}%</span>
            </span>
          </div>
          <ProgressBar percent={percent} color={accent} />
        </div>
        <ArrowRight className="h-4 w-4 flex-none text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-ink-muted" />
      </Link>
    </li>
  );
}

function EmptyState() {
  return (
    <div className="card-tint-violet flex flex-col items-center justify-center gap-3 p-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-violet-200 text-accent-violet-700">
        <Users className="h-5 w-5" />
      </div>
      <div>
        <p className="text-sm font-semibold text-ink">Nenhum cliente cadastrado</p>
        <p className="mt-1 text-xs text-ink-subtle">
          Adicione seu primeiro cliente para começar a organizar tarefas
        </p>
      </div>
      <Link href="/admin/clientes" className="btn-primary mt-2">
        <Sparkles className="h-3.5 w-3.5" />
        Cadastrar cliente
      </Link>
    </div>
  );
}
