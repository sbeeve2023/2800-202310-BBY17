/** @type {import('tailwindcss').Config} */
module.exports = {
  mode: 'jit',
  content: [    './views/**/*.ejs',
                './**/*.{html,js}'],
  theme: {
    extend: {
      colors: {
        'mmpr': '#395144',
        'mmse': '#4E6C50',
        'mmth': '#AA8B56',
        'mmfo': '#F0EBCE',
      },
    },
  },
  plugins: [],
}
