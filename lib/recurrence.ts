import { createTask } from './supabase';
import type { Task } from './types';
import { nextDueDate } from './utils';

export interface RecurrenceResult {
  created: Task | null;
  nextDate: string | null;
}

/**
 * When a recurring task is marked as "concluída", spawn an identical task in
 * "pendente" with the next due_date based on the recurrence rule.
 * Returns the new task (if any) and the new due date, so the caller can
 * surface a "reagendada para X" toast.
 */
export async function maybeReschedule(task: Task): Promise<RecurrenceResult> {
  if (task.recurrence === 'none') return { created: null, nextDate: null };
  const nextDate = nextDueDate(task.due_date, task.recurrence);
  const created = await createTask({
    title: task.title,
    description: task.description ?? null,
    priority: task.priority,
    status: 'pendente',
    due_date: nextDate,
    recurrence: task.recurrence,
    client_id: task.client_id ?? null,
    created_by: task.created_by,
  });
  return { created, nextDate };
}
