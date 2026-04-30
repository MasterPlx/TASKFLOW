'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { createNoteGroup, updateNoteGroup } from '@/lib/notes';
import type { NoteGroup } from '@/lib/types';

const PRESET_EMOJIS = ['📝', '📦', '👤', '💼', '🏷️', '💬', '🚀', '⭐', '🎯', '🛒', '💰', '🔥'];
const PRESET_COLORS = [
  '#7C3AED', // violet
  '#0284C7', // sky
  '#059669', // emerald
  '#D97706', // amber
  '#DB2777', // pink
  '#E11D48', // rose
  '#EA580C', // peach
  '#475569', // slate
];

export function GroupModal({
  open,
  onClose,
  onSaved,
  group,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (g: NoteGroup) => void;
  group?: NoteGroup | null;
}) {
  const editing = Boolean(group);
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('📝');
  const [color, setColor] = useState('#7C3AED');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(group?.name ?? '');
    setIcon(group?.icon ?? '📝');
    setColor(group?.color ?? '#7C3AED');
  }, [open, group]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const saved = group
        ? await updateNoteGroup(group.id, { name: name.trim(), icon, color })
        : await createNoteGroup({ name: name.trim(), icon, color });
      onSaved(saved);
      toast(editing ? 'Grupo atualizado' : 'Grupo criado', 'success');
      onClose();
    } catch (err) {
      console.error(err);
      toast('Erro ao salvar grupo', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Editar grupo' : 'Novo grupo'} width="md">
      <form onSubmit={onSubmit} className="space-y-4">
        {/* Preview */}
        <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-sunken/50 p-3">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-xl text-lg shadow-elevated"
            style={{ backgroundColor: color, color: '#FFFFFF' }}
          >
            {icon}
          </span>
          <div>
            <p className="text-xs text-ink-subtle">Pré-visualização</p>
            <p className="truncate text-sm font-semibold text-ink">{name || 'Nome do grupo'}</p>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="gname">Nome *</label>
          <input
            id="gname"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: BMs Disponíveis"
            autoFocus
            required
          />
        </div>

        <div>
          <label className="label">Ícone</label>
          <div className="flex flex-wrap gap-1">
            {PRESET_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setIcon(e)}
                className={`flex h-9 w-9 items-center justify-center rounded-lg border text-lg transition-colors ${
                  icon === e
                    ? 'border-brand-400 bg-brand-50'
                    : 'border-border hover:bg-surface-sunken'
                }`}
              >
                {e}
              </button>
            ))}
          </div>
          <input
            className="input mt-2"
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            placeholder="Ou cole outro emoji aqui"
            maxLength={4}
          />
        </div>

        <div>
          <label className="label">Cor</label>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`h-7 w-7 rounded-full transition-transform ${
                  color === c ? 'ring-2 ring-ink ring-offset-2' : 'hover:scale-110'
                }`}
                style={{ backgroundColor: c }}
                aria-label={`Cor ${c}`}
              />
            ))}
            <input
              type="color"
              className="h-7 w-7 cursor-pointer rounded-full border-none"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={saving || !name.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? 'Salvar' : 'Criar grupo'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
