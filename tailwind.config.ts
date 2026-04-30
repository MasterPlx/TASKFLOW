import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Surface/border/ink read CSS variables defined in globals.css.
        // This makes dark mode a token swap instead of a class hunt.
        surface: {
          DEFAULT: 'rgb(var(--surface) / <alpha-value>)',
          raised:  'rgb(var(--surface-raised) / <alpha-value>)',
          sunken:  'rgb(var(--surface-sunken) / <alpha-value>)',
          inverse: '#1A1A1F',
        },
        border: {
          DEFAULT: 'rgb(var(--border) / <alpha-value>)',
          strong:  'rgb(var(--border-strong) / <alpha-value>)',
          subtle:  'rgb(var(--border-subtle) / <alpha-value>)',
        },
        ink: {
          DEFAULT: 'rgb(var(--ink) / <alpha-value>)',
          muted:   'rgb(var(--ink-muted) / <alpha-value>)',
          subtle:  'rgb(var(--ink-subtle) / <alpha-value>)',
          faint:   'rgb(var(--ink-faint) / <alpha-value>)',
        },
        // ── Brand: vivid violet (Cron/Height energy) ───────────────────────
        brand: {
          50:  '#F5F3FF',
          100: '#EDE9FE',
          200: '#DDD6FE',
          300: '#C4B5FD',
          400: '#A78BFA',
          500: '#8B5CF6',
          600: '#7C3AED',  // primary
          700: '#6D28D9',
          800: '#5B21B6',
          900: '#4C1D95',
        },
        // ── Accent palette — used for cards & illustrations ────────────────
        accent: {
          peach:    { 50: '#FFF7ED', 100: '#FFEDD5', 200: '#FED7AA', 600: '#EA580C', 700: '#C2410C' },
          rose:     { 50: '#FFF1F2', 100: '#FFE4E6', 200: '#FECDD3', 600: '#E11D48', 700: '#BE123C' },
          amber:    { 50: '#FFFBEB', 100: '#FEF3C7', 200: '#FDE68A', 600: '#D97706', 700: '#B45309' },
          emerald:  { 50: '#ECFDF5', 100: '#D1FAE5', 200: '#A7F3D0', 600: '#059669', 700: '#047857' },
          sky:      { 50: '#F0F9FF', 100: '#E0F2FE', 200: '#BAE6FD', 600: '#0284C7', 700: '#0369A1' },
          violet:   { 50: '#F5F3FF', 100: '#EDE9FE', 200: '#DDD6FE', 600: '#7C3AED', 700: '#6D28D9' },
          pink:     { 50: '#FDF2F8', 100: '#FCE7F3', 200: '#FBCFE8', 600: '#DB2777', 700: '#BE185D' },
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.01em' }],
        'xs':  ['0.75rem', { lineHeight: '1.125rem' }],
        'sm':  ['0.8125rem', { lineHeight: '1.25rem' }],
        'base':['0.875rem', { lineHeight: '1.375rem' }],
        'md':  ['0.9375rem', { lineHeight: '1.5rem' }],
        'lg':  ['1.0625rem', { lineHeight: '1.5rem' }],
        'xl':  ['1.25rem',  { lineHeight: '1.75rem', letterSpacing: '-0.01em' }],
        '2xl': ['1.5rem',   { lineHeight: '2rem', letterSpacing: '-0.015em' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem', letterSpacing: '-0.02em' }],
        '4xl': ['2.25rem',  { lineHeight: '2.5rem',  letterSpacing: '-0.025em' }],
      },
      borderRadius: {
        card: '14px',
        pill: '999px',
      },
      borderWidth: {
        '0.5': '0.5px',
        hairline: '1px',
      },
      boxShadow: {
        elevated: '0 0 0 1px rgba(26, 26, 31, 0.04), 0 2px 4px rgba(26, 26, 31, 0.04), 0 1px 2px rgba(26, 26, 31, 0.04)',
        floating: '0 0 0 1px rgba(26, 26, 31, 0.06), 0 12px 32px -10px rgba(124, 58, 237, 0.12), 0 4px 12px -4px rgba(26, 26, 31, 0.08)',
        focus: '0 0 0 3px rgba(124, 58, 237, 0.18)',
        glow: '0 0 24px -4px rgba(124, 58, 237, 0.35)',
      },
      backgroundImage: {
        'mesh-violet':
          'radial-gradient(60% 50% at 20% 0%, rgba(124,58,237,0.18) 0%, transparent 60%), radial-gradient(50% 50% at 90% 0%, rgba(244,114,182,0.14) 0%, transparent 55%), radial-gradient(60% 60% at 50% 100%, rgba(56,189,248,0.10) 0%, transparent 60%)',
        'mesh-warm':
          'radial-gradient(60% 50% at 20% 0%, rgba(251,146,60,0.14) 0%, transparent 60%), radial-gradient(50% 50% at 90% 10%, rgba(244,114,182,0.10) 0%, transparent 55%)',
        'gradient-brand':
          'linear-gradient(135deg, #7C3AED 0%, #DB2777 100%)',
      },
      keyframes: {
        slideInFromTop: {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        pulseRing: {
          '0%, 100%': { opacity: '0.4', transform: 'scale(1)' },
          '50%': { opacity: '0', transform: 'scale(1.6)' },
        },
      },
      animation: {
        'slide-in-top': 'slideInFromTop 220ms cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-in': 'fadeIn 180ms ease-out',
        'scale-in': 'scaleIn 180ms cubic-bezier(0.16, 1, 0.3, 1)',
        'pulse-ring': 'pulseRing 1.6s ease-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
