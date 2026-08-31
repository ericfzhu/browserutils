/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#f5f5f3',
        ink: '#171717',
        line: '#c9c9c5',
        quiet: '#6d6d69',
        panel: '#ffffff',
        signal: '#ff5a1f',
      },
      fontFamily: {
        sans: ['Geist Variable', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
