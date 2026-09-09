import {
  buildClientContext,
  clientIP,
  detectInAppBrowser,
  hostOf,
  ipPrefix,
  parseAttribution,
} from "../src/tracking/attribution";

describe("parseAttribution", () => {
  it("extrai UTM e click ids conhecidos", () => {
    const url = new URL(
      "http://localhost:3000/r/abc123?utm_source=instagram&utm_medium=bio&utm_campaign=stories&fbclid=IwAR123",
    );
    const attribution = parseAttribution(url, "https://www.instagram.com/bella/");

    expect(attribution.source).toBe("instagram");
    expect(attribution.medium).toBe("bio");
    expect(attribution.campaign).toBe("stories");
    expect(attribution.clickIds.fbclid).toBe("IwAR123");
  });

  it("captura click id de rede que ainda não está na lista", () => {
    // É o ponto do mapa aberto: uma rede nova funciona sem editar código.
    const url = new URL("http://localhost:3000/r/abc123?xyzclid=novo123");
    expect(parseAttribution(url).clickIds.xyzclid).toBe("novo123");
  });

  it("guarda só o host do referrer, nunca o caminho", () => {
    // O caminho pode carregar dado pessoal e nenhuma agregação da tela usa
    // mais do que o domínio.
    const attribution = parseAttribution(
      new URL("http://localhost:3000/r/abc"),
      "https://www.google.com/search?q=nome+da+pessoa",
    );
    expect(attribution.referrerHost).toBe("google.com");
  });

  it("corta valor de UTM muito longo", () => {
    const url = new URL(`http://localhost:3000/r/abc?utm_campaign=${"a".repeat(500)}`);
    expect(parseAttribution(url).campaign).toHaveLength(200);
  });
});

describe("detectInAppBrowser", () => {
  it("distingue Instagram de Facebook", () => {
    // O UA do app do Instagram também contém FBAV (o app é da Meta). Sem a
    // ordem certa, TODO tráfego de Instagram seria contado como Facebook.
    expect(detectInAppBrowser("Mobile/15E148 Instagram 300.0.0.0 (iPhone; FBAV/1.0)")).toBe(
      "instagram",
    );
    expect(detectInAppBrowser("Mobile/15E148 [FBAN/FBIOS;FBAV/450.0]")).toBe("facebook");
  });

  it("devolve undefined para navegador comum", () => {
    expect(detectInAppBrowser("Mozilla/5.0 (Macintosh) Chrome/131.0.0.0")).toBeUndefined();
  });
});

describe("ipPrefix", () => {
  it("reduz IPv4 ao /24", () => {
    expect(ipPrefix("203.0.113.42")).toBe("203.0.113.0/24");
  });

  it("reduz IPv6 ao /48, expandindo a notação comprimida", () => {
    expect(ipPrefix("2001:db8:1234:5678::1")).toBe("2001:db8:1234::/48");
  });

  it("descarta loopback e rede privada", () => {
    // `::1` virava "1::/48" quando a string era fatiada crua — um prefixo que
    // não existe, poluindo o relatório.
    expect(ipPrefix("::1")).toBeUndefined();
    expect(ipPrefix("127.0.0.1")).toBeUndefined();
    expect(ipPrefix("192.168.0.10")).toBeUndefined();
    expect(ipPrefix("10.1.2.3")).toBeUndefined();
  });
});

describe("clientIP", () => {
  it("prefere a borda que termina a conexão", () => {
    // `x-forwarded-for` é falsificável; `cf-connecting-ip` vem da borda.
    expect(
      clientIP({
        "cf-connecting-ip": "203.0.113.7",
        "x-forwarded-for": "1.2.3.4, 5.6.7.8",
      }),
    ).toBe("203.0.113.7");
  });

  it("usa o primeiro salto do x-forwarded-for quando é o que existe", () => {
    expect(clientIP({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" })).toBe("203.0.113.9");
  });
});

describe("buildClientContext", () => {
  it("classifica dispositivo, SO e navegador embutido", () => {
    const context = buildClientContext({
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Instagram 300.0.0.0",
      ip: "203.0.113.42",
      country: "br",
    });

    expect(context.device).toBe("mobile");
    expect(context.os).toBe("iOS");
    expect(context.inAppBrowser).toBe("instagram");
    expect(context.country).toBe("BR");
    expect(context.ipPrefix).toBe("203.0.113.0/24");
  });
});

describe("hostOf", () => {
  it("normaliza host e remove www", () => {
    expect(hostOf("https://WWW.Example.com/a/b?c=d")).toBe("example.com");
  });

  it("devolve undefined para entrada inválida", () => {
    expect(hostOf("não é url")).toBeUndefined();
    expect(hostOf(null)).toBeUndefined();
  });
});
