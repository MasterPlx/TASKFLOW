'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Loader2,
  Bell,
  Repeat,
  Flag,
  CircleDot,
  Calendar,
  Sparkles,
} from 'lucide-react';
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
  cn,
} from '@/lib/utils';

const PRIORITY_DOTS: Record<Priority, string> = {
  urgente: 'bg-accent-rose-600',
  alta: 'bg-accent-peach-600',
  média: 'bg-accent-amber-500',
  baixa: 'bg-accent-emerald-600',
};

const STATUS_DOTS: Record<Status, string> = {
  pendente: 'bg-ink-faint',
  andamento: 'bg-accent-sky-500',
  concluída: 'bg-accent-emerald-500',
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
function plusDaysISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function nextWeekday(weekday: number): string {
  // weekday: 0=Sunday … 5=Friday
  const d = new Date();
  const diff = (weekday - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

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

  // Disable reminder if there's no due_date
  useEffect(() => {
    if (!dueDate && reminderOffset !== null) setReminderOffset(null);
  }, [dueDate, reminderOffset]);

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
        reminder_sent_at:
          task &&
          (task.reminder_offset_minutes !== reminderOffset ||
            task.due_date !== (dueDate || null))
            ? null
            : undefined,
      };
      const saved = task ? await updateTask(task.id, payload) : await createTask(payload);
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

  // Quick-date chips — labels include relative day names ("Hoje", "Amanhã", weekday)
  const quickDates = useMemo(() => {
    const today = todayISO();
    const tomorrow = plusDaysISO(1);
    const friday = nextWeekday(5);
    const nextWeek = plusDaysISO(7);
    return [
      { label: 'Hoje', value: today },
      { label: 'Amanhã', value: tomorrow },
      { label: 'Sexta', value: friday },
      { label: '+7 dias', value: nextWeek },
    ];
  }, []);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Editar tarefa' : 'Nova tarefa'}
      width="lg"
    >
      <form onSubmit={onSubmit} className="space-y-5">
        {/* Title — Notion-style block input (large, borderless) */}
        <div>
          <input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            required
            placeholder="Nome da tarefa..."
            className={cn(
              'w-full bg-transparent text-xl font-semibold tracking-tight',
              'text-ink placeholder:text-ink-faint',
              'focus:outline-none',
            )}
          />
          <textarea
            id="desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Adicione uma descrição (opcional)..."
            rows={2}
            className={cn(
              'mt-1 w-full resize-none bg-transparent text-sm leading-relaxed',
              'text-ink-muted placeholder:text-ink-faint',
              'focus:outline-none',
            )}
          />
          <div className="-mx-1 h-px bg-border" />
        </div>

        {/* Type controls grid */}
        <div className="grid grid-cols-2 gap-3">
          <Field icon={<Flag className="h-3 w-3" />} label="Prioridade">
            <div className="flex flex-wrap gap-1">
              {PRIORITIES.map((p) => (
                <Pill
                  key={p}
                  active={priority === p}
                  onClick={() => setPriority(p)}
                  dot={PRIORITY_DOTS[p]}
                >
                  {PRIORITY_LABEL[p]}
                </Pill>
              ))}
            </div>
          </Field>
          <Field icon={<CircleDot className="h-3 w-3" />} label="Status">
            <div className="flex flex-wrap gap-1">
              {STATUSES.map((s) => (
                <Pill
                  key={s}
                  active={status === s}
                  onClick={() => setStatus(s)}
                  dot={STATUS_DOTS[s]}
                >
                  {STATUS_LABEL[s]}
                </Pill>
              ))}
            </div>
          </Field>
        </div>

        {/* Date with quick chips */}
        <Field icon={<Calendar className="h-3 w-3" />} label="Prazo">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              className="input max-w-[180px]"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
            <div className="flex flex-wrap gap-1">
              {quickDates.map((q) => (
                <Pill
                  key={q.label}
                  active={dueDate === q.value}
                  onClick={() => setDueDate(q.value)}
                >
                  {q.label}
                </Pill>
              ))}
              {dueDate && (
                <button
                  type="button"
                  onClick={() => setDueDate('')}
                  className="text-2xs text-ink-faint hover:text-ink-muted"
                >
                  limpar
                </button>
              )}
            </div>
          </div>
        </Field>

        {/* Recurrence */}
        <Field icon={<Repeat className="h-3 w-3" />} label="Recorrência">
          <div className="flex flex-wrap gap-1">
            {RECURRENCES.map((r) => (
              <Pill
                key={r}
                active={recurrence === r}
                onClick={() => setRecurrence(r)}
              >
                {RECURRENCE_LABEL[r]}
              </Pill>
            ))}
          </div>
        </Field>

        {/* Reminder — only useful with a due_date, visually emphasized when active */}
        <div
          className={cn(
            'rounded-lg border p-3 transition-colors',
            !dueDate
              ? 'border-dashed border-border-strong bg-surface-sunken/40'
              : reminderOffset !== null
                ? 'border-accent-amber-200 bg-accent-amber-50/60 dark:border-accent-amber-200/30 dark:bg-accent-amber-50/[.04]'
                : 'border-border bg-surface-sunken/30',
          )}
        >
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-ink-muted">
            <Bell className="h-3 w-3" />
            Lembrete via WhatsApp
            {!dueDate && (
              <span className="ml-auto text-2xs text-ink-faint">
                Defina um prazo para habilitar
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            {REMINDER_OPTIONS.map((opt) => (
              <Pill
                key={opt.label}
                active={reminderOffset === opt.value}
                onClick={() => setReminderOffset(opt.value)}
                disabled={!dueDate}
              >
                {opt.label}
              </Pill>
            ))}
          </div>
          {dueDate && reminderOffset !== null && (
            <p className="mt-2 text-2xs text-ink-subtle">
              {clientId
                ? 'Você (admin) será avisado no WhatsApp configurado'
                : 'Você (admin) será avisado no WhatsApp configurado'}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="btn-primary min-w-[120px]"
            disabled={saving || !title.trim()}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                {editing ? 'Salvar' : 'Criar tarefa'}
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Reusable bits ───────────────────────────────────────────────────────────

function Field({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-ink-muted">
        {icon}
        {label}
      </p>
      {children}
    </div>
  );
}

function Pill({
  children,
  active,
  onClick,
  disabled,
  dot,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick: () => void;
  disabled?: boolean;
  /** When provided, a small colored dot prefixes the label */
  dot?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all',
        active
          ? 'border-brand-300 bg-brand-50 text-brand-700 shadow-elevated dark:border-brand-400/40 dark:bg-brand-400/10 dark:text-brand-200'
          : 'border-border-strong bg-surface-raised text-ink-muted hover:border-ink-faint hover:bg-surface-sunken hover:text-ink',
        disabled && 'cursor-not-allowed opacity-40 hover:bg-surface-raised hover:text-ink-muted',
      )}
    >
      {dot && <span className={cn('dot', dot)} />}
      {children}
    </button>
  );
}
