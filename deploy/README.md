# Deploy do BeeSocial

**O produto está no ar em `https://beesocial.bio` desde 17/09/2026**, numa VPS
da Hostinger. Este documento é como colocar uma mudança em produção — e, no fim,
como refazer a máquina do zero se um dia for preciso.

O **porquê** de cada decisão está nos arquivos que você vai usar:
[`docker-compose.prod.yml`](../docker-compose.prod.yml),
[`.env.production.example`](../.env.production.example) e os dois blocos de
`nginx/` aqui do lado. Vale ler os comentários deles quando algo parecer
arbitrário.

## O que roda onde

Tudo numa máquina só. Três containers, e um nginx que **não** é container.

```
     navegador ──> nginx (host, :80/:443)
                     ├─ beesocial.bio      ──> 127.0.0.1:3000   web  (Next)
                     └─ api.beesocial.bio  ──> 127.0.0.1:3333   api  (NestJS)

     web ──(rede interna do Compose)──> api:3333 ──> db:5432
```

Três coisas explicam quase toda a configuração:

**Os containers publicam só no loopback.** `127.0.0.1:3000` e `127.0.0.1:3333`,
e o banco sem porta nenhuma. O único processo que alcança os três é o nginx, na
própria máquina. Sem o prefixo `127.0.0.1:`, o Docker faria bind em `0.0.0.0` e
escreveria regras de iptables **antes** do ufw — o firewall não bloquearia, e a
API ficaria exposta sem TLS.

**O navegador nunca fala direto com a API.** O painel chama `/api/v1/*` na
própria origem do front, e quem repassa é um Route Handler do Next
(`app/api/v1/[...path]/route.ts`), que alcança a API pela rede interna do
Docker. É isso que mantém o cookie de sessão same-site e o segredo interno fora
da rede pública. O domínio `api.beesocial.bio` existe para Postman e clientes
externos; o produto não passa por ele.

**O nginx é nativo do host, instalado por `apt`.** Quem termina o TLS é ele, com
certificado do certbot. Não há serviço de borda no compose.

## A máquina

| | |
|---|---|
| IP | `179.197.233.125` (`srv1846638.hstgr.cloud`) |
| Acesso | `ssh root@179.197.233.125` — só por chave; senha desativada |
| SO | Ubuntu 24.04 · 2 núcleos · 7,8 GB RAM · 96 GB |
| Firewall | ufw ativo, liberando 22, 80 e 443 |

Onde as coisas moram:

```
/opt/beesocial/                              código e compose
/opt/beesocial/.env                          segredos — chmod 600, NÃO versionado
/etc/nginx/sites-available/beesocial.bio     já reescrito pelo certbot (com TLS)
/etc/nginx/sites-available/api.beesocial.bio
/etc/letsencrypt/live/<domínio>/             certificados
```

O volume Docker `beesocial-db` guarda **os dados**. `docker compose down` não o
apaga; `down -v` apaga.

---

# Parte 1 — Colocar uma mudança no ar

É o procedimento do dia a dia. O deploy hoje é manual e sai **do seu Mac**: a
VPS não puxa do GitHub sozinha.

### 1. Enviar o código

Da raiz do repositório, no Mac:

```bash
rsync -az --delete \
  --exclude node_modules --exclude .next --exclude .git \
  --exclude dist --exclude .env --exclude .data \
  ./ root@179.197.233.125:/opt/beesocial/
```

> **O `--exclude .env` não é opcional.** Sem ele o seu `.env` de
> desenvolvimento sobrescreve o de produção — segredos trocados, `COOKIE_SECURE`
> errado, `SEED_DEMO` ligado — e o `--delete` já apagou o original. É o jeito
> mais rápido de derrubar tudo com um comando que parecia inofensivo.

### 2. Buildar e subir

```bash
ssh root@179.197.233.125
cd /opt/beesocial
docker compose -f docker-compose.prod.yml up -d --build
```

