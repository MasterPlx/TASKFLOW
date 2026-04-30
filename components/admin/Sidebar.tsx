'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  CheckSquare,
  Users,
  Bell,
  LogOut,
  Sparkles,
  Sun,
  Moon,
  Search,
  Settings,
  StickyNote,
  type LucideIcon,
} from 'lucide-react';
import { listClients, listTasks } from '@/lib/supabase';
import { useAdminAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { initials, cn } from '@/lib/utils';
import type { Client, Task } from '@/lib/types';
import { Skeleton } from '@/components/Skeleton';

interface ClientWithCount extends Client {
  pending: number;
}

export function Sidebar() {
  const pathname = usePathname();
  const { logout } = useAdminAuth();
  const { theme, toggle } = useTheme();
  const [clients, setClients] = useState<ClientWithCount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [cs, ts] = await Promise.all([listClients(), listTasks()]);
        if (!mounted) return;
        const counts = new Map<string, number>();
        ts.forEach((t: Task) => {
          if (t.status !== 'concluída' && t.client_id) {
            counts.set(t.client_id, (counts.get(t.client_id) ?? 0) + 1);
          }
        });
        setClients(cs.map((c) => ({ ...c, pending: counts.get(c.id) ?? 0 })));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [pathname]);

  return (
    <aside className="flex h-full w-64 flex-col border-r border-border bg-surface-sunken md:h-screen md:w-60">
      {/* Workspace header */}
      <div className="flex items-center gap-2 px-4 pb-3 pt-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-ink text-white shadow-elevated">
          <Sparkles className="h-3.5 w-3.5" strokeWidth={2.5} />
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-between">
          <span className="truncate text-sm font-medium text-ink">TaskFlow</span>
          <span className="badge bg-surface-raised text-ink-subtle">Admin</span>
        </div>
      </div>

      {/* Search trigger (opens Command Palette) */}
      <div className="px-2 pt-2">
        <button
          type="button"
          onClick={() => {
            const ev = new KeyboardEvent('keydown', { key: 'k', metaKey: true, ctrlKey: true });
            window.dispatchEvent(ev);
          }}
          className="flex w-full items-center gap-2 rounded-md border border-border-strong bg-surface-raised px-2 py-1.5 text-sm text-ink-faint transition-colors hover:border-ink-faint"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1 text-left">Buscar...</span>
          <span className="kbd">⌘K</span>
        </button>
      </div>

      {/* Primary nav */}
      <nav className="px-2 py-2">
        <NavLink href="/admin" icon={LayoutDashboard} label="Dashboard" pathname={pathname} exact />
        <NavLink href="/admin/tarefas" icon={CheckSquare} label="Minhas tarefas" pathname={pathname} />
        <NavLink href="/admin/notas" icon={StickyNote} label="Notas" pathname={pathname} />
        <NavLink href="/admin/clientes" icon={Users} label="Clientes" pathname={pathname} />
        <NavLink href="/admin/notificacoes" icon={Bell} label="Notificações" pathname={pathname} />
        <NavLink href="/admin/configuracoes" icon={Settings} label="Configurações" pathname={pathname} />
      </nav>

      {/* Clients section */}
      <div className="mt-3 px-4">
        <span className="section-label">Clientes</span>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {loading ? (
          <div className="space-y-1 px-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2 py-1.5">
                <Skeleton className="h-5 w-5 rounded-full" />
                <Skeleton className="h-3 flex-1" />
              </div>
            ))}
          </div>
        ) : clients.length === 0 ? (
          <p className="px-3 py-2 text-xs text-ink-faint">Nenhum cliente ainda</p>
        ) : (
          clients.map((c) => {
            const href = `/admin/clientes/${c.id}`;
            const active = pathname?.startsWith(href);
            return (
              <Link
                key={c.id}
                href={href}
                className={cn(
                  'group mb-0.5 flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                  active
                    ? 'bg-surface-raised text-ink shadow-elevated'
                    : 'text-ink-muted hover:bg-surface-raised hover:text-ink',
                )}
              >
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <span
                    className="flex h-5 w-5 flex-none items-center justify-center rounded text-[10px] font-semibold text-white"
                    style={{ backgroundColor: c.brand_color ?? '#3C3489' }}
                  >
                    {initials(c.brand_name ?? c.name)}
                  </span>
                  <span className="truncate">{c.brand_name ?? c.name}</span>
                </span>
                {c.pending > 0 && (
                  <span className="tabular text-xs text-ink-faint group-hover:text-ink-subtle">
                    {c.pending}
                  </span>
                )}
              </Link>
            );
          })
        )}
      </div>

      {/* Footer / theme toggle + logout */}
      <div className="flex items-center gap-1 border-t border-border p-2">
        <button
          type="button"
          onClick={toggle}
          className="flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-sm text-ink-muted transition-colors hover:bg-surface-raised hover:text-ink"
          aria-label={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
          title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
        >
          {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          <span>{theme === 'dark' ? 'Claro' : 'Escuro'}</span>
        </button>
        <button
          type="button"
          onClick={logout}
          className="flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-sm text-ink-muted transition-colors hover:bg-surface-raised hover:text-ink"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sair
        </button>
      </div>
    </aside>
  );
}

function NavLink({
  href,
  icon: Icon,
  label,
  pathname,
  exact,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  pathname: string | null;
  exact?: boolean;
}) {
  const active = exact ? pathname === href : pathname?.startsWith(href);
  return (
    <Link
      href={href}
      className={cn(
        'mb-0.5 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
        active
          ? 'bg-surface-raised text-ink shadow-elevated'
          : 'text-ink-muted hover:bg-surface-raised hover:text-ink',
      )}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2} />
      {label}
    </Link>
  );
}
