# ------------------------------------------------------------------ dependências
# Estágio separado só para o `npm ci`: enquanto package-lock.json não muda, o
# Docker reusa esta camada e o build não baixa nada.
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ------------------------------------------------------------------------ build
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ------------------------------------------------------- dependências de runtime
# `npm ci --omit=dev` num estágio próprio: a imagem final não leva o compilador
# de TypeScript, o Jest nem o CLI do Nest.
FROM node:20-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---------------------------------------------------------------------- runtime
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3333

# `wget` do busybox serve o HEALTHCHECK; `tini` garante que SIGTERM chegue ao
# node e o desligamento feche o pool do banco em vez de o container ser morto.
RUN apk add --no-cache tini

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY docker-entrypoint.sh ./

RUN chmod +x docker-entrypoint.sh && chown -R node:node /app

# Nunca root. Um processo comprometido rodando como root no container é o
# primeiro degrau para sair dele.
USER node

EXPOSE 3333

# Toca o banco de propósito (ver health.controller.ts): processo que responde
# 200 sem conseguir consultar o Postgres é o pior tipo de "saudável".
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/v1/health" > /dev/null 2>&1 || exit 1

ENTRYPOINT ["/sbin/tini", "--", "./docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