O Compose recria só o que mudou. As migrations rodam sozinhas, **antes de a
porta abrir** (`api/docker-entrypoint.sh`): a ordem é schema → migrations → seed
→ aplicação, sequencial de propósito, porque duas instâncias migrando ao mesmo
tempo é deadlock. O `web` só sobe depois de a API responder `healthy`, e esse
healthcheck **toca o banco** — processo que responde 200 sem conseguir consultar
o Postgres é o pior tipo de "saudável".

### 3. Conferir

```bash
docker compose -f docker-compose.prod.yml ps        # os três "healthy"
curl -s  https://beesocial.bio/api/v1/health        # {"status":"ok"}
curl -sI https://beesocial.bio | head -1            # 200
```

E no navegador, o que só o olho pega:

- [ ] Entrar no painel e ver os links carregarem — é onde um cookie que não
      gruda aparece.
- [ ] **Copiar o link** de um link e colar numa aba nova: tem que apontar para
      `beesocial.bio`, não para `localhost`.
- [ ] Abrir um perfil público e clicar num link: o contador em `/analytics`
      precisa subir.
- [ ] Trocar a foto de perfil (é o caminho que exercita o limite de 10 MB do
      nginx).

### Dois casos que pedem atenção

**Mudou a `SITE_URL`?** O front precisa ser reconstruído, porque a URL fica
embutida no bundle. `restart` não resolve:

```bash
docker compose -f docker-compose.prod.yml up -d --build web
```

**Mudou algum bloco do nginx no repositório?** O rsync **não** toca em
`/etc/nginx/`, e ainda bem: os arquivos instalados já foram reescritos pelo
certbot, com o `listen 443 ssl` e o redirecionamento da 80. Copiar por cima
apaga isso. Aplique a mudança à mão no arquivo de
`/etc/nginx/sites-available/`, ou copie e rode `sudo certbot --nginx` de novo
para ele reinstalar o TLS.

### Voltar atrás

Não há versionamento de imagem. O rollback hoje é reverter o código no Mac,
rodar o rsync de novo e rebuildar. **Migration aplicada não volta sozinha** —
`npm run migration:revert` existe, mas é decisão caso a caso, e depois de gente
usando o produto raramente é a decisão certa.

---

# Parte 2 — Instalar do zero

Só é necessário se a máquina for refeita ou se o produto for para uma segunda
VPS. A de hoje já passou por tudo isto.

**1. Preparar a máquina** (Ubuntu 22.04 ou 24.04, pelo menos 2 GB de RAM — com
menos, o `next build` morre por falta de memória; a saída é criar swap, ver a
tabela no fim):

```bash
sudo apt update && sudo apt install -y git nginx
curl -fsSL https://get.docker.com | sudo sh
sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw enable
```

**2. Apontar o DNS** — dois registros `A` para o IP da VPS: `@` e `api`, mais um
`CNAME` de `www`. Faça primeiro: a propagação demora e o certbot depende dela.

**3. Levar o código** para `/opt/beesocial` (o `rsync` da Parte 1).

**4. Escrever o `.env`** — `cp .env.production.example .env`, `chmod 600 .env`, e
preencher as quatro obrigatórias: `JWT_SECRET`, `POSTGRES_PASSWORD`,
`INTERNAL_API_SECRET` (cada um de um `openssl rand -hex 32`) e `SITE_URL`, com o
`https://` final. Faltando qualquer uma, o `up` falha com mensagem explícita.

**5. Subir os containers** — o mesmo `up -d --build` da Parte 1. Nada responde
de fora ainda; falta o nginx.

**6. Publicar pelo nginx:**

```bash
sudo cp deploy/nginx/beesocial.bio.conf     /etc/nginx/sites-available/beesocial.bio
sudo cp deploy/nginx/api.beesocial.bio.conf /etc/nginx/sites-available/api.beesocial.bio
sudo ln -s ../sites-available/beesocial.bio     /etc/nginx/sites-enabled/
sudo ln -s ../sites-available/api.beesocial.bio /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

Publicar o vhost da API é **opcional** — o produto não passa por ele.

**7. Ligar o HTTPS:**

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d beesocial.bio -d www.beesocial.bio -d api.beesocial.bio
```

É aqui que os blocos do repositório deixam de ser o que está instalado: o
certbot os reescreve. Ele também instala o `certbot.timer`, que renova sozinho —
confira com `sudo certbot renew --dry-run`.

