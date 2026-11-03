/**
 * O conteúdo do tour guiado: um roteiro por tela, cada um com poucos passos.
 *
 * Cada passo aponta para um elemento marcado com `data-tour="<alvo>"`. O
 * motor (`Tour.tsx`) procura o alvo na tela; se ele não existe naquele momento
 * (a criadora ainda não tem foto de capa, ou está no computador e o passo é
 * do celular), o passo é pulado — o roteiro não quebra por isso.
 *
 * Regras do texto: uma ideia por passo, até duas linhas, no tom do produto.
 * Diz o que a pessoa GANHA com aquilo, não o nome técnico do botão.
 */

export interface Passo {
  /** Valor de `data-tour` do elemento apontado. */
  alvo: string;
  titulo: string;
  texto: string;
  /** Só aparece nesta largura de tela. Sem valor: nas duas. */
  so?: "celular" | "computador";
}

export interface Roteiro {
  id: string;
  /** A rota em que o roteiro vale. */
  rota: RegExp;
  /** Nome curto, para o item "Ver o guia" no menu. */
  nome: string;
  passos: Passo[];
}

export const ROTEIROS: Roteiro[] = [
  {
    id: "paginas",
    rota: /^\/paginas$/,
    nome: "Páginas",
    passos: [
      {
        alvo: "seletor-de-pagina",
        titulo: "Esta é a página que você está editando",
        texto: "Tudo no painel fala desta página: links, visual e relatório. Com mais de uma, troque aqui.",
      },
      {
        alvo: "nova-pagina",
        titulo: "Crie quantas páginas quiser",
        texto: "Uma para cada perfil ou campanha. Cada uma tem o próprio endereço, modelo e links.",
      },
      {
        alvo: "cartao-da-pagina",
        titulo: "O cartão de cada página",
        texto: "Editar abre o visual, os textos e a proteção. Copiar link entrega o endereço pronto para a bio.",
      },
      {
        alvo: "barra-inferior",
        titulo: "Para onde ir",
        texto: "Páginas, Links e Analytics ficam sempre aqui embaixo. Em Mais estão domínio, conta e sair.",
        so: "celular",
      },
      {
        alvo: "barra-lateral",
        titulo: "Para onde ir",
        texto: "Páginas, Links, Analytics e Domínio próprio. Configurações e sair ficam no menu da conta, no topo.",
        so: "computador",
      },
    ],
  },
  {
    id: "editor-de-pagina",
    rota: /^\/paginas\/[^/]+$/,
    nome: "Editor da página",
    passos: [
      {
        alvo: "previa",
        titulo: "É assim que a fã vê",
        texto: "A prévia é a sua página de verdade, no celular. Cada ajuste aparece aqui na hora.",
        so: "computador",
      },
      {
        alvo: "botao-previa",
        titulo: "Veja como está ficando",
        texto: "Toque em Prévia para abrir a sua página por cima do painel, a qualquer momento.",
        so: "celular",
      },
      {
        alvo: "capa",
        titulo: "A foto de capa",
        texto: "Toque em Capa para ajustar a posição arrastando a foto, trocar ou remover.",
      },
      {
        alvo: "foto-de-perfil",
        titulo: "Sua foto de perfil",
        texto: "Toque no círculo para escolher ou trocar a foto. Ela sobe na hora.",
      },
      {
        alvo: "protecao",
        titulo: "Proteção",
        texto: "Sair do Instagram leva a fã ao navegador do celular, onde pagamento e login funcionam. A barreira pede 18+.",
      },
      {
        alvo: "no-ar",
        titulo: "No ar ou fora do ar",
        texto: "Fora do ar, a página some para o público e tudo fica guardado. Ligue de novo quando quiser.",
      },
      {
        alvo: "ver-pagina",
        titulo: "Abra a sua página",
        texto: "Ver página abre o endereço público numa aba nova. O ícone ao lado leva aos links dela.",
      },
    ],
  },
  {
    id: "links",
    rota: /^\/links$/,
    nome: "Links",
    passos: [
      {
        alvo: "novo-link",
        titulo: "Seus botões nascem aqui",
        texto: "Cada link vira um botão na sua página. Escolha a plataforma, o título e o destino.",
      },
      {
        alvo: "arrastar",
        titulo: "A ordem é a da página",
        texto: "Segure e arraste pela alça para reordenar. A nova ordem é salva sozinha.",
      },
      {
        alvo: "ligar",
        titulo: "Ligue e desligue",
        texto: "Desligado, o botão some da página mas continua aqui. Nada é apagado.",
      },
      {
        alvo: "cliques",
        titulo: "Quantos cliques",
        texto: "Toque no número para ver origem, dispositivo e país de quem clicou. É do plano Pro.",
        so: "computador",
      },
      {
        alvo: "editar-link",
        titulo: "Editar o link",
        texto: "Destino, proteção e aparência do botão ficam no editor, com a prévia ao lado.",
      },
    ],
  },
  {
    id: "editor-de-link",
    rota: /^\/links\/[^/]+$/,
    nome: "Editor do link",
    passos: [
      {
        alvo: "destino",
        titulo: "Para onde o botão leva",
        texto: "Cole o endereço completo, começando com https://. Salva ao sair do campo.",
      },
      {
        alvo: "cloaking",
        titulo: "Página segura",
        texto: "Ligado, quem não deve ver o destino recebe só as suas redes. Precisa de pelo menos uma rede cadastrada.",
      },
      {
        alvo: "aparencia-do-botao",
        titulo: "A cara do botão",
        texto: "Estilo e cor valem só para este botão. Sem escolha, ele segue o visual da página.",
      },
    ],
  },
  {
    id: "analytics",
    rota: /^\/analytics$/,
    nome: "Analytics",
    passos: [
      {
        alvo: "metricas",
        titulo: "Os números do período",
        texto: "Visitas, cliques e quantos vieram de dentro de um aplicativo. Robôs e prévias de link não contam.",
      },
      {
        alvo: "periodo",
        titulo: "Mude o período",
        texto: "7, 30 ou 90 dias. Os números e o gráfico acompanham.",
      },
      {
        alvo: "grafico",
        titulo: "Dia a dia",
        texto: "Visualizações em cinza, cliques em rosa. Passe o dedo ou o mouse para ver cada dia.",
      },
      {
        alvo: "origem",
        titulo: "De onde vem o público",
        texto: "Cada origem com a sua fatia dos cliques. É o que diz onde vale a pena divulgar.",
      },
    ],
  },
];

export function roteiroDaRota(pathname: string): Roteiro | null {
  return ROTEIROS.find((r) => r.rota.test(pathname)) ?? null;
}
