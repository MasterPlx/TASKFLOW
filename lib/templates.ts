/**
 * Tiny template renderer with {{key}} placeholders.
 * Used for WhatsApp message templates configurable via /admin/configuracoes.
 *
 * Example:
 *   render('Olá {{name}}! Você tem {{count}} tarefa(s)', { name: 'João', count: 3 })
 *   → 'Olá João! Você tem 3 tarefa(s)'
 */
export function render(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) =>
    vars[key] !== undefined ? String(vars[key]) : `{{${key}}}`,
  );
}
