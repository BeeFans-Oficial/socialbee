import { checkDestination, safeDestination } from "../src/common/url";

/**
 * Validação de destino.
 *
 * O destino é digitado pela criadora e gravado no banco. Duas coisas não podem
 * passar: esquema que vira execução de script no navegador do visitante, e host
 * de rede interna — que transformaria o redirecionador em ferramenta de
 * varredura de infraestrutura alheia.
 */
describe("checkDestination", () => {
  it("aceita http e https", () => {
    expect(safeDestination("https://onlyfans.com/bella")?.host).toBe("onlyfans.com");
    expect(safeDestination("http://exemplo.com.br")?.host).toBe("exemplo.com.br");
  });

  it("recusa esquema que não é http(s)", () => {
    for (const raw of [
      "javascript:alert(1)",
      "data:text/html;base64,PHNjcmlwdD4=",
      "file:///etc/passwd",
      "ftp://exemplo.com",
    ]) {
      expect(checkDestination(raw).url).toBeNull();
    }
    expect(checkDestination("javascript:alert(1)").reason).toBe("esquema");
  });

  it("recusa host de rede interna", () => {
    for (const raw of [
      "http://localhost:3000/painel",
      "http://127.0.0.1",
      "http://10.0.0.5",
      "http://192.168.0.10",
      "http://172.16.0.9",
      // Endpoint de metadados das nuvens — o alvo clássico de SSRF.
      "http://169.254.169.254/latest/meta-data/",
      "http://banco.internal",
      "http://maquina.local",
    ]) {
      expect(checkDestination(raw).reason).toBe("host_interno");
    }
  });

  it("recusa entrada malformada ou vazia", () => {
    expect(checkDestination("").reason).toBe("malformada");
    expect(checkDestination("onlyfans.com/bella").reason).toBe("malformada");
  });
});
