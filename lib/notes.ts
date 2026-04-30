import { supabase } from './supabase';
import type { Note, NoteGroup, NoteGroupInput, NoteInput } from './types';

// ── Groups ──────────────────────────────────────────────────────────────────

export async function listNoteGroups(): Promise<NoteGroup[]> {
  const { data, error } = await supabase
    .from('note_groups')
    .select('*')
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as NoteGroup[];
}

export async function createNoteGroup(input: NoteGroupInput): Promise<NoteGroup> {
  const { data, error } = await supabase
    .from('note_groups')
    .insert({
      name: input.name,
      color: input.color ?? '#7C3AED',
      icon: input.icon ?? '📝',
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as NoteGroup;
}

export async function updateNoteGroup(
  id: string,
  patch: Partial<NoteGroupInput>,
): Promise<NoteGroup> {
  const { data, error } = await supabase
    .from('note_groups')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as NoteGroup;
}

export async function deleteNoteGroup(id: string): Promise<void> {
  const { error } = await supabase.from('note_groups').delete().eq('id', id);
  if (error) throw error;
}

// ── Notes ───────────────────────────────────────────────────────────────────

export async function listNotes(filter?: {
  groupId?: string | null;
}): Promise<Note[]> {
  let query = supabase
    .from('notes')
    .select('*')
    .order('pinned', { ascending: false })
    .order('updated_at', { ascending: false });
  if (filter?.groupId === null) query = query.is('group_id', null);
  else if (filter?.groupId) query = query.eq('group_id', filter.groupId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Note[];
}

export async function getNote(id: string): Promise<Note | null> {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as Note | null) ?? null;
}

export async function createNote(input: NoteInput = {}): Promise<Note> {
  const { data, error } = await supabase
    .from('notes')
    .insert({
      group_id: input.group_id ?? null,
      title: input.title ?? '',
      content: input.content ?? '',
      pinned: input.pinned ?? false,
      color: input.color ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as Note;
}

export async function updateNote(id: string, patch: Partial<NoteInput>): Promise<Note> {
  const { data, error } = await supabase
    .from('notes')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as Note;
}

export async function deleteNote(id: string): Promise<void> {
  const { error } = await supabase.from('notes').delete().eq('id', id);
  if (error) throw error;
}
