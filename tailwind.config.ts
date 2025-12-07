import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        spotify: {
          green: '#1DB954',
          'green-dark': '#1AA34A',
          black: '#191414',
          'dark-gray': '#121212',
          gray: '#282828',
          'light-gray': '#B3B3B3',
          white: '#FFFFFF',
        },
      },
    },
  },
  plugins: [],
};
export default config;
