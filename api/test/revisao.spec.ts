import { classificarHost, pertenceA } from "../src/revisao/hosts-conhecidos";
import { extrairTexto, normalizarHtml, vereditoDe, type ItemDaRevisao } from "../src/revisao/revisao.service";

const item = (chave: ItemDaRevisao["chave"], estado: ItemDaRevisao["estado"]): ItemDaRevisao => ({ chave, estado, titulo: "", detalhe: "" });

describe("simulador da revisão da Meta — peças puras", () => {
  it("classifica o host final pelo sufixo do domínio", () => {
    const pool = ["beesocial.bio", "vemaqui.site"];
    expect(classificarHost("privacy.com.br", pool)).toBe("checkout_adulto");
    expect(classificarHost("app.onlyfans.com", pool)).toBe("checkout_adulto");
    expect(classificarHost("t.me", pool)).toBe("mensageiro");
    expect(classificarHost("www.instagram.com", pool)).toBe("rede_social");
    expect(classificarHost("vemaqui.site", pool)).toBe("plataforma");
    expect(classificarHost("loja.minhamarca.com", pool)).toBe("desconhecido");
    // Sufixo respeita o ponto: "notx.com" não é "x.com".
    expect(pertenceA("notx.com", "x.com")).toBe(false);
    expect(pertenceA("api.x.com", "x.com")).toBe(true);
  });

  it("o veredito é o pior item; neutro não pesa", () => {
    expect(vereditoDe([item("consistencia", "verde"), item("destinos", "neutro")])).toBe("verde");
    expect(vereditoDe([item("consistencia", "verde"), item("dominio", "amarelo")])).toBe("amarelo");
    expect(vereditoDe([item("dominio", "amarelo"), item("barreira", "vermelho")])).toBe("vermelho");
  });

  it("normaliza o documento tirando o que muda entre duas requisições iguais", () => {
    const a = '<html><head><script nonce="abc">self.__next_f.push([1,"x"])</script></head><body>  <h1>Oi</h1>\n</body></html>';
    const b = '<html><head><script nonce="zzz">self.__next_f.push([2,"y"])</script></head><body><h1>Oi</h1></body></html>';
    expect(normalizarHtml(a)).toBe(normalizarHtml(b));
    const c = '<html><body><h1>Oi</h1><a href="/r/abc">x</a></body></html>';
    expect(normalizarHtml(a)).not.toBe(normalizarHtml(c));
    // O Next deixa um Suspense vazio escondido no topo do body só para quem
    // recebe metadados em streaming (humano, não robô). Não é conteúdo.
    const humano = '<html><body><div hidden=""><!--$--><!--/$--></div><h1>Oi</h1></body></html>';
    const robo = "<html><body><h1>Oi</h1></body></html>";
    expect(normalizarHtml(humano)).toBe(normalizarHtml(robo));
  });

  it("extrai só o texto visível, em minúsculas", () => {
    const html = "<html><head><style>.a{}</style><script>var x = 'Sair do Instagram'</script></head><body><h1>Seu LINK na bio</h1><p>Página Segura</p></body></html>";
    const texto = extrairTexto(html);
    expect(texto).toContain("seu link na bio");
    expect(texto).toContain("página segura");
    expect(texto).not.toContain("sair do instagram");
  });
});
