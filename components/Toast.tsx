'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastKind = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  toast: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, kind: ToastKind = 'success') => {
      const id = Date.now() + Math.random();
      setItems((prev) => [...prev, { id, message, kind }]);
      setTimeout(() => dismiss(id), 2800);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-full max-w-xs flex-col gap-2">
        {items.map((t) => (
          <ToastView key={t.id} item={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastView({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShow(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const Icon = item.kind === 'success' ? CheckCircle2 : item.kind === 'error' ? XCircle : Info;
  const iconColor =
    item.kind === 'success'
      ? 'text-emerald-500'
      : item.kind === 'error'
        ? 'text-red-500'
        : 'text-brand-500';

  return (
    <div
      className={cn(
        'pointer-events-auto flex items-start gap-2.5 rounded-lg border border-border bg-surface-raised px-3 py-2.5 shadow-floating transition-all duration-200',
        show ? 'translate-x-0 opacity-100' : 'translate-x-2 opacity-0',
      )}
    >
      <Icon className={cn('mt-0.5 h-4 w-4 flex-none', iconColor)} />
      <p className="flex-1 text-sm leading-relaxed text-ink">{item.message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="-mr-1 -mt-0.5 rounded p-1 text-ink-faint transition-colors hover:bg-surface-sunken hover:text-ink-muted"
        aria-label="Fechar"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
