/** @type {import('tailwindcss').Config} */
module.exports = {
  mode: 'jit',
  content: [    './views/**/*.ejs',
                './**/*.{html,js}'],
  theme: {
    extend: {
      colors: {
        'mmpr': '#518f3a',
        'mmse': '#6cbd4f',
        'mmth': '#86ee60',
        'mmfo': '#f4f7ed',
      },
      fontFamily: {
        'title': ['Varela Round', 'sans-serif']
      },
  },
  plugins: [],
}
}
