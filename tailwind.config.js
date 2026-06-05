/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        factory: {
          dark: '#0f172a',
          card: '#1e293b',
          border: '#334155',
          accent: '#0d9488',
          'accent-light': '#14b8a6',
          success: '#10b981',
          warning: '#f59e0b',
          danger: '#ef4444',
          muted: '#94a3b8'
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
