// Full color tokens support Tailwind opacity modifiers in both themes.
const token = (name) => ({ opacityValue }) => opacityValue === undefined
  ? `var(--${name})`
  : `color-mix(in srgb, var(--${name}) calc(100% * ${opacityValue}), transparent)`;

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
    "./*.html",
  ],
  theme: {
    extend: {
      colors: {
        background: token('background'),
        foreground: token('foreground'),
        card: {
          DEFAULT: token('card'),
          foreground: token('card-foreground'),
        },
        popover: {
          DEFAULT: token('popover'),
          foreground: token('popover-foreground'),
        },
        primary: {
          DEFAULT: token('primary'),
          foreground: token('primary-foreground'),
        },
        secondary: {
          DEFAULT: token('secondary'),
          foreground: token('secondary-foreground'),
        },
        muted: {
          DEFAULT: token('muted'),
          foreground: token('muted-foreground'),
        },
        accent: {
          DEFAULT: token('accent'),
          foreground: token('accent-foreground'),
        },
        destructive: {
          DEFAULT: token('destructive'),
          foreground: token('destructive-foreground'),
        },
        border: token('border'),
        input: token('input'),
        ring: token('ring'),
        overlay: token('overlay'),
        red: { 500: token('series-red') },
        orange: { 500: token('series-orange') },
        amber: { 500: token('series-amber') },
        yellow: { 500: token('series-yellow') },
        lime: { 500: token('series-lime') },
        green: { 500: token('series-green') },
        emerald: { 500: token('series-emerald') },
        teal: { 500: token('series-teal') },
        cyan: { 500: token('series-cyan') },
        sky: { 500: token('series-sky') },
        blue: { 500: token('series-blue') },
        indigo: { 500: token('series-indigo') },
        violet: { 500: token('series-violet') },
        purple: { 500: token('series-purple') },
        fuchsia: { 500: token('series-fuchsia') },
        pink: { 500: token('series-pink') },
        rose: { 500: token('series-rose') },
        gray: { 500: token('series-gray') },
        success: { DEFAULT: token('success'), subtle: token('success-subtle') },
        warning: { DEFAULT: token('warning'), subtle: token('warning-subtle') },
        danger: { DEFAULT: token('destructive'), subtle: token('danger-subtle') },
        info: { DEFAULT: token('info'), subtle: token('info-subtle') },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['Geist Variable', 'sans-serif'],
      },
      ringWidth: {
        3: '3px',
      },
    },
  },
  plugins: [],
}
