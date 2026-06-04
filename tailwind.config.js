/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        factory: {
          dark: '#0d0d1a',
          card: '#1a1a2e',
          border: '#2d2d4e',
          accent: '#4f46e5',
          'accent-light': '#6366f1',
          success: '#10b981',
          warning: '#f59e0b',
          danger: '#ef4444',
          muted: '#6b7280'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace']
      },
      minHeight: { touch: '44px' },
      minWidth: { touch: '44px' }
    }
  },
  plugins: []
}
