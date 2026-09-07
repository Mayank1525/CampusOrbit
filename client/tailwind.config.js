/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      // Fine-grained opacity steps used throughout the glassmorphism system
      // (Tailwind ships 5/10/20/… only; we need 7/12/15/18/22/28 etc.).
      opacity: {
        2: '0.02', 3: '0.03', 4: '0.04', 6: '0.06', 7: '0.07', 8: '0.08',
        12: '0.12', 14: '0.14', 15: '0.15', 18: '0.18', 22: '0.22',
        25: '0.25', 28: '0.28', 35: '0.35', 45: '0.45', 55: '0.55', 65: '0.65',
        85: '0.85', 92: '0.92',
      },
      colors: {
        space: {
          950: '#05060f',
          900: '#080a18',
          850: '#0b0e20',
          800: '#101430',
          700: '#171c42',
          600: '#232a5c',
        },
        orbit: {
          violet: '#7c5cff',
          indigo: '#5b6cff',
          cyan: '#22d3ee',
          blue: '#3b82f6',
          coral: '#fb7185',
          mint: '#34d399',
          pink: '#f472b6',
          amber: '#fbbf24',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif', 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji'],
        display: ['Space Grotesk', 'Inter', 'system-ui', 'sans-serif', 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 24px -4px rgba(124, 92, 255, 0.45)',
        'glow-cyan': '0 0 24px -4px rgba(34, 211, 238, 0.45)',
        'glow-coral': '0 0 24px -4px rgba(251, 113, 133, 0.4)',
        elevate: '0 18px 50px -12px rgba(0, 0, 0, 0.7)',
        'inner-glow': 'inset 0 1px 0 0 rgba(255,255,255,0.07)',
      },
      backgroundImage: {
        'grid-faint':
          'linear-gradient(rgba(124,92,255,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(124,92,255,0.055) 1px, transparent 1px)',
      },
      backgroundSize: { grid: '48px 48px' },
      keyframes: {
        float: {
          '0%,100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        twinkle: {
          '0%,100%': { opacity: '0.25' },
          '50%': { opacity: '1' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.85)', opacity: '0.7' },
          '80%,100%': { transform: 'scale(1.6)', opacity: '0' },
        },
        'gradient-x': {
          '0%,100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
        twinkle: 'twinkle 4s ease-in-out infinite',
        shimmer: 'shimmer 2s infinite',
        'pulse-ring': 'pulse-ring 2.4s cubic-bezier(0.24,0,0.38,1) infinite',
        'gradient-x': 'gradient-x 6s ease infinite',
        'slide-up': 'slide-up 0.4s ease-out',
      },
    },
  },
  plugins: [],
};
