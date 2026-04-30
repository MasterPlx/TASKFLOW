'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  CheckSquare,
  Users,
  Bell,
  LayoutDashboard,
  Settings,
  Sparkles,
  Sun,
  Moon,
  ArrowRight,
  Hash,
  StickyNote,
  Plus,
} from 'lucide-react';
import type { Client, Note, Task } from '@/lib/types';
import { listClients, listTasks } from '@/lib/supabase';
import { listNotes, createNote } from '@/lib/notes';
import { useTheme } from '@/lib/theme';
import { cn, initials } from '@/lib/utils';

interface Item {
  id: string;
  label: string;
  hint?: string;
  group: 'Navegar' | 'Clientes' | 'Tarefas' | 'Notas' | 'Ações';
  icon: React.ComponentType<{ className?: string }>;
  keywords?: string;
  onRun: () => void;
  accent?: string;
}

export function CommandPalette() {
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const [clients, setClients] = useState<Client[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Open via Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Fetch data when opening (cheap once-per-session caching)
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setHighlight(0);
    setTimeout(() => inputRef.current?.focus(), 30);
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    (async () => {
      const [c, t, n] = await Promise.all([listClients(), listTasks(), listNotes()]);
      if (!mounted) return;
      setClients(c);
      setTasks(t);
      setNotes(n);
    })();
    return () => {
      mounted = false;
    };
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const nav: Item[] = [
      {
        id: 'nav-dashboard',
        label: 'Dashboard',
        group: 'Navegar',
        icon: LayoutDashboard,
        onRun: () => router.push('/admin'),
      },
      {
        id: 'nav-tasks',
        label: 'Minhas tarefas',
        group: 'Navegar',
        icon: CheckSquare,
        onRun: () => router.push('/admin/tarefas'),
      },
      {
        id: 'nav-clients',
        label: 'Clientes',
        group: 'Navegar',
        icon: Users,
        onRun: () => router.push('/admin/clientes'),
      },
      {
        id: 'nav-notes',
        label: 'Notas',
        group: 'Navegar',
        icon: StickyNote,
        onRun: () => router.push('/admin/notas'),
      },
      {
        id: 'nav-notifications',
        label: 'Notificações',
        group: 'Navegar',
        icon: Bell,
        onRun: () => router.push('/admin/notificacoes'),
      },
      {
        id: 'nav-settings',
        label: 'Configurações',
        group: 'Navegar',
        icon: Settings,
        onRun: () => router.push('/admin/configuracoes'),
      },
    ];
    const actions: Item[] = [
      {
        id: 'action-new-note',
        label: 'Nova nota',
        group: 'Ações',
        icon: Plus,
        keywords: 'criar adicionar',
        onRun: async () => {
          const n = await createNote({ title: '' });
          router.push('/admin/notas');
          // Note: we can't pre-select the new note across navigation easily
          // without a more complex state mechanism. The user will see it at the top.
          void n;
        },
      },
      {
        id: 'action-theme',
        label: theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro',
        group: 'Ações',
        icon: theme === 'dark' ? Sun : Moon,
        onRun: () => toggle(),
      },
    ];
    const cs: Item[] = clients.map((c) => ({
      id: `client-${c.id}`,
      label: c.brand_name ?? c.name,
      hint: c.phone ?? undefined,
      group: 'Clientes',
      icon: Hash,
      keywords: `${c.name} ${c.brand_name ?? ''} ${c.slug}`,
      accent: c.brand_color ?? '#7C3AED',
      onRun: () => router.push(`/admin/clientes/${c.id}`),
    }));
    const ts: Item[] = tasks.slice(0, 50).map((t) => {
      const c = clients.find((cli) => cli.id === t.client_id);
      const dest = c ? `/admin/clientes/${c.id}` : '/admin/tarefas';
      return {
        id: `task-${t.id}`,
        label: t.title,
        hint: c ? c.brand_name ?? c.name : 'Tarefas internas',
        group: 'Tarefas',
        icon: CheckSquare,
        keywords: `${t.title} ${t.priority} ${t.status}`,
        onRun: () => router.push(dest),
      };
    });
    const ns: Item[] = notes.slice(0, 50).map((n) => ({
      id: `note-${n.id}`,
      label: n.title || 'Sem título',
      hint: n.content.slice(0, 60).replace(/\n/g, ' ') || undefined,
      group: 'Notas',
      icon: StickyNote,
      keywords: n.content,
      onRun: () => router.push('/admin/notas'),
    }));
    return [...nav, ...actions, ...cs, ...ts, ...ns];
  }, [router, clients, tasks, notes, theme, toggle]);

  // Fuzzy-ish filter: match every word
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    const tokens = q.split(/\s+/);
    return items.filter((i) => {
      const hay = `${i.label} ${i.hint ?? ''} ${i.keywords ?? ''} ${i.group}`.toLowerCase();
      return tokens.every((tok) => hay.includes(tok));
    });
  }, [items, query]);

  // Keep highlight in range
  useEffect(() => {
    if (highlight >= filtered.length) setHighlight(0);
  }, [filtered, highlight]);

  function runItem(idx: number) {
    const item = filtered[idx];
    if (!item) return;
    item.onRun();
    setOpen(false);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      runItem(highlight);
    }
  }

  // Group filtered items
  const groups = useMemo(() => {
    const map = new Map<string, Item[]>();
    filtered.forEach((i) => {
      const arr = map.get(i.group) ?? [];
      arr.push(i);
      map.set(i.group, arr);
    });
    return Array.from(map.entries());
  }, [filtered]);

  if (!open) return null;

  // Build a flat index → group/local position map so we know which one is highlighted
  let flatIdx = 0;

  return (
    <div className="fixed inset-0 z-[150] flex items-start justify-center p-4 pt-[10vh]">
      <div
        className="absolute inset-0 bg-ink/40 backdrop-blur-[3px] animate-fade-in"
        onClick={() => setOpen(false)}
        aria-hidden
      />
      <div className="relative w-full max-w-xl animate-scale-in">
        <div className="overflow-hidden rounded-2xl border border-border bg-surface-raised shadow-floating">
          {/* Search bar */}
          <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
            <Search className="h-4 w-4 flex-none text-ink-faint" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Buscar tarefas, clientes ou ações..."
              className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none"
            />
            <span className="kbd">esc</span>
          </div>

          {/* Results */}
          <div className="max-h-[50vh] overflow-y-auto p-2">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                <Sparkles className="h-5 w-5 text-ink-faint" />
                <p className="text-sm text-ink-muted">Nenhum resultado para "{query}"</p>
              </div>
            ) : (
              groups.map(([group, list]) => (
                <div key={group} className="mb-2 last:mb-0">
                  <p className="px-2 pb-1 pt-2 text-2xs font-semibold uppercase tracking-wider text-ink-faint">
                    {group}
                  </p>
                  <ul>
                    {list.map((item) => {
                      const myIdx = flatIdx++;
                      const active = highlight === myIdx;
                      const Icon = item.icon;
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            onMouseEnter={() => setHighlight(myIdx)}
                            onClick={() => runItem(myIdx)}
                            className={cn(
                              'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                              active
                                ? 'bg-surface-sunken text-ink'
                                : 'text-ink-muted hover:bg-surface-sunken/60',
                            )}
                          >
                            {item.group === 'Clientes' ? (
                              <span
                                className="flex h-6 w-6 flex-none items-center justify-center rounded-md text-2xs font-semibold text-white"
                                style={{ backgroundColor: item.accent ?? '#7C3AED' }}
                              >
                                {initials(item.label)}
                              </span>
                            ) : (
                              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-md bg-surface-sunken text-ink-subtle">
                                <Icon className="h-3.5 w-3.5" />
                              </span>
                            )}
                            <span className="flex-1 truncate">{item.label}</span>
                            {item.hint && (
                              <span className="truncate text-xs text-ink-faint">{item.hint}</span>
                            )}
                            {active && (
                              <ArrowRight className="h-3.5 w-3.5 flex-none text-ink-subtle" />
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))
            )}
          </div>

          {/* Footer hint */}
          <div className="flex items-center justify-between border-t border-border bg-surface-sunken px-4 py-2 text-2xs text-ink-faint">
            <div className="flex items-center gap-2">
              <span className="kbd">↑</span>
              <span className="kbd">↓</span>
              navegar
            </div>
            <div className="flex items-center gap-2">
              <span className="kbd">↵</span>
              abrir
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
