'use client';

import { useEffect, useRef, useState } from 'react';
import {
  X,
  Paperclip,
  MessageSquare,
  Trash2,
  Pencil,
  ExternalLink,
  Send,
  Loader2,
  Upload,
  Link2,
} from 'lucide-react';
import {
  createAttachment,
  createComment,
  deleteAttachment,
  deleteComment,
  deleteTask,
  listAttachments,
  listComments,
  uploadAttachmentFile,
} from '@/lib/supabase';
import type { Attachment, Comment, Task } from '@/lib/types';
import { PriorityBadge, RecurrenceBadge, StatusBadge } from '@/components/Badges';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/ConfirmDialog';
import { formatDate, formatRelative, isOverdue, initials, cn } from '@/lib/utils';

export function TaskDetail({
  task,
  open,
  onClose,
  onEdit,
  onDeleted,
  authorName,
  readOnly = false,
  brandColor,
}: {
  task: Task | null;
  open: boolean;
  onClose: () => void;
  onEdit?: (t: Task) => void;
  onDeleted?: (id: string) => void;
  authorName: string;
  readOnly?: boolean;
  brandColor?: string;
}) {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [comments, setComments] = useState<Comment[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [comment, setComment] = useState('');
  const [posting, setPosting] = useState(false);
  const [showUrlForm, setShowUrlForm] = useState(false);
  const [urlField, setUrlField] = useState('');
  const [nameField, setNameField] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!task || !open) return;
    let mounted = true;
    setLoading(true);
    (async () => {
      const [cs, as] = await Promise.all([listComments(task.id), listAttachments(task.id)]);
      if (!mounted) return;
      setComments(cs);
      setAttachments(as);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [task, open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!task) return null;

  async function handlePostComment(e?: React.FormEvent) {
    e?.preventDefault();
    if (!task || !comment.trim()) return;
    setPosting(true);
    try {
      const c = await createComment({
        task_id: task.id,
        author: authorName,
        content: comment.trim(),
      });
      setComments((prev) => [...prev, c]);
      setComment('');
    } catch (err) {
      console.error(err);
      toast('Erro ao enviar comentário', 'error');
    } finally {
      setPosting(false);
    }
  }

  function handleDeleteComment(id: string) {
    confirm({
      title: 'Excluir comentário?',
      message: 'O comentário será removido permanentemente.',
      confirmLabel: 'Excluir',
      tone: 'danger',
      onConfirm: async () => {
        try {
          await deleteComment(id);
          setComments((prev) => prev.filter((c) => c.id !== id));
        } catch {
          toast('Erro ao excluir comentário', 'error');
        }
      },
    });
  }

  async function handleAddUrlAttachment() {
    if (!task || !urlField.trim()) return;
    try {
      const a = await createAttachment({
        task_id: task.id,
        file_name: nameField.trim() || urlField.trim(),
        file_url: urlField.trim(),
      });
      setAttachments((prev) => [...prev, a]);
      setUrlField('');
      setNameField('');
      setShowUrlForm(false);
      toast('Anexo adicionado', 'success');
    } catch {
      toast('Erro ao adicionar anexo', 'error');
    }
  }

  async function handleUploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!task || !file) return;
    setUploading(true);
    try {
      const { url } = await uploadAttachmentFile(task.id, file);
      const a = await createAttachment({
        task_id: task.id,
        file_name: file.name,
        file_url: url,
        file_size: file.size,
        mime_type: file.type || null,
      });
      setAttachments((prev) => [...prev, a]);
      toast('Arquivo enviado', 'success');
    } catch (err) {
      console.error(err);
      toast('Erro ao enviar arquivo', 'error');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function handleDeleteAttachment(id: string, fileName: string) {
    confirm({
      title: 'Remover anexo?',
      message: (
        <span>
          O anexo <span className="font-medium text-ink">"{fileName}"</span> será
          removido. O arquivo no Storage não é apagado automaticamente.
        </span>
      ),
      confirmLabel: 'Remover',
      tone: 'danger',
      onConfirm: async () => {
        try {
          await deleteAttachment(id);
          setAttachments((prev) => prev.filter((a) => a.id !== id));
        } catch {
          toast('Erro ao remover anexo', 'error');
        }
      },
    });
  }

  function handleDeleteTask() {
    if (!task || !onDeleted) return;
    confirm({
      title: 'Excluir tarefa?',
      message: (
        <span>
          A tarefa <span className="font-medium text-ink">"{task.title}"</span> será
          removida permanentemente, junto com todos os comentários e anexos.
        </span>
      ),
      confirmLabel: 'Excluir',
      tone: 'danger',
      onConfirm: async () => {
        try {
          await deleteTask(task.id);
          onDeleted(task.id);
          toast('Tarefa excluída', 'success');
          onClose();
        } catch {
          toast('Erro ao excluir tarefa', 'error');
        }
      },
    });
  }

  const overdue = isOverdue(task.due_date, task.status);
  const accent = brandColor ?? '#7C3AED';

  return (
    <div className={`fixed inset-0 z-40 ${open ? '' : 'pointer-events-none'}`}>
      <div
        className={`absolute inset-0 bg-ink/30 backdrop-blur-[2px] transition-opacity duration-200 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
        aria-hidden
      />
      <aside
        className={`absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-border bg-surface-raised shadow-floating transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <header className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold tracking-tight text-ink">{task.title}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <PriorityBadge priority={task.priority} />
              <StatusBadge status={task.status} />
              <RecurrenceBadge recurrence={task.recurrence} />
              {task.due_date && (
                <span
                  className={cn(
                    'badge border',
                    overdue
                      ? 'border-accent-rose-200 bg-accent-rose-50 text-accent-rose-700'
                      : 'border-border bg-surface-sunken text-ink-muted',
                  )}
                >
                  {formatDate(task.due_date)}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="-mr-1 -mt-1 rounded-md p-1 text-ink-faint transition-colors hover:bg-surface-sunken hover:text-ink"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {task.description && (
            <section className="mb-6">
              <h3 className="section-label mb-2">Descrição</h3>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-muted">
                {task.description}
              </p>
            </section>
          )}

          <section className="mb-6">
            <h3 className="section-label mb-2 flex items-center gap-1.5">
              <Paperclip className="h-3 w-3" />
              Anexos · <span className="tabular text-ink-faint">{attachments.length}</span>
            </h3>
            {attachments.length > 0 && (
              <ul className="mb-2 space-y-1">
                {attachments.map((a) => (
                  <li
                    key={a.id}
                    className="group flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:border-border-strong hover:bg-surface-sunken/50"
                  >
                    <a
                      href={a.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex min-w-0 flex-1 items-center gap-2 text-ink hover:text-brand-700"
                    >
                      <ExternalLink className="h-3.5 w-3.5 flex-none text-ink-faint" />
                      <span className="truncate">{a.file_name}</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => handleDeleteAttachment(a.id, a.file_name)}
                      className="ml-2 hidden rounded p-1 text-ink-faint hover:bg-accent-rose-50 hover:text-accent-rose-700 group-hover:block"
                      aria-label="Remover anexo"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="btn-secondary"
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                Enviar arquivo
              </button>
              <input ref={fileRef} type="file" className="hidden" onChange={handleUploadFile} />
              <button
                type="button"
                onClick={() => setShowUrlForm((v) => !v)}
                className="btn-secondary"
              >
                <Link2 className="h-3.5 w-3.5" />
                Adicionar URL
              </button>
            </div>

            {showUrlForm && (
              <div className="mt-3 space-y-2 rounded-lg border border-border bg-surface-sunken/50 p-3">
                <input
                  className="input"
                  placeholder="https://..."
                  value={urlField}
                  onChange={(e) => setUrlField(e.target.value)}
                />
                <input
                  className="input"
                  placeholder="Nome (opcional)"
                  value={nameField}
                  onChange={(e) => setNameField(e.target.value)}
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowUrlForm(false)}
                    className="btn-ghost"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleAddUrlAttachment}
                    className="btn-primary"
                    disabled={!urlField.trim()}
                  >
                    Adicionar
                  </button>
                </div>
              </div>
            )}
          </section>

          <section>
            <h3 className="section-label mb-3 flex items-center gap-1.5">
              <MessageSquare className="h-3 w-3" />
              Comentários · <span className="tabular text-ink-faint">{comments.length}</span>
            </h3>
            {loading ? (
              <div className="flex items-center justify-center py-6 text-ink-faint">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : comments.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border-strong px-3 py-4 text-center text-xs text-ink-faint">
                Nenhum comentário ainda
              </p>
            ) : (
              <ul className="space-y-3">
                {comments.map((c) => (
                  <li key={c.id} className="group flex gap-3">
                    <span
                      className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-2xs font-semibold text-white"
                      style={{ backgroundColor: accent }}
                    >
                      {initials(c.author)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-2xs text-ink-subtle">
                        <span className="font-semibold text-ink">{c.author}</span>
                        <span className="text-ink-faint">·</span>
                        <span>{formatRelative(c.created_at)}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteComment(c.id)}
                          className="ml-auto hidden rounded p-0.5 text-ink-faint hover:bg-accent-rose-50 hover:text-accent-rose-700 group-hover:block"
                          aria-label="Excluir comentário"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink-muted">
                        {c.content}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <form onSubmit={handlePostComment} className="mt-4 flex items-end gap-2">
              <textarea
                className="input min-h-[40px] resize-none"
                placeholder="Escrever comentário..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handlePostComment();
                  }
                }}
              />
              <button
                type="submit"
                className="btn-primary"
                disabled={posting || !comment.trim()}
                aria-label="Enviar"
              >
                {posting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
              </button>
            </form>
          </section>
        </div>

        {!readOnly && (
          <footer className="flex items-center justify-end gap-2 border-t border-border p-4">
            <button type="button" onClick={handleDeleteTask} className="btn-danger">
              <Trash2 className="h-3.5 w-3.5" /> Excluir
            </button>
            <button type="button" onClick={() => onEdit?.(task)} className="btn-ink">
              <Pencil className="h-3.5 w-3.5" /> Editar
            </button>
          </footer>
        )}
      </aside>
    </div>
  );
}
