'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Users, Sparkles } from 'lucide-react';
import { deleteClient, listClients, listTasks } from '@/lib/supabase';
import type { Client, Task } from '@/lib/types';
import { ClientCard } from '@/components/clients/ClientCard';
import { ClientModal } from '@/components/clients/ClientModal';
import { sendReminder } from '@/lib/notifications';

export default function ClientesPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [c, t] = await Promise.all([listClients(), listTasks()]);
      if (!mounted) return;
      setClients(c);
      setTasks(t);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const stats = useMemo(() => {
    const pending = new Map<string, Task[]>();
    const total = new Map<string, number>();
    const done = new Map<string, number>();
    tasks.forEach((t) => {
      if (!t.client_id) return;
      total.set(t.client_id, (total.get(t.client_id) ?? 0) + 1);
      if (t.status === 'concluída') {
        done.set(t.client_id, (done.get(t.client_id) ?? 0) + 1);
      } else {
        const arr = pending.get(t.client_id) ?? [];
        arr.push(t);
        pending.set(t.client_id, arr);
      }
    });
    return { pending, total, done };
  }, [tasks]);

  async function handleDelete(id: string) {
    await deleteClient(id);
    setClients((prev) => prev.filter((c) => c.id !== id));
    setTasks((prev) => prev.filter((t) => t.client_id !== id));
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:px-10 md:py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-ink">Clientes</h1>
          <p className="mt-1.5 text-sm text-ink-muted">
            Gerencie sua carteira e gere links únicos para cada marca
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          Novo cliente
        </button>
      </header>

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="card p-5">
              <div className="flex items-center gap-3">
                <div className="skeleton h-12 w-12 rounded-2xl" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-4 w-1/2" />
                  <div className="skeleton h-3 w-1/3" />
                </div>
              </div>
              <div className="skeleton mt-5 h-16 rounded-xl" />
            </div>
          ))}
        </div>
      ) : clients.length === 0 ? (
        <EmptyState onCreate={() => setOpen(true)} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {clients.map((c) => {
            const pending = stats.pending.get(c.id) ?? [];
            return (
              <ClientCard
                key={c.id}
                client={c}
                pendingCount={pending.length}
                pendingTasks={pending}
                totalCount={stats.total.get(c.id) ?? 0}
                doneCount={stats.done.get(c.id) ?? 0}
                onDelete={handleDelete}
                onSendReminder={sendReminder}
              />
            );
          })}
        </div>
      )}

      <ClientModal
        open={open}
        onClose={() => setOpen(false)}
        onCreated={(c) => setClients((prev) => [c, ...prev])}
      />
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="card-tint-violet flex flex-col items-center justify-center gap-3 p-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-violet-200 text-accent-violet-700">
        <Users className="h-5 w-5" />
      </div>
      <div>
        <p className="text-sm font-semibold text-ink">Nenhum cliente cadastrado</p>
        <p className="mt-1 text-xs text-ink-subtle">
          Adicione seu primeiro cliente para começar a organizar tarefas
        </p>
      </div>
      <button onClick={onCreate} className="btn-primary mt-2">
        <Sparkles className="h-3.5 w-3.5" />
        Cadastrar primeiro cliente
      </button>
    </div>
  );
}
