/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        unal: {
          green: '#006633',
          dark: '#004d26',
          light: '#e8f5e9',
          accent: '#2e7d32',
          slate: '#334155',
        },
      },
    },
  },
  plugins: [],
};

