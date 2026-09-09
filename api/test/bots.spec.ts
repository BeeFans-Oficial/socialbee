import { detectBot } from "../src/tracking/bots";

/**
 * O filtro de robô.
 *
 * Os dois casos que mais importam neste produto estão aqui e são opostos:
 *
 *   - a prévia do WhatsApp (`WhatsApp/2.xx`) É robô;
 *   - o navegador embutido do Instagram (UA com `Instagram`) NÃO é.
 *
 * Confundir os dois é fácil — o projeto de referência tratava qualquer sinal
 * dessas redes como robô — e o custo é apagar do relatório justamente o
 * tráfego que o produto existe para medir.
 */
describe("detectBot", () => {
  const humanoNoInstagram = {
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0.0.0",
    acceptLanguage: "pt-BR,pt;q=0.9",
    accept: "text/html,application/xhtml+xml",
    method: "GET",
    ip: "203.0.113.10",
  };

  it("não trata o navegador embutido do Instagram como robô", () => {
    const verdict = detectBot(humanoNoInstagram);
    expect(verdict.isBot).toBe(false);
  });

  it("trata a prévia de link do WhatsApp como robô", () => {
    const verdict = detectBot({ ...humanoNoInstagram, userAgent: "WhatsApp/2.23.20.0 A" });
    expect(verdict.isBot).toBe(true);
    expect(verdict.reason).toContain("whatsapp/");
  });

  it("trata robô declarado como robô", () => {
    for (const ua of [
      "facebookexternalhit/1.1",
      "TelegramBot (like TwitterBot)",
      "Googlebot/2.1",
      "curl/8.4.0",
    ]) {
      expect(detectBot({ ...humanoNoInstagram, userAgent: ua }).isBot).toBe(true);
    }
  });

  it("trata ausência de user agent como robô", () => {
    expect(detectBot({ ...humanoNoInstagram, userAgent: "" }).isBot).toBe(true);
  });

  it("não descarta acesso humano só por causa do IP de datacenter", () => {
    // 157.240.0.0/16 é da Meta. Já foi descarte direto, e isso apagava clique
    // real: o IP chega por `x-forwarded-for` e qualquer salto intermediário
    // pode reescrevê-lo — foi o que aconteceu com o Docker Desktop na frente,
    // apresentando um endereço do Google como par da conexão.
    const verdict = detectBot({ ...humanoNoInstagram, ip: "157.240.1.35" });
    expect(verdict.isBot).toBe(false);
    expect(verdict.score).toBe(90);
    expect(verdict.reason).toContain("datacenter");
  });

  it("descarta IP de datacenter somado a qualquer outro sinal", () => {
    // 90 + 60 (sem accept-language) passa do limite de 100.
    const verdict = detectBot({
      ...humanoNoInstagram,
      ip: "157.240.1.35",
      acceptLanguage: undefined,
    });
    expect(verdict.isBot).toBe(true);
  });

  it("trata HEAD como sondagem, não visita", () => {
    expect(detectBot({ ...humanoNoInstagram, method: "HEAD" }).isBot).toBe(true);
  });

  it("exige DOIS sinais fracos para descartar um clique", () => {
    // Só sem accept-language (60 pontos): não é suficiente — um navegador
    // exótico não pode perder o clique da criadora.
    const umSinal = detectBot({ ...humanoNoInstagram, acceptLanguage: undefined });
    expect(umSinal.isBot).toBe(false);

    // Sem idioma E com accept genérico (60 + 50): aí sim.
    const doisSinais = detectBot({
      ...humanoNoInstagram,
      acceptLanguage: undefined,
      accept: "*/*",
    });
    expect(doisSinais.isBot).toBe(true);
  });

  it("não penaliza requisição local por falta de client hints", () => {
    // Em `http://localhost` o navegador não manda `sec-ch-ua` (só em origem
    // segura). Sem esta exceção, todo clique de teste em desenvolvimento
    // entraria como robô.
    const local = detectBot({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      acceptLanguage: "pt-BR",
      accept: "text/html",
      method: "GET",
      ip: "127.0.0.1",
    });
    expect(local.isBot).toBe(false);
  });
});
