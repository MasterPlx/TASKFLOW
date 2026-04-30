'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'warning' | 'default';
}

/**
 * Reusable confirmation dialog. Replaces ugly window.confirm().
 * Renders an icon, title, message and two buttons. Confirm button
 * shows a spinner while onConfirm() is awaited.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'default',
}: ConfirmDialogProps) {
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !working) onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handler);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handler);
    };
  }, [open, working, onClose]);

  if (!open) return null;

  const tones = {
    danger: {
      iconBg: 'bg-accent-rose-100 text-accent-rose-700',
      btn: 'bg-accent-rose-600 hover:bg-accent-rose-700 focus:ring-accent-rose-600',
    },
    warning: {
      iconBg: 'bg-accent-amber-100 text-accent-amber-700',
      btn: 'bg-accent-amber-600 hover:bg-accent-amber-700',
    },
    default: {
      iconBg: 'bg-brand-100 text-brand-700',
      btn: 'bg-brand-600 hover:bg-brand-700',
    },
  }[tone];

  async function handleConfirm() {
    setWorking(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-ink/40 backdrop-blur-[2px] animate-fade-in"
        onClick={() => !working && onClose()}
        aria-hidden
      />
      <div
        role="alertdialog"
        aria-labelledby="confirm-title"
        className="relative w-full max-w-sm animate-scale-in rounded-card border border-border bg-surface-raised p-5 shadow-floating"
      >
        <div className="flex items-start gap-3">
          <span className={cn('flex h-9 w-9 flex-none items-center justify-center rounded-full', tones.iconBg)}>
            <AlertTriangle className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="confirm-title" className="text-base font-semibold text-ink">
              {title}
            </h2>
            {message && (
              <div className="mt-1.5 text-sm leading-relaxed text-ink-muted">{message}</div>
            )}
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={working}
            className="btn-secondary"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={working}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium text-white transition-all disabled:opacity-50',
              tones.btn,
            )}
          >
            {working ? <Loader2 className="h-4 w-4 animate-spin" /> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Hook helper for declarative usage ───────────────────────────────────────
import { createContext, useCallback, useContext, useRef } from 'react';

interface ConfirmCtx {
  confirm: (opts: Omit<ConfirmDialogProps, 'open' | 'onClose' | 'onConfirm'> & {
    onConfirm: () => Promise<void> | void;
  }) => void;
}

const ConfirmContext = createContext<ConfirmCtx | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<Omit<ConfirmDialogProps, 'open' | 'onClose'>>({
    title: '',
    onConfirm: () => {},
  });
  const onConfirmRef = useRef<() => Promise<void> | void>(() => {});

  const confirm = useCallback<ConfirmCtx['confirm']>((o) => {
    onConfirmRef.current = o.onConfirm;
    setOpts({ ...o, onConfirm: () => onConfirmRef.current() });
    setOpen(true);
  }, []);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={() => onConfirmRef.current()}
        title={opts.title}
        message={opts.message}
        confirmLabel={opts.confirmLabel}
        cancelLabel={opts.cancelLabel}
        tone={opts.tone}
      />
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmCtx {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
}
