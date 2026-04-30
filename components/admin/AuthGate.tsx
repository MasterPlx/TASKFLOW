'use client';

import { Loader2, Menu, X, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAdminAuth } from '@/lib/auth';
import { AdminLogin } from './AdminLogin';
import { Sidebar } from './Sidebar';
import { CommandPalette } from '@/components/CommandPalette';
import { cn } from '@/lib/utils';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { ready, authed } = useAdminAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close drawer on route change (since pathname changes inside Sidebar via Link clicks)
  useEffect(() => {
    if (!drawerOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handler);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handler);
    };
  }, [drawerOpen]);

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-ink-faint" />
      </div>
    );
  }

  if (!authed) return <AdminLogin />;

  return (
    <div className="flex h-screen bg-surface">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      {/* Mobile drawer */}
      <div
        className={cn(
          'fixed inset-0 z-40 md:hidden',
          drawerOpen ? '' : 'pointer-events-none',
        )}
      >
        <div
          className={cn(
            'absolute inset-0 bg-ink/30 backdrop-blur-[2px] transition-opacity duration-200',
            drawerOpen ? 'opacity-100' : 'opacity-0',
          )}
          onClick={() => setDrawerOpen(false)}
          aria-hidden
        />
        <div
          className={cn(
            'absolute left-0 top-0 h-full transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
            drawerOpen ? 'translate-x-0' : '-translate-x-full',
          )}
          onClick={(e) => {
            // Close drawer when a link inside is clicked
            const target = e.target as HTMLElement;
            if (target.closest('a')) setDrawerOpen(false);
          }}
        >
          <Sidebar />
        </div>
      </div>

      <CommandPalette />
      <main className="flex-1 overflow-y-auto">
        {/* Mobile top bar */}
        <header className="flex items-center justify-between border-b border-border bg-surface-raised px-4 py-3 md:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="btn-icon"
            aria-label="Abrir menu"
          >
            <Menu className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-ink text-white">
              <Sparkles className="h-3 w-3" strokeWidth={2.5} />
            </span>
            <span className="text-sm font-semibold tracking-tight text-ink">TaskFlow</span>
          </div>
          <span className="w-7" />
        </header>
        {children}
      </main>
    </div>
  );
}
