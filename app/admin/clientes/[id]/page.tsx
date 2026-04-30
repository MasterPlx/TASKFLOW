'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { getClientById } from '@/lib/supabase';
import type { Client } from '@/lib/types';
import { TasksView } from '@/components/tasks/TasksView';
import { notifyTaskCreatedByAdmin } from '@/lib/notifications';

export default function ClienteTasksPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let mounted = true;
    (async () => {
      const c = await getClientById(id);
      if (!mounted) return;
      setClient(c);
      setLoading(false);
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

  if (!client) {
    return (
      <div className="mx-auto max-w-6xl px-8 py-8">
        <p className="text-sm text-gray-500">Cliente não encontrado.</p>
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
    />
  );
}
