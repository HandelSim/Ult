/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#0a0e17',
          secondary: '#111827',
          tertiary: '#1f2937'
        },
        accent: {
          DEFAULT: '#6366f1',
          hover: '#818cf8'
        },
        border: '#1f2937',
        text: {
          primary: '#f9fafb',
          secondary: '#9ca3af',
          muted: '#6b7280'
        },
        success: '#22c55e',
        warning: '#f59e0b',
        error: '#ef4444',
        pending: '#9ca3af',
        executing: '#3b82f6'
      },
      fontFamily: {
        sans: ['Outfit', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace']
      }
    }
  },
  plugins: []
};
