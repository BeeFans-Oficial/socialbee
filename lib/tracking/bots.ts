import type { BotVerdict } from "./types";

/**
 * Filtro de robô.
 *
 * Adaptado do cloaker do bee-api-2, com uma diferença de propósito que muda o
 * que o código faz: lá o veredito decide se o visitante vê o destino ou uma
 * página neutra (cloaking, que é o que expõe o domínio a bloqueio da Meta).
 * Aqui o veredito decide **apenas se o clique conta**. Robô é redirecionado
 * normalmente; só não entra na estatística.
 *
 * Isso importa mais em link na bio do que em anúncio: cada link colado no
 * WhatsApp, Telegram, Discord ou Slack gera uma requisição de prévia. Sem
 * filtro, um link compartilhado num grupo grande nasce com dezenas de "cliques"
 * que ninguém deu.
 */

/** Robôs que se identificam no user agent.
 *
 *  Cobre quatro grupos: geradores de prévia das redes (o volume real neste
 *  produto), buscadores, ferramentas de SEO e clientes HTTP de script.
 *
 *  Atenção a "instagram" e "whatsapp": no bee-api-2 eles estão nesta lista
 *  porque lá qualquer sinal dessas redes é robô de revisão. Aqui NÃO podem
 *  estar — o navegador embutido do Instagram manda `Instagram` no UA e é
 *  exatamente o tráfego humano que este produto existe para medir. A prévia do
 *  WhatsApp é distinguida pelo sufixo, tratado logo abaixo. */
const BOT_USER_AGENTS = [
  // Prévia de link das redes
  "facebookexternalhit",
  "facebookcatalog",
  "meta-externalagent",
  "facebookbot",
  "twitterbot",
  "telegrambot",
  "linkedinbot",
  "pinterest",
  "slackbot",
  "discordbot",
  "redditbot",
  "skypeuripreview",
  "vkshare",
  "whatsapp/", // o cliente de prévia; o navegador embutido não usa esta forma
  // Buscadores
  "googlebot",
  "google-inspectiontool",
  "adsbot-google",
  "bingbot",
  "yandexbot",
  "duckduckbot",
  "baiduspider",
  "applebot",
  "bytespider",
  // SEO e scraping
  "ahrefsbot",
  "semrushbot",
  "mj12bot",
  "dotbot",
  "petalbot",
  "archive.org_bot",
  "crawler",
  "spider",
  "scrapy",
  // Automação e clientes HTTP
  "headlesschrome",
  "phantomjs",
  "puppeteer",
  "playwright",
  "selenium",
  "curl/",
  "wget/",
  "python-requests",
  "python-urllib",
  "go-http-client",
  "okhttp",
  "java/",
  "axios/",
  "node-fetch",
  "libwww-perl",
  "httpclient",
  "monitoring",
  "uptime",
] as const;

/** Faixas de datacenter das plataformas.
 *
 *  Lista curta e conservadora de propósito, como no projeto de referência: só
 *  infraestrutura comprovada das redes, nunca operadora de celular. Um falso
 *  positivo aqui apaga clique humano do relatório, o que é pior do que deixar
 *  passar um robô. */
const DATACENTER_CIDRS = [
  // Meta / Facebook
  "31.13.24.0/21",
  "31.13.64.0/18",
  "66.220.144.0/20",
  "69.63.176.0/20",
  "69.171.224.0/19",
  "74.119.76.0/22",
  "103.4.96.0/22",
  "129.134.0.0/16",
  "157.240.0.0/16",
  "173.252.64.0/18",
  "179.60.192.0/22",
  "185.60.216.0/22",
  "204.15.20.0/22",
  // Google
  "64.233.160.0/19",
  "66.102.0.0/20",
  "66.249.64.0/19",
  "72.14.192.0/18",
  "74.125.0.0/16",
  "108.177.0.0/17",
  "142.250.0.0/15",
  "172.217.0.0/16",
  "209.85.128.0/17",
  "216.58.192.0/19",
  // ByteDance / TikTok
  "110.44.112.0/20",
  "161.117.0.0/16",
] as const;

