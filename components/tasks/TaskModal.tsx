'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { createTask, updateTask } from '@/lib/supabase';
import type { Priority, Recurrence, Status, Task, TaskInput } from '@/lib/types';
import {
  PRIORITIES,
  PRIORITY_LABEL,
  RECURRENCES,
  RECURRENCE_LABEL,
  REMINDER_OPTIONS,
  STATUS_LABEL,
  STATUSES,
} from '@/lib/utils';
import { Bell } from 'lucide-react';

export function TaskModal({
  open,
  onClose,
  onSaved,
  task,
  clientId,
  createdBy,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (task: Task) => void;
  task?: Task | null;
  clientId?: string | null;
  createdBy: 'admin' | 'client';
}) {
  const editing = Boolean(task);
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('média');
  const [status, setStatus] = useState<Status>('pendente');
  const [dueDate, setDueDate] = useState<string>('');
  const [recurrence, setRecurrence] = useState<Recurrence>('none');
  const [reminderOffset, setReminderOffset] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? '');
      setPriority(task.priority);
      setStatus(task.status);
      setDueDate(task.due_date ?? '');
      setRecurrence(task.recurrence);
      setReminderOffset(task.reminder_offset_minutes ?? null);
    } else {
      setTitle('');
      setDescription('');
      setPriority('média');
      setStatus('pendente');
      setDueDate('');
      setRecurrence('none');
      setReminderOffset(null);
    }
  }, [open, task]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const payload: TaskInput = {
        title: title.trim(),
        description: description.trim() || null,
        priority,
        status,
        due_date: dueDate || null,
        recurrence,
        client_id: clientId ?? null,
        created_by: createdBy,
        reminder_offset_minutes: reminderOffset,
        // Reset reminder_sent_at when offset/due_date changes so it can re-fire
        reminder_sent_at:
          task &&
          (task.reminder_offset_minutes !== reminderOffset || task.due_date !== (dueDate || null))
            ? null
            : undefined,
      };
      const saved = task
        ? await updateTask(task.id, payload)
        : await createTask(payload);
      onSaved(saved);
      toast(editing ? 'Tarefa atualizada' : 'Tarefa criada', 'success');
      onClose();
    } catch (err) {
      console.error(err);
      toast('Erro ao salvar tarefa', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Editar tarefa' : 'Nova tarefa'}
      width="lg"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="label" htmlFor="title">
            Título *
          </label>
          <input
            id="title"
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="desc">
            Descrição
          </label>
          <textarea
            id="desc"
            className="input min-h-[80px] resize-y"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Prioridade</label>
            <select
              className="input"
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select
              className="input"
              value={status}
              onChange={(e) => setStatus(e.target.value as Status)}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Prazo</label>
            <input
              type="date"
              className="input"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Recorrência</label>
            <select
              className="input"
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value as Recurrence)}
            >
              {RECURRENCES.map((r) => (
                <option key={r} value={r}>
                  {RECURRENCE_LABEL[r]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Reminder section */}
        <div className="rounded-lg border border-border bg-surface-sunken/50 p-3">
          <label className="label flex items-center gap-1.5">
            <Bell className="h-3 w-3" />
            Lembrete via WhatsApp
          </label>
          <select
            className="input"
            value={reminderOffset === null ? '' : String(reminderOffset)}
            onChange={(e) =>
              setReminderOffset(e.target.value === '' ? null : Number(e.target.value))
            }
            disabled={!dueDate}
          >
            {REMINDER_OPTIONS.map((opt) => (
              <option key={opt.label} value={opt.value === null ? '' : String(opt.value)}>
                {opt.label}
              </option>
            ))}
          </select>
          {!dueDate && (
            <p className="mt-1.5 text-2xs text-ink-faint">
              Defina um prazo acima para habilitar lembretes
            </p>
          )}
          {dueDate && reminderOffset !== null && (
            <p className="mt-1.5 text-2xs text-ink-subtle">
              {clientId
                ? 'Será enviado para o WhatsApp do cliente'
                : 'Será enviado para o seu WhatsApp (configurado em Configurações)'}
            </p>
          )}
        </div>
        <div className="mt-2 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={saving || !title.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? 'Salvar' : 'Criar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
