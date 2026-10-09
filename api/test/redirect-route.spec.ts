import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import vm from "node:vm";

const root = path.resolve(__dirname, "../..");
function load(file: string, imports: Record<string, unknown> = {}): any {
  const source = ts.transpileModule(fs.readFileSync(path.join(root, file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, {
    exports, require: (name: string) => imports[name] ?? require(require.resolve(name, { paths: [root] })),
    URL, URLSearchParams, console, setTimeout,
  });
  return exports;
}

const recordClick = jest.fn();
const { renderSafePage } = load("lib/safe-page.ts");
class TestResponse extends Response {
  static redirect(url: string | URL, options: ResponseInit | number = 302): TestResponse {
    const init = typeof options === "number" ? { status: options } : options;
    return new TestResponse(null, { ...init, headers: { ...init.headers, location: new URL(url).href } });
  }
}
const { GET, HEAD } = load("app/r/[code]/route.ts", {
  "next/server": { NextResponse: TestResponse },
  "@/lib/safe-page": { renderSafePage },
  "@/lib/api/server": { recordClick },
  "@/lib/site": { siteOrigin: () => "https://example.com", esquemaDe: () => "https" },
});
const request = { url: "https://example.com/r/abcd", headers: new Headers({ host: "example.com" }) };
const context = { params: Promise.resolve({ code: "abcd" }) };

describe("/r/[code]", () => {
  it("redireciona humanos com 307 sem cache", async () => {
    recordClick.mockResolvedValue({ isBot: false, destinationUrl: "https://destination.test", counted: true });
    const response = await GET(request, context);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://destination.test/");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("entrega HTML seguro para bots sem Location nem destino principal", async () => {
    recordClick.mockResolvedValue({ isBot: true, destinationUrl: null, safePage: {
      displayName: '<script>alert("x")</script>',
      socialLinks: [{ url: "https://social.test", title: "A&B", platform: "social" },
        { url: "javascript:alert(1)", title: "inseguro", platform: "social" }],
    } });
    const response = await GET(request, context);
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(html).toContain('href="https://social.test/"');
    expect(html).toContain("A&amp;B");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("javascript:");
  });
  it("entrega perfil vazio quando não há Safe Page", async () => {
    recordClick.mockResolvedValue({ isBot: true, safePage: null });
    expect((await GET(request, context)).status).toBe(200);
  });
  it("mantém fallback temporário para código inexistente", async () => {
    recordClick.mockResolvedValue({ destinationUrl: null, counted: false });
    expect((await GET(request, context)).status).toBe(307);
  });
  it("HEAD não consulta nem registra clique", async () => {
    recordClick.mockClear();
    expect((await HEAD()).status).toBe(200);
    expect(recordClick).not.toHaveBeenCalled();
  });
});
