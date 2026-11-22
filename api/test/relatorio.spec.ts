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
  } = {},
): TrackingEventRecord {
  return {
    type,
    profileId: "p1",
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
      evento("click", 10, { visitor: "c" }),
    ]);
    expect(r.funnel).toEqual([
      { stage: "arrival", visitors: 3 },
      { stage: "continue", visitors: 2 },
      { stage: "age", visitors: 2 },
      { stage: "view", visitors: 2 },
      { stage: "click", visitors: 1 },
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
    expect(r.funnel).toEqual([
      { stage: "arrival", visitors: 2 },
      { stage: "view", visitors: 2 },
      { stage: "click", visitors: 1 },
    ]);
  });

  it("fica vazio sem ninguém e respeita os recortes", async () => {
    expect((await relatorio([])).funnel).toEqual([]);
    const r = await relatorio(
      [evento("arrival", 0, { visitor: "a", source: "tiktok" }), evento("arrival", 1, { visitor: "b" })],
      { sources: ["tiktok"] },
    );
    expect(r.funnel[0]).toEqual({ stage: "arrival", visitors: 1 });
  });
});
