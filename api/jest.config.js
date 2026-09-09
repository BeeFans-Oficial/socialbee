/**
 * Testes unitários.
 *
 * Cobre a lógica que **mente sobre número em silêncio** se estiver errada: o
 * filtro de robô e a extração de atribuição. Um bug aqui não quebra nada — só
 * infla ou esvazia o relatório da criadora, e ninguém percebe até ela negociar
 * um valor com base num dado falso.
 *
 * O resto da API é coberto pelo teste de ponta a ponta (`jest.e2e.config.js`),
 * que exercita HTTP + banco de verdade.
 */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: ".",
  testMatch: ["<rootDir>/test/**/*.spec.ts"],
  testPathIgnorePatterns: ["\\.e2e-spec\\.ts$"],
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
};