> **Nunca rode dois certbot ao mesmo tempo.** Duas execuções disputam o mesmo
> desafio ACME e a Let's Encrypt recusa com `authorization must be pending`. E
> matar o comando no seu terminal **não** mata o processo na VPS: se precisar
> interromper, `pkill certbot` lá dentro.

---

# Operação

```bash
# logs
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f web
tail -f /var/log/nginx/error.log

# estado
docker compose -f docker-compose.prod.yml ps

# psql (o banco não tem porta publicada; entra-se por dentro)
docker compose -f docker-compose.prod.yml exec db psql -U beesocial -d beesocial
```

Todos os containers têm teto de log (10 MB × 3 arquivos). Sem isso o default do
Docker cresce sem limite — é assim que um disco enche e o Postgres para de
aceitar escrita.

### Certificados

Renovação automática pelo `certbot.timer`. O e-mail cadastrado no certbot é o
**único** aviso que chega antes de um certificado expirar e o site cair com erro
de TLS.

### Backup do banco

**Não é automático.** Rode antes de qualquer atualização que mexa em migration:

```bash
docker compose -f docker-compose.prod.yml exec -T db \
  pg_dump -U beesocial beesocial | gzip > ~/backup-$(date +%F-%H%M).sql.gz
```

Restaurar:

```bash
gunzip -c ~/backup-2026-09-21-1430.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T db psql -U beesocial -d beesocial
```

# Quando algo dá errado

| Sintoma | Causa provável | O que fazer |
| --- | --- | --- |
| `502 Bad Gateway` | o container caiu, ou não está no loopback esperado | `docker compose -f docker-compose.prod.yml ps` e os logs do serviço |
| O build do front morre sem erro claro | `next build` estourou a memória | crie swap: `sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile` (e a linha em `/etc/fstab` para sobreviver a reboot) |
| `ERRO: NEXT_PUBLIC_SITE_URL nao foi passado ao build` | falta `SITE_URL` no `.env` | preencha e rode o `up --build` de novo. A trava é intencional |
| O link copiado aponta para `localhost` | o build foi feito sem `SITE_URL`, ou ela mudou depois | `up -d --build web` |
| `413 Request Entity Too Large` ao trocar a foto | `client_max_body_size` faltando no bloco do nginx | as fotos vão como data URL base64 (~1,8 MB); os blocos do repositório já trazem `10m` |
| Entra e cai para o login na primeira navegação | cookie `secure` sem HTTPS na borda | é TLS faltando ou quebrado; `curl -sI https://beesocial.bio` |
| O contador de cliques não sobe | `INTERNAL_API_SECRET` divergente ou ausente | com os dois containers lendo o mesmo `.env` isso não deveria acontecer; confira os logs da API por 401 |
| `certbot` falha na validação | DNS não propagou, porta 80 fechada, ou outro certbot rodando | `dig +short beesocial.bio`, `sudo ufw status`, `pgrep certbot` |
| A API responde, o healthcheck diz `unhealthy` | ela não alcança o Postgres | logs do `db`; o healthcheck toca o banco de propósito |

# O que este deploy ainda não resolve

- **Sem backup automático.** Existe banco de produção com conta real e nenhuma
  rotina. Os avatares em base64 fazem o dump crescer rápido. É a pendência mais
  séria desta lista.
- **Deploy manual, preso a uma máquina.** Sai do Mac de quem faz, por rsync. Uma
  deploy key no GitHub deixaria a VPS puxar direto.
- **Sem zero-downtime.** `up -d --build` derruba e sobe o container: há alguns
  segundos de indisponibilidade.
- **Sem CI.** A API tem testes (`api/test/`) e nada os roda antes do deploy.
- **Uma réplica só.** O entrypoint roda migration a cada subida, o que é correto
  para uma instância — com duas subindo juntas, são duas migrations concorrentes.
- **A brecha do `x-forwarded-for`**, com o vhost da API publicado: um cliente
  direto pode forjar o cabeçalho e contornar o throttler. As saídas estão no fim
  de `nginx/api.beesocial.bio.conf`. Decisão pendente.
