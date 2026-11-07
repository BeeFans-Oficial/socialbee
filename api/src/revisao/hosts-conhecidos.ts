/**
 * Classificação do host final de um link, para o simulador da revisão da
 * Meta (`revisao.service.ts`).
 *
 * O que importa para a Meta não é a plataforma do botão (`links.platform`,
 * que a criadora escolhe pelo ícone), e sim ONDE a fã chega depois de todos
 * os saltos. Em 15/10/2026 as contas caíram quando o navegador dela seguiu
 * o `/r/` até o checkout da Privacy; não caíram quando o fim era Telegram.
 *
 * Lista editável, sem migration: host novo entra aqui. A comparação é por
 * sufixo de domínio, então `app.onlyfans.com` e `onlyfans.com` são o mesmo.
 */

export type ClasseDeHost = "checkout_adulto" | "mensageiro" | "rede_social" | "plataforma" | "desconhecido";

const CHECKOUT_ADULTO = [
  "privacy.com.br",
  "onlyfans.com",
  "fansly.com",
  "fatalmodel.com",
  "close.friends",
  "closefriends.com.br",
  "justforfans.com",
  "manyvids.com",
  "loyalfans.com",
  "fanvue.com",
  "xvideos.com",
  "xvideos.red",
  "pornhub.com",
  "cam4.com",
  "chaturbate.com",
  "stripchat.com",
];

const MENSAGEIRO = ["t.me", "telegram.me", "telegram.org", "wa.me", "whatsapp.com", "api.whatsapp.com", "discord.gg", "discord.com"];

const REDE_SOCIAL = [
  "instagram.com",
  "facebook.com",
  "tiktok.com",
  "twitter.com",
  "x.com",
  "youtube.com",
  "youtu.be",
  "twitch.tv",
  "kwai.com",
  "snapchat.com",
  "pinterest.com",
  "threads.net",
  "spotify.com",
];

/** `host` termina com `dominio`, respeitando o ponto: `api.x.com` casa com
 *  `x.com`; `notx.com` não. */
export function pertenceA(host: string, dominio: string): boolean {
  const h = host.toLowerCase().replace(/^www\./, "");
  return h === dominio || h.endsWith(`.${dominio}`);
}

export function classificarHost(host: string, hostsDaPlataforma: string[]): ClasseDeHost {
  const h = host.toLowerCase().replace(/^www\./, "");
  if (hostsDaPlataforma.some((d) => pertenceA(h, d.replace(/^www\./, "")))) return "plataforma";
  if (CHECKOUT_ADULTO.some((d) => pertenceA(h, d))) return "checkout_adulto";
  if (MENSAGEIRO.some((d) => pertenceA(h, d))) return "mensageiro";
  if (REDE_SOCIAL.some((d) => pertenceA(h, d))) return "rede_social";
  return "desconhecido";
}

export const NOME_DA_CLASSE: Record<ClasseDeHost, string> = {
  checkout_adulto: "checkout adulto",
  mensageiro: "mensageiro",
  rede_social: "rede social",
  plataforma: "domínio do BeeSocial",
  desconhecido: "site",
};

/**
 * Termos que saíram da home em 15/10/2026. Se voltarem, a raiz do domínio
 * volta a dizer à Meta exatamente o que ela procura.
 */
export const TERMOS_PROIBIDOS_NA_HOME = ["sair do instagram", "sai do instagram", "domínios de reserva", "dominios de reserva", "página segura", "pagina segura", "link bloqueado", "cloak"];
