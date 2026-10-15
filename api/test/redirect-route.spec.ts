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
class TestResponse extends Response {
  static redirect(url: string | URL, options: ResponseInit | number = 302): TestResponse {
    const init = typeof options === "number" ? { status: options } : options;
    return new TestResponse(null, { ...init, headers: { ...init.headers, location: new URL(url).href } });
  }
}
const { GET, HEAD } = load("app/r/[code]/route.ts", {
  "next/server": { NextResponse: TestResponse },
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
  it("redireciona robôs com o MESMO 307 — a diferença fica no relatório", async () => {
    // Resposta diferente por user-agent é cloaking para a Meta. O robô recebe
    // o mesmo salto que a fã; o que muda é só o `counted` do relatório.
    recordClick.mockResolvedValue({ isBot: true, destinationUrl: "https://destination.test", counted: false });
    const response = await GET(request, context);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://destination.test/");
    expect(response.headers.get("cache-control")).toBe("no-store");
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
