/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        siemens: {
          teal:    "#009999",
          "teal-700": "#007777",
          "teal-50":  "#e6f5f5",
          "teal-100": "#ccebeb",
          navy:    "#000028",
          "navy-700": "#00001a",
        },
      },
    },
  },
  plugins: [],
}
