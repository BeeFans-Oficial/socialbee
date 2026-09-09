/**
 * @type {import('next').NextConfig}
 *
 * Uma configuração, com motivo.
 *
 * `output: "standalone"` é o que permite a imagem Docker do app carregar só o
 * servidor e as dependências que ele usa, em vez do `node_modules` inteiro (que
 * aqui passa de 600 MB com framer-motion, recharts e dnd-kit).
 *
 * A conversa do navegador com a API passa por `/api/v1/*` na própria origem, e
 * quem faz esse repasse é o Route Handler em `app/api/v1/[...path]/route.ts` —
 * **não** um `rewrites` aqui. O motivo está escrito lá: `rewrites()` é avaliado
 * no BUILD e congela o destino no manifesto de rotas, então a imagem Docker
 * saía apontando para o `localhost` da máquina que buildou e o painel
 * respondia 500 dentro do container.
 */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
};

module.exports = nextConfig;
