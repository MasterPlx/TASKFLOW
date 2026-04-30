'use client';

import Link from 'next/link';
import { Copy, MessageCircle, ArrowRight, Trash2, Loader2, Phone } from 'lucide-react';
import { useState } from 'react';
import type { Client, Task } from '@/lib/types';
import { initials } from '@/lib/utils';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/ConfirmDialog';

export function ClientCard({
  client,
  pendingCount,
  totalCount,
  doneCount,
  pendingTasks,
  onDelete,
  onSendReminder,
}: {
  client: Client;
  pendingCount: number;
  totalCount: number;
  doneCount: number;
  pendingTasks: Task[];
  onDelete: (id: string) => Promise<void> | void;
  onSendReminder: (client: Client, pending: Task[]) => Promise<void> | void;
}) {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [busy, setBusy] = useState<'reminder' | 'delete' | null>(null);

  async function copyLink() {
    const url = `${window.location.origin}/c/${client.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      toast('Link copiado', 'success');
    } catch {
      toast('Não foi possível copiar', 'error');
    }
  }

  async function handleReminder() {
    if (!client.phone || !client.callmebot_key) {
      toast('Cliente sem WhatsApp ou API Key', 'error');
      return;
    }
    if (pendingCount === 0) {
      toast('Sem tarefas pendentes', 'info');
      return;
    }
    setBusy('reminder');
    try {
      await onSendReminder(client, pendingTasks);
      toast('Lembrete enviado', 'success');
    } catch {
      toast('Erro ao enviar lembrete', 'error');
    } finally {
      setBusy(null);
    }
  }

  function handleDelete() {
    const displayName = client.brand_name ?? client.name;
    confirm({
      title: 'Excluir cliente?',
      message: (
        <span>
          O cliente <span className="font-medium text-ink">"{displayName}"</span>{' '}
          será removido permanentemente, junto com{' '}
          <span className="font-medium text-ink">
            {totalCount} {totalCount === 1 ? 'tarefa' : 'tarefas'}
          </span>{' '}
          (incluindo comentários e anexos). O link público{' '}
          <span className="font-medium text-ink">/c/{client.slug}</span> também
          deixará de funcionar.
        </span>
      ),
      confirmLabel: 'Excluir cliente',
      tone: 'danger',
      onConfirm: async () => {
        setBusy('delete');
        try {
          await onDelete(client.id);
          toast('Cliente excluído', 'success');
        } catch {
          toast('Erro ao excluir', 'error');
        } finally {
          setBusy(null);
        }
      },
    });
  }

  const accent = client.brand_color ?? '#7C3AED';
  const percent = totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100);

  return (
    <div className="card group relative overflow-hidden p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-floating">
      {/* Color accent stripe at top */}
      <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: accent }} aria-hidden />

      <div className="flex items-start gap-3">
        {client.brand_logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={client.brand_logo_url}
            alt={client.brand_name ?? client.name}
            className="h-12 w-12 flex-none rounded-2xl object-cover shadow-elevated"
          />
        ) : (
          <span
            className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl text-sm font-semibold text-white shadow-elevated"
            style={{ backgroundColor: accent }}
          >
            {initials(client.brand_name ?? client.name)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-ink">
            {client.brand_name ?? client.name}
          </p>
          {client.phone ? (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-muted">
              <Phone className="h-3 w-3" /> {client.phone}
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-ink-faint">Sem WhatsApp configurado</p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="mt-5 grid grid-cols-3 gap-2 rounded-xl bg-surface-sunken p-3">
        <Stat label="Pendentes" value={pendingCount} tone={pendingCount > 0 ? 'amber' : 'mute'} />
        <Stat label="Concluídas" value={doneCount} tone="emerald" />
        <Stat label="Progresso" value={`${percent}%`} tone="brand" />
      </div>

      {/* Actions */}
      <div className="mt-4 flex items-center justify-between gap-2">
        <Link href={`/admin/clientes/${client.id}`} className="btn-ink flex-1 justify-center">
          Ver tarefas
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        <button
          type="button"
          onClick={copyLink}
          className="btn-icon h-9 w-9"
          aria-label="Copiar link do portal"
          title="Copiar link do portal"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={handleReminder}
          className="btn-icon h-9 w-9"
          disabled={busy === 'reminder'}
          aria-label="Enviar lembrete WhatsApp"
          title="Enviar lembrete WhatsApp"
        >
          {busy === 'reminder' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <MessageCircle className="h-3.5 w-3.5" />
          )}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          className="btn-icon h-9 w-9 hover:bg-accent-rose-50 hover:text-accent-rose-700"
          disabled={busy === 'delete'}
          aria-label="Excluir cliente"
          title="Excluir cliente"
        >
          {busy === 'delete' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: 'amber' | 'emerald' | 'brand' | 'mute';
}) {
  const text =
    tone === 'amber'
      ? 'text-accent-amber-700'
      : tone === 'emerald'
        ? 'text-accent-emerald-700'
        : tone === 'brand'
          ? 'text-brand-700'
          : 'text-ink-muted';
  return (
    <div className="text-center">
      <p className={`tabular text-base font-semibold ${text}`}>{value}</p>
      <p className="mt-0.5 text-2xs text-ink-subtle">{label}</p>
    </div>
  );
}
