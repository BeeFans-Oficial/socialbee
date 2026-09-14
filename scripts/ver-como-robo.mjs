#!/usr/bin/env node
/**
 * Como um cliente NÃO HUMANO vê um perfil.
 *
 * Busca a mesma página com o user agent de cada crawler que importa para este
 * produto e mostra, lado a lado, o que cada um recebeu: a prévia que vai virar
 * cartão no WhatsApp, e — o que mais interessa — se algum título de link ou
 * código curto escapou para o HTML.
 *
 * A checagem de vazamento não é chumbada: o script busca o perfil na API e
 * procura no HTML os títulos e os códigos REAIS daquela criadora. Adicionar um
 * link novo não exige mexer aqui.
 *
 * Por que isto vale um script e não só um `curl`: o sinal que define um crawler
 * de prévia não é o user agent, é **não executar JavaScript**. Um `curl` acerta
 * isso por acidente; o DevTools do Chrome com user agent trocado, não — ele
 * roda o JS e mostra a versão humana. Este script fixa o comportamento certo e
 * ainda compara com um humano na mesma rodada.
 *
 * Uso:
 *   node scripts/ver-como-robo.mjs dourado
 *   node scripts/ver-como-robo.mjs dourado --render   # salva o HTML para abrir
 *   BASE=https://beesocial.app node scripts/ver-como-robo.mjs dourado
 */

import { writeFile } from "node:fs/promises";

const BASE = (process.env.BASE ?? "http://localhost:3000").replace(/\/+$/, "");
const slug = process.argv[2];
const render = process.argv.includes("--render");

if (!slug) {
  console.error("uso: node scripts/ver-como-robo.mjs <slug> [--render]");
  process.exit(1);
}

/** Os que realmente buscam um link colado numa bio ou num chat. */
const CLIENTES = [
  ["Meta (prévia)", "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)"],
  ["Meta (agente)", "meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)"],
  ["Telegram", "TelegramBot (like TwitterBot)"],
  ["WhatsApp", "WhatsApp/2.23.20.0 A"],
  ["Twitter/X", "Twitterbot/1.0"],
  ["Discord", "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)"],
  ["Googlebot", "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"],
  ["curl", "curl/8.4.0"],
];

const HUMANO = [
  "iPhone (Safari)",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
];

/** Cabeçalhos que um navegador de verdade manda e um crawler normalmente não.
 *  Sem eles, o próprio filtro de robô classificaria o "humano" como robô. */
const CABECALHOS_HUMANOS = {
  "accept-language": "pt-BR,pt;q=0.9",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "sec-fetch-mode": "navigate",
  "sec-fetch-dest": "document",
  "upgrade-insecure-requests": "1",
};

async function perfilNaApi() {
  const url = `${BASE}/api/v1/public/profiles/${encodeURIComponent(slug)}`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`perfil /${slug} respondeu ${res.status} em ${url}`);
  return res.json();
}

function meta(html, prop) {
  const re = new RegExp(`<meta[^>]*(?:property|name)="${prop}"[^>]*content="([^"]*)"`, "i");
  return re.exec(html)?.[1] ?? new RegExp(`<meta[^>]*content="([^"]*)"[^>]*(?:property|name)="${prop}"`, "i").exec(html)?.[1] ?? "—";
}

async function buscar(nome, userAgent, humano = false) {
  const res = await fetch(`${BASE}/${encodeURIComponent(slug)}`, {
    headers: { "user-agent": userAgent, ...(humano ? CABECALHOS_HUMANOS : {}) },
    redirect: "manual",
  });
  return { nome, status: res.status, html: await res.text() };
}

/**
 * O servidor está em modo de desenvolvimento?
 *
 * Importa muito para a leitura do resultado: o `next dev` embute no HTML o
 * payload de depuração e o de recarga a quente, e ali dentro vai a resposta
 * inteira da API — títulos de link incluídos. A checagem de vazamento acusa,
 * corretamente, e o dado NÃO está na página de produção.
 *
 * Sem este aviso o time veria "VAZOU" em toda execução local e aprenderia a
 * ignorar a única linha que precisa ser levada a sério.
 */
function emDesenvolvimento(html) {
  return html.includes("react-refresh") || html.includes("__nextDevClientId") || html.includes("/_next/static/chunks/main-app.js");
}

const perfil = await perfilNaApi();
const titulos = perfil.links.map((l) => l.title);
const codigos = perfil.links.map((l) => l.shortCode);

