/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#FFF6E5',
        ink: '#1F1A17',
        tomato: '#FF5A4E',
        sunflower: '#FFC531',
        teal: '#2EC4B6',
        grape: '#8E6CEF',
        mint: '#B8F2C9',
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: { blob: '24px' },
    },
  },
  plugins: [],
};
