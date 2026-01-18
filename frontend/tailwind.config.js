/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html",
  ],
  theme: {
    extend: {
      colors: {
        // Medical Blue Theme (from Global Layout doc)
        'medical-blue': {
          DEFAULT: '#0F67B1',
          light: '#add5f7',
          dark: '#0a4a80',
        },
        // Alert Colors
        'alert-green': '#22c55e',
        'alert-red': '#ef4444',
        'alert-amber': '#f59e0b',
      },
      fontFamily: {
        sans: ['Inter', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
