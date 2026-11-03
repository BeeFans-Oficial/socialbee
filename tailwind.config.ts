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
          // Casca do painel: barra lateral e barra do topo, um tom abaixo do
          // fundo para o conteúdo parecer "sobre" elas.
          rail: "#0a0a0a",
          // Painel lateral dos editores: grafite com um toque de azul, e o tom
          // acima dele para balões e menus que abrem por cima.
          panel: "#0d1119",
          panel2: "#161b26",
          // Fio de separação padrão do painel (bordas, divisórias).
          line: "rgba(255, 255, 255, 0.06)",
          pink: "#FF3C6E",
          "pink-hot": "#FF1F57",
          "pink-dark": "#cc2050",
          "pink-glow": "rgba(255, 60, 110, 0.4)",
          border: "rgba(255, 60, 110, 0.15)",
          text: "#FFFFFF",
          muted: "#888888",
          dim: "#555555",
        },

        // Painel admin: claro de propósito, para ninguém confundir com o painel
        // da criadora. Paleta slate dessaturada (ferramenta de trabalho, baixa
        // fadiga): um único acento azul-aço, grafite nos botões em vez de preto,
        // vermelho e verde abafados, sem sombra. Ver components/admin/Ui.tsx.
        admin: {
          bg: "#EEF0F3",
          card: "#F8F9FB",
          hover: "#E4E7EC",
          line: "#DCE0E6",
          ink: "#1F2A3A",
          muted: "#56616F",
          faint: "#65707F",
          primary: "#3A4656",
          "primary-hover": "#2B3542",
          accent: "#4F6B95",
          "accent-ink": "#34507A",
          "accent-soft": "#E6EBF3",
          "accent-line": "#CBD5E4",
          danger: "#A8433E",
          "danger-hover": "#8F3732",
          "danger-soft": "#F6ECEB",
          "danger-line": "#E3C3C0",
          ok: "#4C8C6E",
          pro: "#B03D5E",
          "pro-soft": "#F5E6EB",
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
      // Animações em CSS para o que o Radix controla por `data-state` (diálogos,
      // folhas) e para o brilho dos esqueletos. O resto do movimento é do
      // Motion, com os tokens de `lib/movimento.ts`: mesma curva, mesmas
      // durações — a curva aqui é a MD3 standard, igual à `SUAVE` de lá.
      keyframes: {
        "dialogo-entrar": {
          from: { opacity: "0", transform: "translate(-50%, -50%) scale(0.95)" },
          to: { opacity: "1", transform: "translate(-50%, -50%) scale(1)" },
        },
        "dialogo-sair": {
          from: { opacity: "1", transform: "translate(-50%, -50%) scale(1)" },
          to: { opacity: "0", transform: "translate(-50%, -50%) scale(0.98)" },
        },
        "folha-entrar": {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
        "folha-sair": {
          from: { transform: "translateY(0)" },
          to: { transform: "translateY(100%)" },
        },
        "fundo-entrar": { from: { opacity: "0" }, to: { opacity: "1" } },
        "fundo-sair": { from: { opacity: "1" }, to: { opacity: "0" } },
        brilhar: {
          from: { backgroundPosition: "200% 0" },
          to: { backgroundPosition: "-200% 0" },
        },
      },
      animation: {
        "dialogo-entrar": "dialogo-entrar 300ms cubic-bezier(0.2, 0, 0, 1) both",
        "dialogo-sair": "dialogo-sair 200ms cubic-bezier(0.3, 0, 1, 1) both",
        "folha-entrar": "folha-entrar 320ms cubic-bezier(0.2, 0, 0, 1) both",
        "folha-sair": "folha-sair 220ms cubic-bezier(0.3, 0, 1, 1) both",
        "fundo-entrar": "fundo-entrar 200ms ease-out both",
        "fundo-sair": "fundo-sair 150ms ease-in both",
      },
      fontFamily: {
        sans: ["var(--font-poppins)", "system-ui", "sans-serif"],
        // Opção de fonte da página pública (`FONTES` em `lib/templates.ts`).
        inter: ["var(--font-inter)", "system-ui", "sans-serif"],
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
