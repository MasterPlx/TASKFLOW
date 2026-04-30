'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bell, CheckCircle2, Loader2, XCircle, Clock } from 'lucide-react';
import {
  listClients,
  listNotifications,
  listTasks,
} from '@/lib/supabase';
import type { Client, Notification, NotificationStatus, Task } from '@/lib/types';
import { cn, formatRelative, initials } from '@/lib/utils';
import { SkeletonRow } from '@/components/Skeleton';

type FilterId = 'all' | NotificationStatus;

const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'sent', label: 'Enviadas' },
  { id: 'failed', label: 'Falharam' },
  { id: 'pending', label: 'Pendentes' },
];

export default function NotificacoesPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterId>('all');

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [n, c, t] = await Promise.all([listNotifications(), listClients(), listTasks()]);
      if (!mounted) return;
      setItems(n);
      setClients(c);
      setTasks(t);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const clientMap = useMemo(() => {
    const m = new Map<string, Client>();
    clients.forEach((c) => m.set(c.id, c));
    return m;
  }, [clients]);

  const taskMap = useMemo(() => {
    const m = new Map<string, Task>();
    tasks.forEach((t) => m.set(t.id, t));
    return m;
  }, [tasks]);

  const filtered = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter((n) => n.status === filter);
  }, [items, filter]);

  const counts = useMemo(() => {
    return {
      sent: items.filter((n) => n.status === 'sent').length,
      failed: items.filter((n) => n.status === 'failed').length,
      pending: items.filter((n) => n.status === 'pending').length,
    };
  }, [items]);

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 md:px-10 md:py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Notificações</h1>
        <p className="mt-1.5 text-sm text-ink-muted">
          Histórico de mensagens WhatsApp enviadas via CallMeBot
        </p>
      </header>

      {/* Stats */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        <StatCard
          label="Enviadas"
          value={counts.sent}
          icon={CheckCircle2}
          tint="emerald"
        />
        <StatCard label="Falharam" value={counts.failed} icon={XCircle} tint="rose" />
        <StatCard label="Pendentes" value={counts.pending} icon={Clock} tint="amber" />
      </div>

      {/* Filter pills */}
      <div className="mb-4 flex flex-wrap gap-1">
        {FILTERS.map((f) => {
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs font-medium transition-all',
                active
                  ? 'bg-ink text-white shadow-elevated'
                  : 'border border-border bg-surface-raised text-ink-muted hover:bg-surface-sunken hover:text-ink',
              )}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card-tint-violet flex flex-col items-center justify-center gap-3 p-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-violet-200 text-accent-violet-700">
            <Bell className="h-5 w-5" />
          </div>
          <p className="text-sm font-semibold text-ink">Nenhuma notificação ainda</p>
          <p className="text-xs text-ink-subtle">
            Quando você criar tarefas para clientes, as mensagens aparecem aqui
          </p>
        </div>
      ) : (
        // Timeline-style feed
        <ol className="relative space-y-3 border-l border-border pl-6">
          {filtered.map((n) => (
            <NotificationItem
              key={n.id}
              n={n}
              client={n.client_id ? clientMap.get(n.client_id) ?? null : null}
              task={n.task_id ? taskMap.get(n.task_id) ?? null : null}
            />
          ))}
        </ol>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tint,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tint: 'emerald' | 'rose' | 'amber';
}) {
  const styles =
    tint === 'emerald'
      ? { bg: 'card-tint-emerald', icon: 'bg-accent-emerald-200 text-accent-emerald-700', value: 'text-accent-emerald-700' }
      : tint === 'rose'
        ? { bg: 'card-tint-rose', icon: 'bg-accent-rose-200 text-accent-rose-700', value: 'text-accent-rose-700' }
        : { bg: 'card-tint-amber', icon: 'bg-accent-amber-200 text-accent-amber-700', value: 'text-accent-amber-700' };
  return (
    <div className={cn(styles.bg, 'p-4')}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-ink-muted">{label}</p>
        <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg', styles.icon)}>
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <p className={cn('tabular mt-2 text-2xl font-semibold', styles.value)}>{value}</p>
    </div>
  );
}

function NotificationItem({
  n,
  client,
  task,
}: {
  n: Notification;
  client: Client | null;
  task: Task | null;
}) {
  const styles =
    n.status === 'sent'
      ? { dot: 'bg-accent-emerald-500', badge: 'bg-accent-emerald-100 text-accent-emerald-700 border-accent-emerald-200/70', label: 'Enviada' }
      : n.status === 'failed'
        ? { dot: 'bg-accent-rose-500', badge: 'bg-accent-rose-100 text-accent-rose-700 border-accent-rose-200/70', label: 'Falhou' }
        : { dot: 'bg-accent-amber-500', badge: 'bg-accent-amber-100 text-accent-amber-700 border-accent-amber-200/70', label: 'Pendente' };

  const accent = client?.brand_color ?? '#7C3AED';
  const name = client ? client.brand_name ?? client.name : 'Sem cliente';

  return (
    <li className="relative">
      {/* Timeline dot */}
      <span
        className={cn(
          'absolute -left-[27px] top-3 h-2 w-2 rounded-full ring-4 ring-surface',
          styles.dot,
        )}
        aria-hidden
      />
      <div className="card p-4">
        <div className="mb-2 flex items-center gap-2">
          <span
            className="flex h-6 w-6 items-center justify-center rounded-full text-2xs font-semibold text-white"
            style={{ backgroundColor: accent }}
          >
            {initials(name)}
          </span>
          <span className="text-sm font-medium text-ink">{name}</span>
          {task && (
            <>
              <span className="text-ink-faint">·</span>
              <span className="truncate text-sm text-ink-muted">{task.title}</span>
            </>
          )}
          <span className={cn('badge ml-auto border', styles.badge)}>{styles.label}</span>
        </div>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-muted">{n.message}</p>
        <p className="mt-2 text-2xs text-ink-faint">{formatRelative(n.sent_at)}</p>
      </div>
    </li>
  );
}
