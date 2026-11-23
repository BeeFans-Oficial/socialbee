import { resolver, TrackingService } from "../src/tracking/tracking.service";
import { countryOfIp } from "../src/tracking/geo";
import type { TrackingEventRecord } from "../src/tracking/types";

/**
 * A resolução de origem e de visitante do relatório.
 *
 * É dedução, não dado gravado — e dedução errada não quebra nada, só muda de
 * onde a criadora acha que o tráfego vem.
 */

const HOST = "camila.site";
const T0 = new Date("2026-11-22T12:00:00Z").getTime();

function evento(
  type: string,
  minuto: number,
  extra: {
    visitor?: string;
    net?: string;
    inApp?: string;
    source?: string;
    campaign?: string;
    referrerHost?: string;
    ipPrefix?: string;
    userAgent?: string;
    linkId?: string;
  } = {},
): TrackingEventRecord {
  return {
    type,
    profileId: "p1",
    linkId: extra.linkId,
    channel: extra.linkId,
    arrivalHost: HOST,
    occurredAt: new Date(T0 + minuto * 60_000),
    attribution: { clickIds: {}, source: extra.source, campaign: extra.campaign, referrerHost: extra.referrerHost },
    client: {
      device: "mobile",
      visitor: extra.visitor,
      net: extra.net,
      inAppBrowser: extra.inApp,
      ipPrefix: extra.ipPrefix,
      userAgent: extra.userAgent,
    },
  };
}

describe("resolver", () => {
  it("o clique herda a origem da chegada do mesmo visitante", () => {
    const [chegada, visita, clique] = resolver([
      evento("arrival", 0, { visitor: "v1", net: "n1", source: "tiktok", campaign: "bio" }),
      evento("view", 1, { visitor: "v1", net: "n1" }),
      evento("click", 2, { visitor: "v1", net: "n1" }),
    ]);
    expect(chegada.origem).toBe("tiktok");
    expect(visita.origem).toBe("tiktok");
    expect(clique.origem).toBe("tiktok");
    expect(clique.campanha).toBe("bio");
  });

  it("costura a saída do aplicativo: a visita no navegador de fora é do Instagram e da mesma pessoa", () => {
    // Página adulta: dentro do app só a chegada acontece. A visita e o clique
    // vêm depois, do navegador do celular — outro user-agent, mesma rede.
    const [noApp, fora, clique] = resolver([
      evento("arrival", 0, { visitor: "app", net: "n1", inApp: "instagram", referrerHost: "l.instagram.com" }),
      evento("view", 1, { visitor: "safari", net: "n1" }),
      evento("click", 2, { visitor: "safari", net: "n1" }),
    ]);
    expect(noApp.origem).toBe("instagram");
    expect(fora.origem).toBe("instagram");
    expect(clique.origem).toBe("instagram");
    expect(fora.visitante).toBe(noApp.visitante);
    expect(clique.visitante).toBe(noApp.visitante);
  });

  it("um passo sem UTM dentro do app não apaga a campanha da chegada", () => {
    const [, continuar, fora] = resolver([
      evento("arrival", 0, { visitor: "app", net: "n1", inApp: "instagram", campaign: "bio" }),
      evento("continue", 1, { visitor: "app", net: "n1", inApp: "instagram" }),
      evento("view", 2, { visitor: "safari", net: "n1" }),
    ]);
    expect(continuar.campanha).toBe("bio");
    expect(fora.origem).toBe("instagram");
    expect(fora.campanha).toBe("bio");
  });

  it("não costura outra rede, nem depois de dez minutos", () => {
    const [, outraRede, tarde] = resolver([
      evento("arrival", 0, { visitor: "app", net: "n1", inApp: "instagram" }),
      evento("view", 1, { visitor: "x", net: "n2" }),
      evento("view", 11, { visitor: "y", net: "n1" }),
    ]);
    expect(outraRede.origem).toBe("(direto)");
    expect(tarde.origem).toBe("(direto)");
  });

  it("utm_source ganha do app, e o app ganha do referrer", () => {
    const [a, b] = resolver([
      evento("view", 0, { visitor: "v1", inApp: "instagram", source: "campanha-x" }),
      evento("view", 1, { visitor: "v2", inApp: "instagram", referrerHost: "l.instagram.com" }),
    ]);
    expect(a.origem).toBe("campanha-x");
    expect(b.origem).toBe("instagram");
  });

  it("não herda depois de trinta minutos", () => {
    const [, clique] = resolver([
      evento("view", 0, { visitor: "v1", source: "tiktok" }),
      evento("click", 31, { visitor: "v1" }),
    ]);
    expect(clique.origem).toBe("(direto)");
  });

  it("conserta o histórico: a própria página gravada como referrer vira (direto)", () => {
    const [antigo, externo] = resolver([
      evento("view", 0, { ipPrefix: "177.10.88.0/24", userAgent: "UA", referrerHost: HOST }),
      evento("view", 1, { ipPrefix: "177.10.89.0/24", userAgent: "UA", referrerHost: "google.com" }),
    ]);
    expect(antigo.origem).toBe("(direto)");
    expect(externo.origem).toBe("google.com");
  });

  it("eventos antigos, sem chave, agrupam por rede aproximada e navegador no dia", () => {
    const r = resolver([
      evento("view", 0, { ipPrefix: "177.10.88.0/24", userAgent: "UA-1" }),
      evento("view", 5, { ipPrefix: "177.10.88.0/24", userAgent: "UA-1" }),
      evento("view", 6, { ipPrefix: "177.10.88.0/24", userAgent: "UA-2" }),
      evento("view", 7, {}),
      evento("view", 8, {}),
    ]);
    expect(new Set(r.map((x) => x.visitante)).size).toBe(4);
    expect(r[0].visitante).toBe(r[1].visitante);
  });
});

