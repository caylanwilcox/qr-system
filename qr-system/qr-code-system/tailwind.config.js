/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",  // This will catch all JS/JSX files in src
    "./src/components/**/*.{js,jsx,ts,tsx,css}",  // Specifically includes component CSS
    "./src/**/*.css",  // This will catch all CSS files in src
  ],
  theme: {
    extend: {
      backdropFilter: {
        'none': 'none',
        'blur': 'blur(8px)',
      },
      colors: {
        'glass': {
          DEFAULT: 'rgba(13, 25, 48, 0.4)',
          'light': 'rgba(255, 255, 255, 0.1)',
          'dark': 'rgba(13, 25, 48, 0.6)',
        }
      }
    },
  },
  plugins: [],
}