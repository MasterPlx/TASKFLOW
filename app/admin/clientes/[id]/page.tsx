'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, AlertCircle } from 'lucide-react';
import { getClientById } from '@/lib/supabase';
import type { Client } from '@/lib/types';
import { TasksView } from '@/components/tasks/TasksView';
import {
  notifyTaskCompletedByAdmin,
  notifyTaskCreatedByAdmin,
} from '@/lib/notifications';

export default function ClienteTasksPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let mounted = true;
    // Reset state when navigating between clients
    setLoading(true);
    setLoadError(null);
    setClient(null);
    (async () => {
      try {
        const c = await getClientById(id);
        if (!mounted) return;
        setClient(c);
      } catch (err) {
        console.error('[clientesId] load failed', err);
        if (mounted) setLoadError('Não foi possível carregar este cliente. Tente recarregar a página.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-6xl px-8 py-8">
        <div className="card-tint-rose flex items-start gap-3 p-4">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-none text-accent-rose-700" />
          <p className="text-sm text-accent-rose-700">{loadError}</p>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="mx-auto max-w-6xl px-8 py-8">
        <p className="text-sm text-ink-subtle">Cliente não encontrado.</p>
      </div>
    );
  }

  return (
    <TasksView
      title={client.brand_name ?? client.name}
      subtitle={client.phone ? `WhatsApp: ${client.phone}` : 'Tarefas do cliente'}
      clientId={client.id}
      createdBy="admin"
      authorName="Admin"
      brandColor={client.brand_color ?? undefined}
      onTaskCreated={(t) => notifyTaskCreatedByAdmin(client, t)}
      onTaskCompleted={(t) => notifyTaskCompletedByAdmin(client, t)}
    />
  );
}