describe("countryOfIp", () => {
  it("resolve IPv4 público e ignora o resto", () => {
    expect(countryOfIp("8.8.8.8")).toBe("US");
    expect(countryOfIp("177.10.88.5")).toBe("BR");
    expect(countryOfIp("10.0.0.1")).toBeUndefined();
    expect(countryOfIp("2804:14c::1")).toBeUndefined();
    expect(countryOfIp("não é ip")).toBeUndefined();
    expect(countryOfIp(undefined)).toBeUndefined();
  });
});

describe("funil", () => {
  async function relatorio(eventos: TrackingEventRecord[], filtros = {}) {
    const store = {
      query: async (_: string, range: { from: Date; to: Date }) =>
        eventos.filter((e) => e.occurredAt >= range.from && e.occurredAt <= range.to),
      counters: async () => ({}),
    };
    const service = new TrackingService(store as never);
    return service.report("p1", { from: new Date(T0 - 3_600_000), to: new Date(T0 + 86_400_000) }, filtros);
  }

  it("conta pessoas por etapa e mostra onde cada uma parou", async () => {
    const r = await relatorio([
      // A: só abriu.
      evento("arrival", 0, { visitor: "a" }),
      // B: abriu, continuou, passou a barreira, viu os links.
      evento("arrival", 1, { visitor: "b" }),
      evento("continue", 2, { visitor: "b" }),
      evento("age", 3, { visitor: "b" }),
      evento("view", 4, { visitor: "b" }),
      // C: foi até o clique, abrindo a página duas vezes.
      evento("arrival", 5, { visitor: "c" }),
      evento("arrival", 6, { visitor: "c" }),
      evento("continue", 7, { visitor: "c" }),
      evento("age", 8, { visitor: "c" }),
      evento("view", 9, { visitor: "c" }),
      evento("click", 10, { visitor: "c", linkId: "telegram" }),
    ]);
    expect(r.funnel).toMatchObject([
      { stage: "arrival", visitors: 3 },
      { stage: "continue", visitors: 2 },
      { stage: "age", visitors: 2 },
      { stage: "view", visitors: 2 },
      { stage: "click", visitors: 1, links: [{ linkId: "telegram", channel: "telegram", visitors: 1, clicks: 1 }] },
    ]);
    // Os totais não mudam: só visita e clique contam.
    expect(r.views).toBe(2);
    expect(r.clicks).toBe(1);
    expect(r.events[0]).toMatchObject({ type: "click", reached: "click" });
    expect(r.events.find((e) => e.type === "arrival" && e.reached === "arrival")).toBeDefined();
  });

  it("omite continuar e 18+ quando a página não tem essas etapas, e segue decrescente sem a chegada", async () => {
    // Histórico anterior à chegada ser gravada: só visita e clique.
    const r = await relatorio([
      evento("view", 0, { visitor: "a" }),
      evento("view", 1, { visitor: "b" }),
      evento("click", 2, { visitor: "b" }),
    ]);
    // Clique em link já apagado (sem id) conta na etapa, mas não abre linha.
    expect(r.funnel).toMatchObject([
      { stage: "arrival", visitors: 2 },
      { stage: "view", visitors: 2 },
      { stage: "click", visitors: 1, links: [] },
    ]);
  });

  it("fica vazio sem ninguém e respeita os recortes", async () => {
    expect((await relatorio([])).funnel).toEqual([]);
    const r = await relatorio(
      [evento("arrival", 0, { visitor: "a", source: "tiktok" }), evento("arrival", 1, { visitor: "b" })],
      { sources: ["tiktok"] },
    );
    expect(r.funnel[0]).toMatchObject({ stage: "arrival", visitors: 1 });
  });

  it("abre a última etapa por link e diz em quais links cada pessoa clicou", async () => {
    const eventos = [
      // A: Telegram, três toques.
      evento("view", 0, { visitor: "a" }),
      evento("click", 1, { visitor: "a", linkId: "telegram" }),
      evento("click", 2, { visitor: "a", linkId: "telegram" }),
      evento("click", 3, { visitor: "a", linkId: "telegram" }),
      // B: OnlyFans e depois Telegram.
      evento("view", 4, { visitor: "b" }),
      evento("click", 5, { visitor: "b", linkId: "onlyfans" }),
      evento("click", 6, { visitor: "b", linkId: "telegram" }),
      // C: viu e não clicou.
      evento("view", 7, { visitor: "c" }),
    ];
    const r = await relatorio(eventos);
    const clique = r.funnel.find((e) => e.stage === "click")!;
    // Pessoas, não toques: A tocou três vezes e é uma pessoa. B conta nos dois.
    expect(clique.visitors).toBe(2);
    expect(clique.links).toEqual([
      { linkId: "telegram", channel: "telegram", visitors: 2, clicks: 4 },
      { linkId: "onlyfans", channel: "onlyfans", visitors: 1, clicks: 1 },
    ]);
    const de = (visitor: string) => r.events.find((e) => e.visitor === r.events.filter((x) => x.at === eventos.find((ev) => ev.client.visitor === visitor)!.occurredAt.toISOString())[0].visitor)!;
    expect(de("a").reachedLinks).toEqual(["telegram"]);
    expect(de("b").reachedLinks).toEqual(["onlyfans", "telegram"]);
    expect(de("c").reachedLinks).toEqual([]);

    // Recorte por link: a etapa final e a lista ficam só com quem clicou nele;
    // as etapas anteriores seguem com todo mundo.
    const soOnlyfans = await relatorio(eventos, { links: ["onlyfans"] });
    expect(soOnlyfans.funnel).toMatchObject([
      { stage: "arrival", visitors: 3 },
      { stage: "view", visitors: 3 },
      { stage: "click", visitors: 1, links: [{ linkId: "onlyfans", channel: "onlyfans", visitors: 1, clicks: 1 }] },
    ]);
    expect(soOnlyfans.views).toBe(3);
    expect(soOnlyfans.clicks).toBe(1);
    expect(new Set(soOnlyfans.events.map((e) => e.visitor)).size).toBe(1);
    expect(soOnlyfans.events.map((e) => e.type)).toEqual(["click", "view"]);
    expect(soOnlyfans.events[0].reachedLinks).toEqual(["onlyfans"]);
  });

  it("separa, em cada etapa, quem acessou, quem parou e quem fechou a página ali", async () => {
    const r = await relatorio([
      // A: abriu e fechou a página.
      evento("arrival", 0, { visitor: "a" }),
      evento("leave", 1, { visitor: "a" }),
      // B: abriu e ficou com a página aberta (nenhuma saída).
      evento("arrival", 2, { visitor: "b" }),
      // C: saiu na chegada, voltou, viu os links e saiu de novo.
      evento("arrival", 3, { visitor: "c" }),
      evento("leave", 4, { visitor: "c" }),
      evento("view", 5, { visitor: "c" }),
      evento("leave", 6, { visitor: "c" }),
      // D: saiu na chegada, voltou e viu os links; a saída antiga não conta.
      evento("arrival", 7, { visitor: "d" }),
      evento("leave", 8, { visitor: "d" }),
      evento("view", 9, { visitor: "d" }),
      // E: clicou; sair da página depois do clique é ir ao destino.
      evento("view", 10, { visitor: "e" }),
      evento("click", 11, { visitor: "e", linkId: "telegram" }),
      evento("leave", 12, { visitor: "e" }),
    ]);
    expect(r.funnel.map(({ stage, visitors, stopped, left }) => ({ stage, visitors, stopped, left }))).toEqual([
      { stage: "arrival", visitors: 5, stopped: 2, left: 1 },
      { stage: "view", visitors: 3, stopped: 2, left: 1 },
      { stage: "click", visitors: 1, stopped: 0, left: 0 },
    ]);
    // A saída aparece no passo a passo e não mexe nos totais.
    expect(r.events.filter((e) => e.type === "leave")).toHaveLength(5);
    expect(r.views).toBe(3);
    expect(r.clicks).toBe(1);
  });

  it("a saída do aplicativo não vira abandono: a página some no app e a pessoa segue no navegador", async () => {
    const r = await relatorio([
      evento("arrival", 0, { visitor: "app", net: "n1", inApp: "instagram" }),
      evento("continue", 1, { visitor: "app", net: "n1", inApp: "instagram" }),
      evento("leave", 1.1, { visitor: "app", net: "n1", inApp: "instagram" }),
      evento("view", 2, { visitor: "safari", net: "n1" }),
    ]);
    expect(r.funnel.map(({ stage, visitors, stopped, left }) => ({ stage, visitors, stopped, left }))).toEqual([
      { stage: "arrival", visitors: 1, stopped: 0, left: 0 },
      { stage: "continue", visitors: 1, stopped: 0, left: 0 },
      { stage: "view", visitors: 1, stopped: 1, left: 0 },
      { stage: "click", visitors: 0, stopped: 0, left: 0 },
    ]);
  });

  it("tira os indicadores do mesmo caminho: conversão, maior perda, tempos, saída do app e horários", async () => {
    const r = await relatorio([
      // A e D: abriram e saíram sem clicar, depois de 2 e de 4 minutos.
      evento("arrival", 0, { visitor: "a" }),
      evento("leave", 2, { visitor: "a" }),
      evento("arrival", 20, { visitor: "d" }),
      evento("leave", 24, { visitor: "d" }),
      // B: chegou pelo Instagram, continuou e clicou em dois links, o primeiro aos 5 minutos.
      evento("arrival", 0, { visitor: "b", inApp: "instagram" }),
      evento("continue", 1, { visitor: "b", inApp: "instagram" }),
      evento("view", 2, { visitor: "b" }),
      evento("click", 5, { visitor: "b", linkId: "telegram" }),
      evento("click", 6, { visitor: "b", linkId: "onlyfans" }),
      // C: viu os links e clicou um minuto depois.
      evento("view", 10, { visitor: "c" }),
      evento("click", 11, { visitor: "c", linkId: "telegram" }),
    ]);
    const minuto = 60_000;
    const horas = (posicao: number, valor: number) => Array.from({ length: 24 }, (_, h) => (h === posicao ? valor : 0));
    expect(r.kpis).toEqual({
      // Sem ninguém na janela anterior, não há com o que comparar.
      conversion: { visitors: 4, clickers: 2, rate: 0.5, previousRate: null },
      biggestDrop: { stage: "arrival", stopped: 2, share: 0.5 },
      timeToClick: { medianMs: 3 * minuto, sample: 2 },
      timeBeforeLeaving: { medianMs: 3 * minuto, sample: 2 },
      appExit: { arrived: 1, continued: 1, rate: 1 },
      linksPerClicker: 1.5,
      byHour: { views: horas(12, 2), clicks: horas(12, 3) },
    });
  });

  it("indicador sem base fica nulo, e não zero", async () => {
    const r = await relatorio([evento("view", 0, { visitor: "a" })]);
    expect(r.kpis).toMatchObject({
      conversion: { visitors: 1, clickers: 0, rate: 0 },
      biggestDrop: { stage: "view", stopped: 1, share: 1 },
      timeToClick: null,
      timeBeforeLeaving: null,
      appExit: null,
      linksPerClicker: 0,
    });
  });

  it("a lista traz os passos mais recentes até o teto e diz quantos o recorte tem ao todo", async () => {
    const muitos = Array.from({ length: 1100 }, (_, i) => evento("view", i / 10, { visitor: `v${i}` }));
    const r = await relatorio(muitos);
    expect(r.eventsTotal).toBe(1100);
    expect(r.events).toHaveLength(1000);
    // Do mais novo para o mais antigo: o primeiro é o último que aconteceu.
    expect(r.events[0].at).toBe(muitos[1099].occurredAt.toISOString());
  });
});
