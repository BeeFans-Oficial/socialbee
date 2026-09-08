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

        // Tokens que os componentes do shadcn/ui esperam.
        //
        // Os arquivos em `components/ui/` foram copiados do shadcn e usam
        // `bg-primary`, `bg-input`, `ring-ring`, `ring-offset-background` e
        // `text-muted-foreground` — nenhum deles existia aqui, porque o config
        // só declarava `colors.bee.*`. Classe sem cor no tema não gera CSS
        // nenhum, então o efeito era silencioso: foco de teclado invisível nos
        // inputs e botões, e o `Switch` **inteiramente** invisível (track e
        // thumb dependiam de `input`/`primary`/`background`).
        //
        // Mapeados para a paleta bee para que qualquer componente shadcn
        // adicionado daqui pra frente já nasça com a cara do projeto.
        background: "#0d0d0d",
        foreground: "#FFFFFF",
        primary: {
          DEFAULT: "#FF3C6E",
          foreground: "#FFFFFF",
        },
        input: "rgba(255, 255, 255, 0.10)",
        ring: "#FF3C6E",
        "muted-foreground": "#888888",
      },

      // As fontes eram carregadas em `app/layout.tsx` via `next/font` e
      // expostas como variáveis CSS, mas nunca registradas aqui — então
      // `font-bebas` (43 usos) e `font-barlow` (13 usos) eram classes
      // inexistentes e todo o texto caía no Inter do `body`.
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        barlow: ["var(--font-barlow)", "system-ui", "sans-serif"],
        bebas: ["var(--font-bebas)", "Impact", "Haettenschweiler", "sans-serif"],
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
