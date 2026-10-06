import { ForbiddenException } from "@nestjs/common";

import { cabeMais, exigirPro, planoDe } from "../src/plans/plans";

/**
 * O plano é uma data, não um booleano: vencida, a conta é Free sem ninguém
 * precisar desligar nada. É isso que estes casos fixam.
 */
describe("planoDe", () => {
  const agora = new Date("2026-10-06T12:00:00Z");

  it("é Pro só enquanto a data está no futuro", () => {
    expect(planoDe(new Date("2026-10-06T12:00:01Z"), agora)).toBe("pro");
    expect(planoDe(new Date("2026-10-06T12:00:00Z"), agora)).toBe("free");
    expect(planoDe(new Date("2026-01-01T00:00:00Z"), agora)).toBe("free");
  });

  it("sem data é Free", () => {
    expect(planoDe(null, agora)).toBe("free");
    expect(planoDe(undefined, agora)).toBe("free");
  });
});

describe("exigirPro", () => {
  it("deixa o Pro passar", () => {
    expect(() => exigirPro("pro", "cloaking")).not.toThrow();
  });

  it("recusa o Free com 403, o código único e o recurso", () => {
    try {
      exigirPro("free", "links");
      throw new Error("deveria ter recusado");
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      const body = (error as ForbiddenException).getResponse() as Record<string, unknown>;
      expect(body.code).toBe("plano_pro_necessario");
      expect(body.details).toEqual({ recurso: "links" });
    }
  });
});

describe("cabeMais", () => {
  it("respeita o limite e trata null como sem limite", () => {
    expect(cabeMais(5, 4)).toBe(true);
    expect(cabeMais(5, 5)).toBe(false);
    expect(cabeMais(null, 10_000)).toBe(true);
  });
});
