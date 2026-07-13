/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        void: '#05060a',
        panel: '#0a0d16',
        'panel-2': '#0e1220',
        line: '#1b2233',
        cyan: {
          DEFAULT: '#22d3ee',
          glow: '#22d3ee',
        },
        magenta: '#e879f9',
        lime: '#a3e635',
        amber: '#fbbf24',
        rose: '#fb7185',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        'glow-cyan': '0 0 20px -2px rgba(34,211,238,0.45)',
        'glow-magenta': '0 0 20px -2px rgba(232,121,249,0.45)',
        'glow-lime': '0 0 20px -2px rgba(163,230,53,0.4)',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' },
        },
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        flicker: {
          '0%, 100%': { opacity: '1' },
          '92%': { opacity: '1' },
          '94%': { opacity: '0.6' },
          '96%': { opacity: '1' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'pulse-glow': 'pulse-glow 2.4s ease-in-out infinite',
        scan: 'scan 6s linear infinite',
        flicker: 'flicker 5s linear infinite',
        'fade-up': 'fade-up 0.5s ease-out both',
      },
    },
  },
  plugins: [],
}
