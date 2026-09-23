# BeeSocial — app Next.js.
#
# Depende de `output: "standalone"` em next.config.js: é o que faz o Next
# produzir um servidor com apenas as dependências que ele realmente usa, em vez
# de a imagem final carregar o `node_modules` inteiro (que aqui passa de 600 MB
# com framer-motion, recharts e dnd-kit).

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Variável pública é embutida no bundle no momento do build, não lida em
# runtime: se o endereço final do site é outro, este build precisa ser refeito.
#
# Sem default, de propósito. Ela é lida por client components (o botão de copiar
# em LinkCard.tsx, entre outros), então um default de `localhost` não seria
# conveniência: seria uma imagem subindo em produção entregando link quebrado,
# sem nada falhar para avisar. É a mesma regra que `loadEnv()` aplica aos
# segredos da API — configuração incompleta derruba o build, não a visitante.
ARG NEXT_PUBLIC_SITE_URL
RUN test -n "$NEXT_PUBLIC_SITE_URL" || { \
      echo "ERRO: NEXT_PUBLIC_SITE_URL nao foi passado ao build." >&2; \
      echo "      docker build --build-arg NEXT_PUBLIC_SITE_URL=https://seu.dominio ." >&2; \
      exit 1; \
    }
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache tini

# O `standalone` já traz o servidor e as dependências necessárias; `static` e
# `public` ficam fora dele e precisam ser copiados à mão.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

USER node

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/" > /dev/null 2>&1 || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
