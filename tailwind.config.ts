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
        ink: "#101B2D",
        forest: "#12355F",
        orange: "#F5B700",
        mist: "#EEE8D9",
        paper: "#F8F5EE",
        sage: "#AEB9C9",
        smoke: "#4B5568",
        border: "#DDD6C5",
        "border-light": "#EAE4D6",
        "mist-dark": "#D7E0EE",
        "orange-light": "#FFF6D6",
        "orange-dark": "#5E4400",
        "forest-deep": "#0C2442",
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
