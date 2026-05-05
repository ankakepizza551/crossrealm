/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        accent: '#40E0D0',
        danger: '#FF4500',
        'steam-gold': '#D4AF37',
        'magic-purple': '#8A2BE2',
      },
    },
  },
  plugins: [],
}
