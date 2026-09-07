import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bee: {
          bg: "#0d0d0d",
          surface: "#151515",
          surface2: "#1e1e1e",
          pink: "#FF3C6E",
          "pink-hot": "#FF1F57",
          "pink-dark": "#cc2050",
          "pink-glow": "rgba(255, 60, 110, 0.4)",
          border: "rgba(255, 60, 110, 0.15)",
          text: "#FFFFFF",
          muted: "#888888",
          dim: "#555555",
        },
      },
    },
  },
  plugins: [
    function ({ addUtilities }: any) {
      addUtilities({
        ".glow-pink": {
          boxShadow:
            "0 0 20px rgba(255,60,110,0.4), 0 0 60px rgba(255,60,110,0.1)",
        },
        ".glow-pink-sm": {
          boxShadow: "0 0 10px rgba(255,60,110,0.3)",
        },
        ".text-glow": {
          textShadow: "0 0 20px rgba(255,60,110,0.6)",
        },
      });
    },
  ],
};
export default config;
