import { detectInAppBrowser } from "../src/tracking/in-app-browser";
import { detectBot } from "../src/tracking/bots";

/**
 * O detector de navegador embutido.
 *
 * O caso que este arquivo existe para travar é a fronteira com `detectBot`: os
 * dois olham o mesmo cabeçalho e precisam discordar nos dois sentidos.
 *
 *   - `Instagram 300.0.0.0` é HUMANO em navegador embutido;
 *   - `facebookexternalhit` é ROBÔ e não pode virar IAB.
 *
 * Errar isso não quebra nada visível: só manda a fã para a página errada, ou o
 * crawler para a página de escape. Nenhum dos dois reclama.
 */
describe("detectInAppBrowser", () => {
  const instagramIOS =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0.0.0";
  const instagramAndroid =
    "Mozilla/5.0 (Linux; Android 13; SM-A536E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36 Instagram 302.1.0.35.111";
  const chromeAndroid =
    "Mozilla/5.0 (Linux; Android 13; SM-A536E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36";

  it("reconhece o navegador embutido do Instagram no iOS", () => {
    const v = detectInAppBrowser(instagramIOS);
    expect(v.isInApp).toBe(true);
    expect(v.source).toBe("instagram");
    expect(v.platform).toBe("ios");
  });

  it("reconhece o do Instagram no Android — a plataforma decide a técnica de escape", () => {
    const v = detectInAppBrowser(instagramAndroid);
    expect(v.isInApp).toBe(true);
    expect(v.platform).toBe("android");
  });

  it("reconhece o do Facebook pelos sinais FBAN/FBAV, não pela palavra", () => {
    const v = detectInAppBrowser(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 [FBAN/FBIOS;FBAV/443.0.0]",
    );
    expect(v.isInApp).toBe(true);
    expect(v.source).toBe("facebook");
  });

  it("não trata um navegador comum como embutido", () => {
    expect(detectInAppBrowser(chromeAndroid).isInApp).toBe(false);
    expect(detectInAppBrowser("").isInApp).toBe(false);
  });

  /**
   * A fronteira com o filtro de robô, nos dois sentidos. São estes dois casos
   * que fazem a página servir o conteúdo certo a cada visitante.
   */
  describe("fronteira com detectBot", () => {
    const base = {
      acceptLanguage: "pt-BR,pt;q=0.9",
      accept: "text/html,application/xhtml+xml",
      method: "GET",
      ip: "203.0.113.10",
    };

    it("o humano no Instagram é IAB e NÃO é robô", () => {
      expect(detectInAppBrowser(instagramIOS).isInApp).toBe(true);
      expect(detectBot({ ...base, userAgent: instagramIOS }).isBot).toBe(false);
    });

    it("o crawler da Meta é robô e NÃO é IAB", () => {
      const ua = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";
      expect(detectInAppBrowser(ua).isInApp).toBe(false);
      expect(detectBot({ ...base, userAgent: ua }).isBot).toBe(true);
    });

    it("Twitterbot é robô; a fronteira de palavra o mantém fora do IAB", () => {
      const ua = "Twitterbot/1.0";
      expect(detectInAppBrowser(ua).isInApp).toBe(false);
      expect(detectBot({ ...base, userAgent: ua }).isBot).toBe(true);
    });
  });
});
