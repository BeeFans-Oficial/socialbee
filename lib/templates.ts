import { THEMES, type LinkButtonStyle } from "@/lib/catalog";

/**
 * Templates: o LAYOUT da página pública.
 *
 * Eixo que faltava. Até aqui a aparência eram três camadas — tema (só `bg` e
 * `accent`), estilo de botão e ajustes por link — e nenhuma delas mexia na
 * ESTRUTURA. Fundo hexagonal, faixa de capa de 128px, avatar redondo
 * centralizado e lista de uma coluna eram iguais para toda criadora.
 *
 * ## Um descritor, um componente de layout
 *
 * Cada template é DADO, não um componente próprio. A tentação é escrever
 * `<TemplateCapa>`, `<TemplateCartoes>` e deixar cada um livre — mas a barreira
 * de idade, o registro de clique e o escape de navegador embutido vivem nesse
 * caminho, e duplicá-los por template é como três deles ficam diferentes sem
 * ninguém notar. Aqui o template escolhe valores; quem renderiza é sempre o
 * mesmo código.
 *
 * O limite disso é honesto: template que precise de algo que o descritor não
 * expressa vira um campo novo aqui, ou deixa de caber no modelo. Quando o
 * segundo caso acontecer, é sinal de que chegou a hora dos componentes.
 *
 * ## Precedência
 *
 * O que a criadora escolheu a dedo ganha do template, que ganha do padrão:
 *
 *     cor personalizada  >  preset de tema  >  cor do template
 *
 * Guardar a exceção em vez de sobrescrever o preset é o que faz "voltar ao
 * tema" ser possível sem adivinhar qual cor era antes.
 */

/** Como a imagem de fundo (`coverUrl`) é usada. */
export type UsoDaCapa =
  /** faixa de 128px no topo, atrás do avatar — o formato de hoje */
  | "faixa"
  /** metade superior da tela, com o nome por cima */
  | "heroi"
  /** tela inteira, atrás de todo o conteúdo */
  | "tela"
  | "nenhuma";

export interface Template {
  id: string;
  label: string;
  descricao: string;
  capa: UsoDaCapa;
  /** Fundo hexagonal da marca. Desligado, o fundo é cor pura ou a foto. */
  hex: boolean;
  avatar: "grande" | "medio" | "nenhum";
  alinhamento: "centro" | "esquerda";
  lista: "coluna" | "grade";
  /** Mostra miniatura e subtítulo nos botões.
   *
   *  Os dois campos existem no banco e são editáveis no painel desde sempre, e
   *  NENHUM chegava à página pública — `LinkButton` nem os recebia. O template
   *  "Cartões" existe em boa parte para dar destino a eles. */
  detalhes: boolean;
  /** Estilo de botão que combina com o template. É só o padrão: a escolha da
   *  criadora em `buttonStyle` continua ganhando. */
  botaoPadrao: LinkButtonStyle;
  fontePadrao: string;
}

export const TEMPLATES: Template[] = [
  {
    id: "classico",
    label: "Clássico",
    descricao: "Fundo hexagonal, avatar redondo e lista de botões.",
    capa: "faixa",
    hex: true,
    avatar: "medio",
    alinhamento: "centro",
    lista: "coluna",
    detalhes: false,
    botaoPadrao: "soft",
    fontePadrao: "bebas",
  },
  {
    id: "capa",
    label: "Capa",
    descricao: "Sua foto ocupa o topo da tela, com o nome por cima.",
    capa: "heroi",
    hex: false,
    avatar: "nenhum",
    alinhamento: "centro",
    lista: "coluna",
    detalhes: false,
    botaoPadrao: "filled",
    fontePadrao: "bebas",
  },
  {
    id: "cartoes",
    label: "Cartões",
    descricao: "Grade de dois, com miniatura e descrição em cada link.",
    capa: "faixa",
    hex: false,
    avatar: "medio",
    alinhamento: "centro",
    lista: "grade",
    detalhes: true,
    botaoPadrao: "glass",
    fontePadrao: "barlow",
  },
  {
    id: "minimal",
    label: "Minimal",
    descricao: "Sem enfeite: tipografia grande e botões de contorno.",
    capa: "nenhuma",
    hex: false,
    avatar: "grande",
    alinhamento: "esquerda",
    lista: "coluna",
    detalhes: false,
    botaoPadrao: "outlined",
    fontePadrao: "barlow",
  },
];

/** Famílias que `app/layout.tsx` já carrega e o Tailwind já conhece
 *  (`font-bebas`, `font-barlow`, `font-sans`). Lista fechada: fonte nova é
 *  `next/font` no layout mais uma entrada aqui, não um campo de texto. */
export const FONTES = [
  { id: "bebas", label: "Bebas Neue", classe: "font-bebas" },
  { id: "barlow", label: "Barlow", classe: "font-barlow" },
  { id: "inter", label: "Inter", classe: "font-sans" },
] as const;

export const TEMPLATE_PADRAO = TEMPLATES[0];

/** O que a criadora escolheu, já resolvido — é isto que a página recebe. */
export interface VisualResolvido extends Template {
  bg: string;
  accent: string;
  fonteClasse: string;
  botao: LinkButtonStyle;
  coverUrl: string | null;
  coverPos: string;
  /** 0 a 1, para usar direto em `rgba`. */
  overlay: number;
}

export interface EscolhasDoPerfil {
  templateId?: string | null;
  themeId?: string | null;
  buttonStyle?: string | null;
  bgColor?: string | null;
  accentColor?: string | null;
  fontId?: string | null;
  coverUrl?: string | null;
  coverPosX?: number | null;
  coverPosY?: number | null;
  coverOverlay?: number | null;
}

/**
 * Aplica a precedência e devolve tokens prontos para renderizar.
 *
 * Uma função só, usada pelo servidor (página pública) e pelo cliente (prévia do
 * editor). É o que garante que a prévia mostre o mesmo que a fã vai ver: dois
 * lugares aplicando as mesmas regras à mão divergem, e o que diverge é sempre o
 * caso que ninguém testou.
 */
export function resolverVisual(escolhas: EscolhasDoPerfil): VisualResolvido {
  const template =
    TEMPLATES.find((t) => t.id === escolhas.templateId) ?? TEMPLATE_PADRAO;
  const tema = THEMES.find((t) => t.id === escolhas.themeId) ?? THEMES[0];
  const fonte =
    FONTES.find((f) => f.id === (escolhas.fontId ?? template.fontePadrao)) ?? FONTES[0];

  return {
    ...template,
    bg: escolhas.bgColor || tema.bg,
    accent: escolhas.accentColor || tema.accent,
    fonteClasse: fonte.classe,
    botao: (escolhas.buttonStyle as LinkButtonStyle) || template.botaoPadrao,
    coverUrl: escolhas.coverUrl ?? null,
    coverPos: `${escolhas.coverPosX ?? 50}% ${escolhas.coverPosY ?? 50}%`,
    overlay: (escolhas.coverOverlay ?? 55) / 100,
  };
}