/** CIDRs pré-compilados em [rede, máscara] de 32 bits. Feito uma vez no load do
 *  módulo: o caminho quente do redirecionador não pode pagar parse de string. */
const DATACENTER_NETS: Array<[number, number]> = DATACENTER_CIDRS.map((cidr) => {
  const [addr, bitsRaw] = cidr.split("/");
  const bits = Number(bitsRaw);
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return [(ipv4ToInt(addr) & mask) >>> 0, mask];
});

function ipv4ToInt(ip: string): number {
  const parts = ip.split(".");
  if (parts.length !== 4) return -1;
  let out = 0;
  for (const part of parts) {
    const n = Number(part);
    if (!Number.isInteger(n) || n < 0 || n > 255) return -1;
    out = ((out << 8) | n) >>> 0;
  }
  return out >>> 0;
}

function isDatacenterIP(ip: string): boolean {
  const value = ipv4ToInt(ip);
  if (value < 0) return false; // IPv6 e entrada inválida: sem opinião
  return DATACENTER_NETS.some(([net, mask]) => ((value & mask) >>> 0) === net);
}

/** Sinais de requisição que o filtro pondera. Só cabeçalhos — nada de corpo. */
export interface BotSignals {
  userAgent: string;
  ip?: string;
  method?: string;
  acceptLanguage?: string;
  accept?: string;
  secChUa?: string;
  secFetchMode?: string;
}

/** Acima disto o acesso é tratado como robô. Calibrado para exigir DOIS sinais
 *  fracos: um só (um navegador exótico sem client hints, por exemplo) não pode
 *  descartar um clique real. */
const BOT_THRESHOLD = 100;

export function detectBot(signals: BotSignals): BotVerdict {
  const ua = (signals.userAgent || "").toLowerCase();

  // Descarte direto 1: robô declarado.
  for (const bot of BOT_USER_AGENTS) {
    if (ua.includes(bot)) {
      return { isBot: true, score: 1000, reason: `user agent de robô: ${bot}` };
    }
  }

  // Descarte direto 2: sem user agent. Nenhum navegador omite.
  if (!ua.trim()) {
    return { isBot: true, score: 1000, reason: "sem user agent" };
  }

  // Descarte direto 3: IP de datacenter de plataforma.
  if (signals.ip && isDatacenterIP(signals.ip)) {
    return { isBot: true, score: 1000, reason: "IP de datacenter de plataforma" };
  }

  let score = 0;
  const reasons: string[] = [];
  const add = (points: number, why: string) => {
    score += points;
    reasons.push(why);
  };

  // HEAD é sondagem, não visita. Vale 100 sozinho: nenhuma navegação humana
  // chega por HEAD, então isto é conclusivo por si.
  if ((signals.method || "").toUpperCase() === "HEAD") {
    add(100, "requisição HEAD");
  }

  // Navegador real sempre declara idioma preferido.
  if (!signals.acceptLanguage) add(60, "sem accept-language");

  // Accept genérico é assinatura de cliente HTTP.
  const accept = signals.accept || "";
  if (!accept || accept === "*/*") add(50, "accept genérico");

  // UA dizendo Chrome sem client hints é UA forjado. Chrome manda sec-ch-ua
  // desde a 89 — mas só em contexto seguro, então em HTTP local não vale nada.
  if (ua.includes("chrome/") && !signals.secChUa && !isLocalRequest(signals.ip)) {
    add(60, "UA Chrome sem client hints");
  }

  if (score >= BOT_THRESHOLD) {
    return { isBot: true, score, reason: reasons.join("; ") };
  }
  return { isBot: false, score, reason: reasons.length ? reasons.join("; ") : "ok" };
}

/** Requisição de loopback. Em desenvolvimento os client hints não chegam (o
 *  navegador só os manda em origem segura), e sem esta exceção todo clique de
 *  teste local viraria robô. */
function isLocalRequest(ip?: string): boolean {
  if (!ip) return true;
  return ip === "127.0.0.1" || ip === "::1" || ip.startsWith("192.168.") || ip.startsWith("10.");
}
