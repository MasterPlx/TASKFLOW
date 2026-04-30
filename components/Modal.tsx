'use client';

import { X } from 'lucide-react';
import { useEffect } from 'react';

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const widthCls =
    width === 'sm'
      ? 'max-w-sm'
      : width === 'md'
        ? 'max-w-md'
        : width === 'lg'
          ? 'max-w-lg'
          : 'max-w-xl';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-ink/30 backdrop-blur-[2px] animate-fade-in"
        onClick={onClose}
        aria-hidden
      />
      <div className={`relative w-full ${widthCls} animate-scale-in`}>
        <div className="rounded-card border border-border bg-surface-raised p-6 shadow-floating">
          {title && (
            <div className="mb-5 flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar"
                className="-mr-1 -mt-1 rounded-md p-1 text-ink-faint transition-colors hover:bg-surface-sunken hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          <div>{children}</div>
          {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