console.log(`\nPerfil: /${slug} — "${perfil.profile.displayName}" · ${perfil.links.length} link(s) ativo(s)`);
console.log(`Base:   ${BASE}\n`);

/**
 * Em qual ramo o cliente caiu.
 *
 * O rodapé "Powered by BeeSocial" só existe no `ProfileClient` — a versão
 * humana. O `BotProfile` renderiza apenas o cabeçalho. É o discriminador mais
 * estável que o HTML oferece, e é o que responde a pergunta que a tabela existe
 * para responder: "quem viu o quê".
 */
function ramo(html) {
  return html.includes("Powered by BeeSocial") ? "humano" : "não humano";
}

const linha = (r) => {
  const vazou = [
    ...titulos.filter((t) => r.html.includes(t)),
    ...codigos.filter((c) => r.html.includes(c)),
  ];
  return {
    cliente: r.nome,
    status: r.status,
    ramo: ramo(r.html),
    KB: Math.round(r.html.length / 1024),
    nome: r.html.includes(perfil.profile.displayName) ? "sim" : "não",
    bio: perfil.profile.bio && r.html.includes(perfil.profile.bio) ? "sim" : "—",
    "links no HTML": vazou.length ? `VAZOU: ${vazou.join(", ")}` : "nenhum",
  };
};

const resultados = [];
let dev = false;
for (const [nome, ua] of CLIENTES) {
  const r = await buscar(nome, ua);
  dev = dev || emDesenvolvimento(r.html);
  resultados.push(linha(r));
}
const humano = await buscar(HUMANO[0], HUMANO[1], true);
resultados.push(linha(humano));
console.table(resultados);

if (dev) {
  console.log(
    "AVISO: servidor em modo de desenvolvimento. O `next dev` embute o payload\n" +
      "de depuração no HTML, e a resposta da API vai dentro dele — por isso a\n" +
      "coluna de vazamento acusa. Para a checagem valer, rode contra o build:\n" +
      "  npm run build && npm start   (ou o container)\n",
  );
}

const primeiro = await buscar(CLIENTES[0][0], CLIENTES[0][1]);
console.log("Prévia que o crawler da Meta gera:");
console.log(`  título:    ${meta(primeiro.html, "og:title")}`);
console.log(`  descrição: ${meta(primeiro.html, "og:description")}`);
console.log(`  imagem:    ${meta(primeiro.html, "og:image")}`);
console.log(`  url:       ${meta(primeiro.html, "og:url")}`);

if (render) {
  /**
   * Salva o HTML do crawler para inspeção visual.
   *
   * Duas transformações, cada uma por um motivo:
   *
   * 1. **Fora os `<script>`.** Um cliente que não roda JS não os executa, e
   *    mantê-los faria a página hidratar no navegador e virar a versão humana —
   *    o arquivo mostraria exatamente o que ele não deveria mostrar.
   * 2. **Caminhos relativos viram absolutos.** Sem isso o CSS não carrega e a
   *    página abre sem estilo nenhum. A primeira versão salvava em `public/`
   *    para resolver isso, mas arquivo escrito ali depois do build não é
   *    servido (o Next lê o manifesto de estáticos no build) e a requisição
   *    caía na rota `/[slug]`, virando "perfil não encontrado".
   */
  const html = primeiro.html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/g, "")
    .replaceAll('href="/', `href="${BASE}/`)
    .replaceAll('src="/', `src="${BASE}/`);

  const destino = ".visao-do-bot.html";
  await writeFile(destino, html, "utf8");
  console.log(`\nHTML do crawler salvo em ${destino}, sem scripts e com os assets`);
  console.log(`apontando para ${BASE}. Abra o arquivo no navegador para ver desenhado:`);
  console.log(`  open ${destino}`);
}

const naoHumanos = resultados.slice(0, CLIENTES.length);
const algumVazou = naoHumanos.some((r) => String(r["links no HTML"]).startsWith("VAZOU"));

if (algumVazou && !dev) {
  // Só falha fora do modo dev: em dev o "vazamento" é o payload de depuração,
  // e um script que sempre falha não é um teste, é um ruído.
  console.error("\nFALHA: link de destino no HTML entregue a um cliente não humano.");
  process.exit(1);
}
if (!algumVazou) {
  console.log("\nNenhum título de link ou código curto no HTML dos clientes não humanos.");
}
