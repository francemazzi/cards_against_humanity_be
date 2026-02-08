/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    screens: {
      'xs': '375px',
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
      'landscape': { 'raw': '(orientation: landscape) and (max-height: 500px)' },
    },
    extend: {
      colors: {
        'cah-black': '#000000',
        'cah-white': '#FFFFFF',
      },
      fontFamily: {
        'cah': ['"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
      },
      minHeight: {
        'touch': '44px',
      },
      minWidth: {
        'touch': '44px',
      },
    },
  },
  plugins: [],
}

