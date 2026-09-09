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
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
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
