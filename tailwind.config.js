/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        factory: {
          dark: '#18191C',
          surface: '#222429',
          card: '#222429',
          inset: '#1B1D22',
          border: '#2F3238',
          accent: '#F4F5F7',
          'accent-light': '#DCDDE1',
          text: '#F4F5F7',
          muted: '#8E929B',
          dim: '#A8AEBC',
          success: '#F4F5F7',
          warning: '#A8AEBC',
          danger: '#C4623F'
        }
      },
      borderRadius: {
        chip: '8px',
        field: '12px',
        tile: '16px',
        card: '20px',
        glass: '22px',
        capsule: '33px'
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
