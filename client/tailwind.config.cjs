/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#15803d',
        secondary: '#f97316',
        dark: '#1e293b'
      }
    }
  },
  plugins: []
};

