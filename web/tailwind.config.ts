import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: 'var(--paper)',
        surface: {
          DEFAULT: 'var(--surface)',
          sunken: 'var(--surface-sunken)',
          raised: 'var(--surface-raised)',
        },
        hairline: {
          DEFAULT: 'var(--hairline)',
          strong: 'var(--hairline-strong)',
        },
        ink: {
          DEFAULT: 'var(--ink)',
          secondary: 'var(--ink-secondary)',
          muted: 'var(--ink-muted)',
          faint: 'var(--ink-faint)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          active: 'var(--accent-active)',
          soft: 'var(--accent-soft)',
          ring: 'var(--accent-ring)',
        },
        success: { DEFAULT: 'var(--success)', soft: 'var(--success-soft)' },
        warning: { DEFAULT: 'var(--warning)', soft: 'var(--warning-soft)' },
        danger: { DEFAULT: 'var(--danger)', soft: 'var(--danger-soft)' },
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
      boxShadow: {
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        lift: 'var(--shadow-lift)',
      },
      fontFamily: {
        display: [
          '"Fraunces Variable"',
          '"Iowan Old Style"',
          'Georgia',
          'serif',
        ],
        sans: ['"Geist Variable"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: [
          '"Geist Mono Variable"',
          'ui-monospace',
          '"SF Mono"',
          'monospace',
        ],
      },
      fontSize: {
        display: [
          '44px',
          { lineHeight: '48px', letterSpacing: '-0.02em', fontWeight: '500' },
        ],
        h1: [
          '32px',
          { lineHeight: '38px', letterSpacing: '-0.015em', fontWeight: '500' },
        ],
        h2: [
          '24px',
          { lineHeight: '30px', letterSpacing: '-0.01em', fontWeight: '500' },
        ],
        title: [
          '16px',
          { lineHeight: '22px', letterSpacing: '-0.005em', fontWeight: '600' },
        ],
        'body-lg': ['16px', { lineHeight: '24px' }],
        body: ['14px', { lineHeight: '20px' }],
        caption: ['13px', { lineHeight: '18px' }],
        label: [
          '11px',
          { lineHeight: '14px', letterSpacing: '0.08em', fontWeight: '600' },
        ],
        num: ['13px', { lineHeight: '18px', fontWeight: '500' }],
      },
      transitionTimingFunction: {
        'out-quart': 'var(--ease-out-quart)',
        'in-quart': 'var(--ease-in-quart)',
        'in-out-quart': 'var(--ease-in-out-quart)',
        'out-expo': 'var(--ease-out-expo)',
      },
      transitionDuration: {
        instant: '100ms',
        fast: '160ms',
        base: '240ms',
        slow: '360ms',
        page: '480ms',
      },
    },
  },
  plugins: [],
};

export default config;
