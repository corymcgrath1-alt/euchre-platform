import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        table: "#12392f",
        felt: "#0f513f",
        brass: "#d1a44c"
      }
    }
  },
  plugins: []
};

export default config;
