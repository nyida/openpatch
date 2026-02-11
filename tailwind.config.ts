import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-app)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
        mono: ['ui-monospace', 'monospace'],
      },
      colors: {
        openpatch: {
          primary: '#0d9488',
          secondary: '#0f766e',
          accent: '#2dd4bf',
          muted: '#ccfbf1',
        },
      },
      boxShadow: {
        'soft': '0 2px 8px -2px rgb(0 0 0 / 0.06), 0 4px 12px -4px rgb(0 0 0 / 0.04)',
        'glow': '0 0 0 1px rgb(13 148 136 / 0.1), 0 4px 14px -2px rgb(13 148 136 / 0.15)',
        'glow-lg': '0 0 40px -10px rgb(13 148 136 / 0.25), 0 0 0 1px rgb(13 148 136 / 0.08)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.25s ease-out',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
};
export default config;
