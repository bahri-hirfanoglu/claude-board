/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          50: '#f5f0e8',
          100: '#ebe4d8',
          200: '#d4cbbe',
          300: '#b5ab9a',
          400: '#918678',
          500: '#736858',
          600: '#564d40',
          700: '#3d372e',
          800: '#2a2520',
          900: '#1f1b17',
          950: '#15120f',
        },
        claude: {
          DEFAULT: '#DA7756',
          light: '#e5936f',
          dark: '#c4624a',
        },
      },
    },
  },
  plugins: [],
};
