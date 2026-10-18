import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#14211B",
        forest: "#1F5F4A",
        orange: "#FF6A1A",
        mist: "#EAF0ED",
        paper: "#F4F6F5",
        sage: "#9DB0A7",
        smoke: "#4D5F57",
        border: "#D5DFDA",
        "border-light": "#E6ECE9",
        "mist-dark": "#CFE3DA",
        "orange-light": "#FFF1E6",
        "orange-dark": "#7A2E00",
        "forest-deep": "#153F31",
      },
      fontFamily: {
        sans: ["DM Sans", "sans-serif"],
        display: ["Bricolage Grotesque", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
