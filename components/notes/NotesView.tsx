'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  Plus,
  Search,
  Pin,
  PinOff,
  Trash2,
  Pencil,
  Loader2,
  StickyNote,
  Inbox,
  ArrowLeft,
  Check,
  ChevronDown,
} from 'lucide-react';
import {
  createNote,
  deleteNote,
  deleteNoteGroup,
  listNoteGroups,
  listNotes,
  updateNote,
} from '@/lib/notes';
import type { Note, NoteGroup } from '@/lib/types';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/ConfirmDialog';
import { Skeleton } from '@/components/Skeleton';
import { cn, formatRelative } from '@/lib/utils';
import { GroupModal } from './GroupModal';

const ALL_GROUP_ID = '__all__';
const NO_GROUP_ID = '__none__';

export function NotesView() {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [groups, setGroups] = useState<NoteGroup[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>(ALL_GROUP_ID);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<NoteGroup | null>(null);
  const [moveOpen, setMoveOpen] = useState(false);

  // Load all data on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const [g, n] = await Promise.all([listNoteGroups(), listNotes()]);
        if (!mounted) return;
        setGroups(g);
        setNotes(n);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Notes filtered by selected group
  const groupNotes = useMemo(() => {
    let arr = notes;
    if (selectedGroup === ALL_GROUP_ID) {
      arr = notes;
    } else if (selectedGroup === NO_GROUP_ID) {
      arr = notes.filter((n) => n.group_id === null);
    } else {
      arr = notes.filter((n) => n.group_id === selectedGroup);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      arr = arr.filter(
        (n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q),
      );
    }
    // Pinned first then by updated desc
    return [...arr].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }, [notes, selectedGroup, search]);

  const selectedNote = useMemo(
    () => notes.find((n) => n.id === selectedNoteId) ?? null,
    [notes, selectedNoteId],
  );

  // Counts per group
  const groupCounts = useMemo(() => {
    const m = new Map<string, number>();
    notes.forEach((n) => {
      if (n.group_id) m.set(n.group_id, (m.get(n.group_id) ?? 0) + 1);
    });
    return m;
  }, [notes]);
  const noGroupCount = notes.filter((n) => n.group_id === null).length;

  function applyNote(updated: Note) {
    setNotes((prev) => {
      const idx = prev.findIndex((n) => n.id === updated.id);
      if (idx === -1) return [updated, ...prev];
      const next = [...prev];
      next[idx] = updated;
      return next;
    });
  }

  async function handleCreateNote() {
    const groupId =
      selectedGroup === ALL_GROUP_ID || selectedGroup === NO_GROUP_ID
        ? null
        : selectedGroup;
    try {
      const n = await createNote({ group_id: groupId, title: '' });
      setNotes((prev) => [n, ...prev]);
      setSelectedNoteId(n.id);
    } catch {
      toast('Erro ao criar nota', 'error');
    }
  }

  function handleDeleteNote(id: string) {
    const note = notes.find((n) => n.id === id);
    confirm({
      title: 'Excluir nota?',
      message: (
        <span>
          A nota{' '}
          <span className="font-medium text-ink">
            "{note?.title || 'sem título'}"
          </span>{' '}
          será removida permanentemente.
        </span>
      ),
      confirmLabel: 'Excluir',
      tone: 'danger',
      onConfirm: async () => {
        try {
          await deleteNote(id);
          setNotes((prev) => prev.filter((n) => n.id !== id));
          if (selectedNoteId === id) setSelectedNoteId(null);
          toast('Nota excluída', 'success');
        } catch {
          toast('Erro ao excluir nota', 'error');
        }
      },
    });
  }

  async function handleTogglePin(note: Note) {
    const next = !note.pinned;
    applyNote({ ...note, pinned: next });
    try {
      const saved = await updateNote(note.id, { pinned: next });
      applyNote(saved);
    } catch {
      applyNote(note); // revert
      toast('Erro ao atualizar', 'error');
    }
  }

  async function handleMoveNote(note: Note, targetGroupId: string | null) {
    applyNote({ ...note, group_id: targetGroupId });
    try {
      const saved = await updateNote(note.id, { group_id: targetGroupId });
      applyNote(saved);
      toast('Nota movida', 'success');
    } catch {
      applyNote(note);
      toast('Erro ao mover', 'error');
    }
    setMoveOpen(false);
  }

  function handleDeleteGroup(g: NoteGroup) {
    const insideCount = notes.filter((n) => n.group_id === g.id).length;
    confirm({
      title: 'Excluir grupo?',
      message: (
        <span>
          O grupo{' '}
          <span className="font-medium text-ink">
            {g.icon} {g.name}
          </span>{' '}
          será removido permanentemente
          {insideCount > 0 && (
            <>
              , junto com{' '}
              <span className="font-medium text-ink">
                {insideCount} {insideCount === 1 ? 'nota' : 'notas'}
              </span>{' '}
              dentro dele
            </>
          )}
          .
        </span>
      ),
      confirmLabel: 'Excluir grupo',
      tone: 'danger',
      onConfirm: async () => {
        try {
          await deleteNoteGroup(g.id);
          setGroups((prev) => prev.filter((x) => x.id !== g.id));
          setNotes((prev) => prev.filter((n) => n.group_id !== g.id));
          if (selectedGroup === g.id) setSelectedGroup(ALL_GROUP_ID);
          toast('Grupo excluído', 'success');
        } catch {
          toast('Erro ao excluir grupo', 'error');
        }
      },
    });
  }

  return (
    <div className="flex h-full flex-col md:flex-row">
      {/* Left rail — Groups */}
      <aside
        className={cn(
          'flex w-full flex-none flex-col border-b border-border bg-surface-sunken md:w-56 md:border-b-0 md:border-r',
          // Hide groups on mobile when a note is selected
          selectedNoteId ? 'hidden md:flex' : 'flex',
        )}
      >
        <div className="flex items-center justify-between p-4">
          <h2 className="text-base font-semibold tracking-tight text-ink">Notas</h2>
          <button
            type="button"
            className="btn-icon"
            aria-label="Novo grupo"
            onClick={() => {
              setEditingGroup(null);
              setGroupModalOpen(true);
            }}
            title="Novo grupo"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-3">
          <GroupRow
            label="Todas"
            icon="✨"
            color="#7C3AED"
            count={notes.length}
            active={selectedGroup === ALL_GROUP_ID}
            onClick={() => setSelectedGroup(ALL_GROUP_ID)}
          />
          {loading
            ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2 px-2 py-1.5">
                  <Skeleton className="h-5 w-5 rounded-md" />
                  <Skeleton className="h-3 flex-1" />
                </div>
              ))
            : groups.map((g) => (
                <GroupRow
                  key={g.id}
                  label={g.name}
                  icon={g.icon}
                  color={g.color}
                  count={groupCounts.get(g.id) ?? 0}
                  active={selectedGroup === g.id}
                  onClick={() => setSelectedGroup(g.id)}
                  onEdit={() => {
                    setEditingGroup(g);
                    setGroupModalOpen(true);
                  }}
                  onDelete={() => handleDeleteGroup(g)}
                />
              ))}

          {noGroupCount > 0 && (
            <GroupRow
              label="Sem grupo"
              icon="🗒️"
              color="#5C5C66"
              count={noGroupCount}
              active={selectedGroup === NO_GROUP_ID}
              onClick={() => setSelectedGroup(NO_GROUP_ID)}
            />
          )}

          {!loading && groups.length === 0 && (
            <button
              type="button"
              onClick={() => {
                setEditingGroup(null);
                setGroupModalOpen(true);
              }}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border-strong px-2 py-2 text-xs text-ink-subtle hover:border-ink-faint hover:text-ink"
            >
              <Plus className="h-3 w-3" /> Criar primeiro grupo
            </button>
          )}
        </div>
      </aside>

      {/* Middle column — Notes list */}
      <section
        className={cn(
          'flex w-full flex-none flex-col border-b border-border md:w-80 md:border-b-0 md:border-r',
          selectedNoteId ? 'hidden md:flex' : 'flex',
        )}
      >
        <div className="flex items-center gap-2 p-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
            <input
              className="input pl-8"
              placeholder="Buscar nota..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={handleCreateNote}
            className="btn-primary px-2.5 py-2"
            aria-label="Nova nota"
            title="Nova nota"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-3">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          ) : groupNotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-card border border-dashed border-border-strong p-8 text-center">
              <Inbox className="h-5 w-5 text-ink-faint" />
              <p className="text-sm font-medium text-ink">
                {search ? 'Nenhum resultado' : 'Sem notas aqui'}
              </p>
              {!search && (
                <button onClick={handleCreateNote} className="btn-secondary mt-2">
                  <Plus className="h-3.5 w-3.5" /> Criar nota
                </button>
              )}
            </div>
          ) : (
            <ul className="space-y-1">
              {groupNotes.map((n) => (
                <NoteRow
                  key={n.id}
                  note={n}
                  group={groups.find((g) => g.id === n.group_id) ?? null}
                  active={selectedNoteId === n.id}
                  onClick={() => setSelectedNoteId(n.id)}
                />
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Right column — Editor */}
      <section className={cn('flex flex-1 flex-col', selectedNoteId ? 'flex' : 'hidden md:flex')}>
        {selectedNote ? (
          <NoteEditor
            key={selectedNote.id}
            note={selectedNote}
            groups={groups}
            onChange={applyNote}
            onDelete={() => handleDeleteNote(selectedNote.id)}
            onTogglePin={() => handleTogglePin(selectedNote)}
            onMove={(gid) => handleMoveNote(selectedNote, gid)}
            onBack={() => setSelectedNoteId(null)}
            moveOpen={moveOpen}
            setMoveOpen={setMoveOpen}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center p-10 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-sunken text-ink-faint">
                <StickyNote className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">Selecione uma nota</p>
                <p className="mt-0.5 text-xs text-ink-subtle">
                  Ou crie uma nova com o botão <span className="kbd">+</span> ao lado
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      <GroupModal
        open={groupModalOpen}
        onClose={() => setGroupModalOpen(false)}
        group={editingGroup}
        onSaved={(g) => {
          setGroups((prev) => {
            const idx = prev.findIndex((x) => x.id === g.id);
            if (idx === -1) return [...prev, g];
            const next = [...prev];
            next[idx] = g;
            return next;
          });
          if (!editingGroup) setSelectedGroup(g.id);
        }}
      />
    </div>
  );
}

// ── Group row ───────────────────────────────────────────────────────────────

function GroupRow({
  label,
  icon,
  color,
  count,
  active,
  onClick,
  onEdit,
  onDelete,
}: {
  label: string;
  icon: string;
  color: string;
  count: number;
  active: boolean;
  onClick: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div
      className={cn(
        'group/row mb-0.5 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
        active
          ? 'bg-surface-raised text-ink shadow-elevated'
          : 'text-ink-muted hover:bg-surface-raised/70 hover:text-ink',
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
      >
        <span
          className="flex h-5 w-5 flex-none items-center justify-center rounded text-xs"
          style={{ backgroundColor: `${color}22`, color }}
        >
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </button>
      <span className="tabular text-2xs text-ink-faint">{count}</span>
      {onEdit && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="hidden rounded p-0.5 text-ink-faint hover:bg-surface-sunken hover:text-ink group-hover/row:block"
          aria-label="Editar grupo"
        >
          <Pencil className="h-3 w-3" />
        </button>
      )}
      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="hidden rounded p-0.5 text-ink-faint hover:bg-accent-rose-50 hover:text-accent-rose-700 group-hover/row:block"
          aria-label="Excluir grupo"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

// ── Note row in middle column ──────────────────────────────────────────────

function NoteRow({
  note,
  group,
  active,
  onClick,
}: {
  note: Note;
  group: NoteGroup | null;
  active: boolean;
  onClick: () => void;
}) {
  const preview =
    note.content
      .replace(/[#*_`>-]/g, '')
      .split('\n')
      .find((l) => l.trim()) || '—';

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'block w-full rounded-lg border px-3 py-2.5 text-left transition-colors',
          active
            ? 'border-brand-300 bg-brand-50/40'
            : 'border-transparent hover:bg-surface-sunken/60',
        )}
      >
        <div className="flex items-center gap-1.5">
          {note.pinned && <Pin className="h-3 w-3 flex-none text-amber-500" />}
          <p className={cn('flex-1 truncate text-sm', active ? 'font-semibold text-ink' : 'font-medium text-ink')}>
            {note.title || 'Sem título'}
          </p>
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">{preview}</p>
        <div className="mt-1.5 flex items-center justify-between text-2xs text-ink-faint">
          <span>{formatRelative(note.updated_at)}</span>
          {group && (
            <span className="flex items-center gap-1">
              <span className="dot" style={{ backgroundColor: group.color }} />
              {group.name}
            </span>
          )}
        </div>
      </button>
    </li>
  );
}

// ── Note editor (right column) with autosave ───────────────────────────────

function NoteEditor({
  note,
  groups,
  onChange,
  onDelete,
  onTogglePin,
  onMove,
  onBack,
  moveOpen,
  setMoveOpen,
}: {
  note: Note;
  groups: NoteGroup[];
  onChange: (n: Note) => void;
  onDelete: () => void;
  onTogglePin: () => void;
  onMove: (groupId: string | null) => void;
  onBack: () => void;
  moveOpen: boolean;
  setMoveOpen: (v: boolean) => void;
}) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [savingState, setSavingState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moveDropdownRef = useRef<HTMLDivElement | null>(null);

  // Reset when switching to a different note
  useEffect(() => {
    setTitle(note.title);
    setContent(note.content);
    setSavingState('idle');
  }, [note.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useCallback(
    async (patch: { title?: string; content?: string }) => {
      setSavingState('saving');
      try {
        const saved = await updateNote(note.id, patch);
        onChange(saved);
        setSavingState('saved');
        setTimeout(() => setSavingState('idle'), 1500);
      } catch {
        setSavingState('idle');
      }
    },
    [note.id, onChange],
  );

  // Autosave on title/content change with debounce
  useEffect(() => {
    if (title === note.title && content === note.content) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void save({ title, content });
    }, 800);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [title, content, note.title, note.content, save]);

  // Click outside for move dropdown
  useEffect(() => {
    if (!moveOpen) return;
    const handler = (e: MouseEvent) => {
      if (moveDropdownRef.current && !moveDropdownRef.current.contains(e.target as Node)) {
        setMoveOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [moveOpen, setMoveOpen]);

  const currentGroup = groups.find((g) => g.id === note.group_id);

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-2">
        <button
          type="button"
          onClick={onBack}
          className="btn-icon md:hidden"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <div className="relative" ref={moveDropdownRef}>
          <button
            type="button"
            onClick={() => setMoveOpen(!moveOpen)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-raised px-2 py-1 text-xs font-medium text-ink-muted hover:bg-surface-sunken hover:text-ink"
          >
            {currentGroup ? (
              <>
                <span className="dot" style={{ backgroundColor: currentGroup.color }} />
                {currentGroup.name}
              </>
            ) : (
              <>
                <span className="dot bg-ink-faint" />
                Sem grupo
              </>
            )}
            <ChevronDown className="h-3 w-3" />
          </button>
          {moveOpen && (
            <div className="absolute left-0 top-full z-20 mt-1 w-56 overflow-hidden rounded-lg border border-border bg-surface-raised p-1 shadow-floating animate-scale-in">
              <button
                type="button"
                onClick={() => onMove(null)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-ink-muted hover:bg-surface-sunken hover:text-ink"
              >
                <span className="dot bg-ink-faint" />
                <span className="flex-1">Sem grupo</span>
                {note.group_id === null && <Check className="h-3 w-3 text-brand-600" />}
              </button>
              <div className="my-1 border-t border-border" />
              {groups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => onMove(g.id)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-ink-muted hover:bg-surface-sunken hover:text-ink"
                >
                  <span className="dot" style={{ backgroundColor: g.color }} />
                  <span className="flex-1 truncate">{g.icon} {g.name}</span>
                  {note.group_id === g.id && <Check className="h-3 w-3 text-brand-600" />}
                </button>
              ))}
              {groups.length === 0 && (
                <p className="px-2 py-2 text-xs text-ink-faint">Nenhum grupo criado</p>
              )}
            </div>
          )}
        </div>

        <span className="ml-auto text-2xs text-ink-faint">
          {savingState === 'saving' && (
            <span className="flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Salvando...
            </span>
          )}
          {savingState === 'saved' && (
            <span className="flex items-center gap-1 text-accent-emerald-700">
              <Check className="h-3 w-3" /> Salvo
            </span>
          )}
          {savingState === 'idle' && `Atualizado ${formatRelative(note.updated_at)}`}
        </span>

        <button
          type="button"
          onClick={onTogglePin}
          className="btn-icon"
          aria-label={note.pinned ? 'Desafixar' : 'Fixar'}
          title={note.pinned ? 'Desafixar' : 'Fixar'}
        >
          {note.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="btn-icon hover:bg-accent-rose-50 hover:text-accent-rose-700"
          aria-label="Excluir"
          title="Excluir"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Title */}
      <div className="flex-none px-6 pt-6">
        <input
          className="w-full bg-transparent text-3xl font-semibold tracking-tight text-ink placeholder:text-ink-faint focus:outline-none"
          placeholder="Sem título"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      {/* Content */}
      <textarea
        className="flex-1 resize-none bg-transparent px-6 py-4 text-sm leading-relaxed text-ink placeholder:text-ink-faint focus:outline-none"
        placeholder="Comece a escrever..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
    </div>
  );
}
