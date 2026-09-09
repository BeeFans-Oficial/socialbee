/**
 * Teste de ponta a ponta.
 *
 * Sobe a aplicação inteira contra um Postgres REAL (o do compose) e fala HTTP.
 * Não usa mock de repositório de propósito: o que este teste precisa provar é
 * justamente o que um mock esconderia — que o escopo por perfil chega ao
 * `WHERE`, que o `CHECK` do banco recusa destino inválido, que a sessão
 * revogada para de valer.
 *
 * Roda em série (`--runInBand`): os casos compartilham o banco.
 */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: ".",
  testMatch: ["<rootDir>/test/**/*.e2e-spec.ts"],
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
  testTimeout: 30000,
};
