'use client';

import { TasksView } from '@/components/tasks/TasksView';

export default function MinhasTarefasPage() {
  return (
    <TasksView
      title="Minhas Tarefas"
      subtitle="Tarefas internas, sem cliente associado"
      clientId={null}
      createdBy="admin"
      authorName="Admin"
    />
  );
}
