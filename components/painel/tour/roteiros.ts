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
   * NÃO está na tela. Num perfil sem links, a alça de arrastar não existe,
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

/**
 * Os ids levam em conta o DESENHO da tela, não só a rota: o motor guarda por
 * id o que cada conta já viu, e um roteiro reescrito para um desenho novo
 * (perfis com abas e donos, novembro de 2026) ganhou id novo para voltar a
 * aparecer uma vez para quem já tinha visto o antigo.
 */
export const ROTEIROS: Roteiro[] = [
  {
    id: "perfis",
    rota: /^\/paginas$/,
    nome: "Perfis",
    passos: [
      {
        alvo: "cartao-da-pagina",
        titulo: "Cada cartão é um perfil",
        texto: "Um perfil é um endereço para a bio, com os próprios links, visual e relatório. Abrir entra nele; Copiar link entrega o endereço pronto.",
      },
      {
        alvo: "renomear-perfil",
        titulo: "Mude o nome aqui mesmo",
        texto: "O lápis troca o nome do perfil sem sair da lista. O endereço não muda, então o link da bio continua valendo.",
      },
      {
        alvo: "nova-pagina",
        titulo: "Crie quantos perfis precisar",
        texto: "Um para cada pessoa ou campanha. Cada um nasce com endereço próprio e você monta o resto depois.",
      },
      {
        alvo: "novo-dono",
        exigeAusente: "filtro-de-donos",
        titulo: "Cuida dos perfis de mais gente?",
        texto: "Crie um dono para cada pessoa. A lista passa a vir separada por dono, e você vê os perfis de um por vez.",
      },
      {
        alvo: "filtro-de-donos",
        titulo: "Veja os perfis de um dono por vez",
        texto: "Toque num dono para ver só os perfis dele. Todos mostra a lista inteira, separada por dono. A escolha fica guardada.",
      },
      {
        alvo: "dono-no-cartao",
        titulo: "De quem é este perfil",
        texto: "Troque o dono por aqui para mover o perfil de um grupo para outro. É só organização: nada muda para a fã.",
      },
      {
        alvo: "barra-inferior",
        titulo: "Para onde ir",
        texto: "Perfis, Saúde e Domínio ficam sempre aqui embaixo. Links e analytics estão dentro de cada perfil. Em Mais estão conta e sair.",
        so: "celular",
      },
      {
        alvo: "barra-lateral",
        titulo: "Para onde ir",
        texto: "Perfis, Saúde e Domínio próprio. Links e analytics estão dentro de cada perfil. Configurações e sair ficam no menu da conta, no topo.",
        so: "computador",
      },
    ],
  },
  {
    id: "aparencia-do-perfil",
    rota: /^\/paginas\/[^/]+$/,
    nome: "Aparência do perfil",
    passos: [
      {
        alvo: "abas-da-pagina",
        titulo: "Esta é a aba Aparência",
        texto: "Aqui você cuida de como o perfil aparece. Os botões se configuram na aba Links; a checagem e os números, nas outras duas.",
      },
      {
        alvo: "previa",
        titulo: "É assim que a fã vê",
        texto: "A prévia é o seu perfil de verdade, no celular. Cada ajuste aparece aqui na hora.",
        so: "computador",
      },
      {
        alvo: "botao-previa",
        titulo: "Veja como está ficando",
        texto: "Toque em Prévia para abrir o seu perfil por cima do painel, a qualquer momento.",
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
          "Quem toca no seu link de dentro do Instagram abre o perfil num navegador escondido do app, onde login e pagamento costumam falhar. Em Automático, a fã vê primeiro uma tela com a sua foto e um botão que abre o perfil no navegador do celular, onde tudo funciona. Em Manual, ela entra direto, ainda dentro do Instagram.",
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
        texto: "Fora do ar, o perfil some para o público e tudo fica guardado. Ligue de novo quando quiser.",
      },
      {
        alvo: "aparencia-dos-botoes",
        titulo: "A cara de cada botão",
        texto: "Abra um botão para mudar estilo, cor, ícone e seta só dele. A prévia mostra o resultado no meio dos outros.",
      },
      {
        alvo: "ver-pagina",
        titulo: "Abra o seu perfil",
        texto: "Ver perfil abre o endereço público numa aba nova. O ícone ao lado leva aos links dele.",
      },
    ],
  },
  {
    id: "links-do-perfil",
    rota: /^\/links$/,
    nome: "Links",
    // Escrito para quem nunca viu um "link na bio": primeiro onde a pessoa
    // está, depois o gesto principal, depois o resto. Sem jargão: "botão" em
    // vez de "link" sempre que dá, "para onde leva" em vez de "destino".
    passos: [
      {
        alvo: "abas-da-pagina",
        titulo: "Você está dentro de um perfil",
        texto: "Estas abas são tudo o que é dele: os links, a aparência, a saúde e o relatório.",
      },
      {
        alvo: "seletor-de-pagina",
        titulo: "Troque de perfil sem voltar",
        texto: "Toque no nome para ir a outro perfil, na mesma aba. Com donos, a lista vem separada por dono.",
      },
      {
        alvo: "titulo-da-tela",
        titulo: "Esta tela é a lista dos seus botões",
        texto: "Cada botão fica no seu perfil e leva a fã para um lugar: seu OnlyFans, WhatsApp, Telegram, o que você quiser.",
      },
      {
        alvo: "novo-link",
        titulo: "Comece criando um botão",
        texto: "Toque em Novo link, escolha onde ele leva, dê um nome e cole o endereço. Pronto, ele já aparece no seu perfil.",
      },
      {
        alvo: "links-vazio",
        exigeAusente: "arrastar",
        titulo: "Seus botões vão aparecer aqui",
        texto: "Depois de criar, cada botão vira uma linha nesta lista, na mesma ordem em que aparece no seu perfil.",
      },
      {
        alvo: "arrastar",
        titulo: "A ordem daqui é a ordem do perfil",
        texto: "Segure esta alça e arraste para cima ou para baixo. O primeiro da lista é o primeiro que a fã vê.",
      },
      {
        alvo: "ligar",
        titulo: "Esconda sem apagar",
        texto: "Desligado, o botão some do perfil mas fica guardado aqui. Ligue de novo quando quiser.",
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
        texto: "Nome, endereço e proteção ficam no editor do botão. A cor e o estilo dele ficam na aba Aparência, com a prévia do perfil.",
      },
      {
        alvo: "copiar-pagina",
        titulo: "Este é o endereço que vai na bio",
        texto: "Copia o link do SEU perfil, com todos os botões. É ele que você cola no Instagram, não o endereço de um botão só.",
        so: "computador",
      },
    ],
  },
  {
    id: "configurar-link",
    rota: /^\/links\/[^/]+$/,
    nome: "Editor do link",
    passos: [
      {
        alvo: "novo-link-form",
        exigeAusente: "destino",
        titulo: "Crie o seu link",
        texto: "Escolha a plataforma, dê um título e cole o destino. A proteção vem logo depois de criar.",
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
        titulo: "A cara do botão fica em Aparência",
        texto: "Esta tela é só configuração. Estilo e cor ficam na aba Aparência, onde a prévia mostra o botão dentro do perfil inteiro.",
      },
    ],
  },
  {
    id: "saude",
    rota: /^\/saude$/,
    nome: "Saúde",
    passos: [
      {
        alvo: "resumo-da-saude",
        titulo: "Seus perfis, conferidos",
        texto: "Quantos estão verdes, quantos pedem correção e quantos nunca foram checados. Verde é 'nenhum sinal do que derruba contas', não aprovação da Meta.",
      },
      {
        alvo: "lista-da-saude",
        titulo: "Uma linha por perfil",
        texto: "A última checagem, quando foi e o que falta. Clique na linha para ver as quatro camadas e o histórico.",
      },
      {
        alvo: "checar-todas",
        titulo: "Checar todos de uma vez",
        texto: "Roda a checagem em cada perfil. Leva alguns segundos por perfil; a automática roda sozinha todo dia às 5h.",
      },
    ],
  },
  {
    // Id novo com os indicadores e o funil (novembro de 2026): quem já viu o
    // roteiro antigo, de cinco passos, vê este uma vez.
    id: "analytics-com-funil",
    rota: /^\/analytics$/,
    nome: "Analytics",
    passos: [
      {
        alvo: "metricas",
        titulo: "Os números do período",
        texto: "Visitas, visitantes, cliques e quantos vieram de dentro de um aplicativo, comparados com o período anterior. Robôs e prévias de link não contam.",
      },
      {
        alvo: "filtros",
        titulo: "Período e recortes",
        texto: "7, 30, 90 dias ou duas datas. Depois, só um link, uma origem, um aparelho ou quem veio de dentro de app. Os números e o gráfico acompanham, e o recorte fica no endereço da página.",
      },
      {
        alvo: "indicadores",
        titulo: "A leitura pronta",
        texto: "Conversão é quantas pessoas, das que abriram, clicaram em algum link. Ao lado: onde a página mais perde gente, quanto tempo levam para clicar e quantas saem do aplicativo.",
      },
      {
        alvo: "funil",
        titulo: "Até onde cada pessoa foi",
        texto: "Cada faixa é uma etapa, e ela estreita conforme as pessoas param. Ao lado: quantas acessaram, quantas pararam ali e quantas fecharam a página. O selo marca a maior perda.",
      },
      {
        alvo: "funil-links",
        titulo: "Em qual link clicaram",
        texto: "A última etapa aberta por link: quantas pessoas foram a cada um. Toque numa linha para ver o relatório inteiro só de quem clicou nele.",
      },
      {
        alvo: "grafico",
        titulo: "Dia a dia",
        texto: "Visualizações em cinza, cliques em rosa. Passe o dedo ou o mouse para ver cada dia.",
      },
      {
        alvo: "horarios",
        titulo: "A melhor hora para postar",
        texto: "Visitas e cliques por hora do dia, no seu fuso. A barra mais forte é o pico: é quando vale publicar o story com o link.",
      },
      {
        alvo: "sem-trafego",
        exigeAusente: "origem",
        titulo: "Ainda sem cliques",
        texto: "Abra o seu perfil e toque num link: ele aparece aqui na hora. Com cliques, você vê também de onde cada um veio.",
      },
      {
        alvo: "origem",
        titulo: "De onde vem o público",
        texto: "Cada origem com a sua fatia dos cliques. É o que diz onde vale a pena divulgar.",
      },
      {
        alvo: "passo-a-passo",
        titulo: "O caminho de cada visitante",
        texto: "Uma linha por pessoa, com até onde ela foi. Toque na linha para abrir o caminho dela, passo a passo, e toque de novo para recolher.",
      },
    ],
  },
];

export function roteiroDaRota(pathname: string): Roteiro | null {
  return ROTEIROS.find((r) => r.rota.test(pathname)) ?? null;
}
