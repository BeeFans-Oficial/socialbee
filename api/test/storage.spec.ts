import sharp from "sharp";

import { chaveDaImagem, processarImagem } from "../src/common/storage/image-processor";
import { isMediaKey, mediaUrl } from "../src/common/storage/media-url";

process.env.JWT_SECRET ??= "segredo-de-teste-com-mais-de-32-caracteres-ok";
process.env.INTERNAL_API_SECRET ??= "segredo-interno-de-teste-24+";
process.env.DATABASE_URL ??= "postgres://x:x@localhost:5433/x";
process.env.MEDIA_PUBLIC_URL = "https://beesocial.bio/media";

async function foto(width: number, height: number): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: "#123456" } }).jpeg().toBuffer();
}

describe("processarImagem", () => {
  it("avatar: recorta para 512×512 em WebP", async () => {
    const saida = await processarImagem(await foto(4000, 3000), "avatar");
    expect([saida.width, saida.height, saida.contentType]).toEqual([512, 512, "image/webp"]);
  });

  it("capa: limita a largura a 1920 mantendo a proporção", async () => {
    const saida = await processarImagem(await foto(4000, 3000), "cover");
    expect([saida.width, saida.height]).toEqual([1920, 1440]);
  });

  it("chegada: 1200 de largura", async () => {
    const saida = await processarImagem(await foto(3000, 4000), "iab");
    expect(saida.width).toBe(1200);
  });

  it("não amplia foto menor que o alvo", async () => {
    const saida = await processarImagem(await foto(300, 200), "cover");
    expect([saida.width, saida.height]).toEqual([300, 200]);
  });

  it("corrige a orientação EXIF", async () => {
    // Foto 400×200 marcada como "girar 90°": o que a pessoa vê é 200×400.
    const deitada = await sharp({ create: { width: 400, height: 200, channels: 3, background: "#000" } })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const saida = await processarImagem(deitada, "cover");
    expect([saida.width, saida.height]).toEqual([200, 400]);
  });

  it("recusa o que não é imagem", async () => {
    await expect(processarImagem(Buffer.from("texto"), "avatar")).rejects.toMatchObject({
      response: { code: "imagem_invalida" },
    });
  });

  it("a chave carrega o uso, um carimbo e a extensão", () => {
    expect(chaveDaImagem("profiles/abc", "avatar")).toMatch(/^profiles\/abc\/avatar-\d+\.webp$/);
  });
});

describe("mediaUrl", () => {
  it("chave vira URL pública", () => {
    expect(mediaUrl("profiles/abc/avatar-1.webp")).toBe("https://beesocial.bio/media/profiles/abc/avatar-1.webp");
  });
  it("URL http passa intacta; vazio vira null", () => {
    expect(mediaUrl("https://cdn.exemplo/x.png")).toBe("https://cdn.exemplo/x.png");
    expect(mediaUrl(null)).toBeNull();
    expect(mediaUrl("")).toBeNull();
  });
  it("classifica os formatos", () => {
    expect(isMediaKey("profiles/a/avatar-1.webp")).toBe(true);
    expect(isMediaKey("data:image/png;base64,AA")).toBe(false);
    expect(isMediaKey("http://x/y.png")).toBe(false);
  });
});
