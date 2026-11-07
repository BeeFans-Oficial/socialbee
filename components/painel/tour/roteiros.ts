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
  /**
   * Passo de reserva para o estado VAZIO: só entra quando este outro alvo
   * NÃO está na tela. Numa página sem links, a alça de arrastar não existe,
   * mas a caixa "Nenhum link ainda" existe — e é nela que se explica o que a
   * lista vai permitir. Sem isso, o tour de uma tela vazia era um passo só.
   */
  exigeAusente?: string;
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
        alvo: "adicionar-capa",
        exigeAusente: "capa",
        titulo: "Comece pela foto de capa",
        texto: "Toque aqui para escolher uma foto. Depois dá para ajustar a posição arrastando, trocar ou remover.",
      },
      {
        alvo: "foto-de-perfil",
        titulo: "Sua foto de perfil",
        texto: "Toque no círculo para escolher ou trocar a foto. Ela sobe na hora.",
      },
      {
        alvo: "sair-do-instagram",
        titulo: "Por que sair do Instagram",
        texto:
          "Quem toca no seu link de dentro do Instagram abre a página num navegador escondido do app, onde login e pagamento costumam falhar. Em Automático, a fã vê primeiro uma tela com a sua foto e um botão que abre a página no navegador do celular, onde tudo funciona. Em Manual, ela entra direto, ainda dentro do Instagram.",
      },
      {
        alvo: "barreira-de-idade",
        titulo: "Barreira de idade",
        texto:
          "Ligada, a fã precisa confirmar que tem 18 anos ou mais antes de ver os seus botões. É a sua proteção para conteúdo adulto, e vale para quem chega por qualquer caminho.",
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
    // Escrito para quem nunca viu um "link na bio": primeiro o que a tela é,
    // depois o gesto principal, depois o resto. Sem jargão: "botão" em vez de
    // "link" sempre que dá, "para onde leva" em vez de "destino".
    passos: [
      {
        alvo: "titulo-da-tela",
        titulo: "Esta tela é a lista dos seus botões",
        texto: "Cada botão fica na sua página e leva a fã para um lugar: seu OnlyFans, WhatsApp, Telegram, o que você quiser.",
      },
      {
        alvo: "novo-link",
        titulo: "Comece criando um botão",
        texto: "Toque em Novo link, escolha onde ele leva, dê um nome e cole o endereço. Pronto, ele já aparece na sua página.",
      },
      {
        alvo: "links-vazio",
        exigeAusente: "arrastar",
        titulo: "Seus botões vão aparecer aqui",
        texto: "Depois de criar, cada botão vira uma linha nesta lista, na mesma ordem em que aparece na sua página.",
      },
      {
        alvo: "arrastar",
        titulo: "A ordem daqui é a ordem da página",
        texto: "Segure esta alça e arraste para cima ou para baixo. O primeiro da lista é o primeiro que a fã vê.",
      },
      {
        alvo: "ligar",
        titulo: "Esconda sem apagar",
        texto: "Desligado, o botão some da página mas fica guardado aqui. Ligue de novo quando quiser.",
      },
      {
        alvo: "cliques",
        titulo: "Quantas pessoas clicaram",
        texto: "Este número é de pessoas de verdade. Toque nele para ver de onde vieram e pelo que entraram. É do plano Pro.",
        so: "computador",
      },
      {
        alvo: "editar-link",
        titulo: "Mude o botão quando quiser",
        texto: "Nome, endereço, proteção e a cor do botão ficam no editor, com a prévia da sua página ao lado.",
      },
      {
        alvo: "copiar-pagina",
        titulo: "Este é o endereço que vai na bio",
        texto: "Copia o link da SUA página, com todos os botões. É ele que você cola no Instagram, não o endereço de um botão só.",
        so: "computador",
      },
    ],
  },
  {
    id: "editor-de-link",
    rota: /^\/links\/[^/]+$/,
    nome: "Editor do link",
    passos: [
      {
        alvo: "novo-link-form",
        exigeAusente: "destino",
        titulo: "Crie o seu link",
        texto: "Escolha a plataforma, dê um título e cole o destino. Proteção e aparência do botão vêm logo depois de criar.",
      },
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
        alvo: "filtros",
        titulo: "Período e recortes",
        texto: "7, 30, 90 dias ou duas datas. Depois, só um link, uma origem, um aparelho ou quem veio de dentro de app. Os números e o gráfico acompanham, e o recorte fica no endereço da página.",
      },
      {
        alvo: "grafico",
        titulo: "Dia a dia",
        texto: "Visualizações em cinza, cliques em rosa. Passe o dedo ou o mouse para ver cada dia.",
      },
      {
        alvo: "sem-trafego",
        exigeAusente: "origem",
        titulo: "Ainda sem cliques",
        texto: "Abra a sua página e toque num link: ele aparece aqui na hora. Com cliques, você vê também de onde cada um veio.",
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
