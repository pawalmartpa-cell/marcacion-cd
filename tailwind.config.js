/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class'],
  theme: {
    extend: {
      colors: {
        wm: { blue: '#0071CE', 'blue-d': '#004F9A', navy: '#041E42', yellow: '#FFC220', navy2: '#0A2B5C' },
        bg: v('bg'),
        card: v('card'),
        text: v('text'),
        muted: v('muted'),
        line: v('line'),
        track: v('track'),
        ok: { DEFAULT: v('ok'), bg: v('ok-bg') },
        warn: { DEFAULT: v('warn'), bg: v('warn-bg') },
        bad: { DEFAULT: v('bad'), bg: v('bad-bg') },
        info: { DEFAULT: v('info'), bg: v('info-bg') },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        vibes: ['"Great Vibes"', 'cursive'],
        dancing: ['"Dancing Script"', 'cursive'],
        allura: ['Allura', 'cursive'],
      },
      borderRadius: { xl2: '16px' },
    },
  },
  plugins: [],
};
