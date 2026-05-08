import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        crayon: ["Comic Sans MS", "Comic Neue", "ui-rounded", "system-ui", "sans-serif"]
      },
      boxShadow: {
        sketch: "3px 3px 0 rgba(30, 41, 59, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
