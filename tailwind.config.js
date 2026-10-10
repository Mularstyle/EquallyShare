/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/web/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        xp: {
          blue: "#0054E3",
          lightblue: "#3C91FF",
          darkblue: "#003399",
          silver: "#ECE9D8",
          gray: "#D4D0C8",
          border: "#0054A3",
          titlebar: "#0054E3",
        },
      },
      boxShadow: {
        xp: "2px 2px 4px rgba(0,0,0,0.3)",
        "xp-inner": "inset 1px 1px 2px rgba(255,255,255,0.5), inset -1px -1px 2px rgba(0,0,0,0.2)",
      },
    },
  },
  plugins: [],
};
