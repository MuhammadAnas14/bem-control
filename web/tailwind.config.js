/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef7f4',
          100: '#d6ebe3',
          500: '#2f7d63',
          600: '#26654f',
          700: '#1e4f3e',
        },
      },
    },
  },
  plugins: [],
};
