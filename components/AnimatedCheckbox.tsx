'use client';

import { cn } from '@/lib/utils';

/**
 * Linear/Notion-style checkbox where the checkmark "draws" itself when checked.
 * The trick: SVG path with stroke-dasharray equal to the path length;
 * stroke-dashoffset goes from full→0 to animate the stroke being drawn.
 */
export function AnimatedCheckbox({
  checked,
  onToggle,
  color,
  size = 'md',
  ariaLabel = 'Marcar como concluída',
}: {
  checked: boolean;
  onToggle: () => void;
  color?: string;
  size?: 'sm' | 'md';
  ariaLabel?: string;
}) {
  const dim = size === 'sm' ? 'h-4 w-4' : 'h-[18px] w-[18px]';
  const accent = color ?? '#7C3AED';
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={cn(
        'group relative flex flex-none items-center justify-center rounded-md border transition-all duration-200',
        dim,
        checked
          ? 'border-transparent shadow-elevated'
          : 'border-border-strong bg-surface-raised hover:border-ink-faint',
      )}
      style={checked ? { backgroundColor: accent } : undefined}
    >
      <svg
        viewBox="0 0 16 16"
        fill="none"
        className={cn('transition-opacity duration-200', checked ? 'opacity-100' : 'opacity-0')}
        aria-hidden
      >
        <path
          d="M3.5 8.5 L6.5 11.5 L12.5 5.5"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            strokeDasharray: 18,
            strokeDashoffset: checked ? 0 : 18,
            transition: 'stroke-dashoffset 280ms cubic-bezier(0.16, 1, 0.3, 1) 60ms',
          }}
        />
      </svg>
    </button>
  );
}
