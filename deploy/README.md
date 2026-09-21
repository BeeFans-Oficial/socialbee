# Deploy do BeeSocial

Como colocar o produto no ar numa VPS Ubuntu, do zero, e como mantê-lo depois.

Este documento é o passo a passo. O **porquê** de cada decisão está escrito nos
arquivos que você vai usar: [`docker-compose.prod.yml`](../docker-compose.prod.yml),
[`.env.production.example`](../.env.production.example) e os dois blocos de
`nginx/` aqui do lado. Vale ler os comentários deles quando algo parecer
arbitrário.

## O que vai rodar onde

Tudo numa máquina só. Três containers, e um nginx que **não** é container.

```
     navegador ──> nginx (host, :80/:443)
                     ├─ beesocial.bio      ──> 127.0.0.1:3000   web  (Next)
                     └─ api.beesocial.bio  ──> 127.0.0.1:3333   api  (NestJS)

     web ──(rede interna do Compose)──> api:3333 ──> db:5432
```

Três coisas explicam quase toda a configuração:

**Os containers publicam só no loopback.** `127.0.0.1:3000` e `127.0.0.1:3333`,
e o banco não publica porta nenhuma. O único processo que alcança os três é o
nginx, na própria máquina. Sem o prefixo `127.0.0.1:`, o Docker faria bind em
`0.0.0.0` e escreveria regras de iptables **antes** do ufw — o firewall não
bloquearia, e a API ficaria exposta sem TLS.

**O navegador nunca fala direto com a API.** O painel chama `/api/v1/*` na
própria origem do front, e quem repassa é um Route Handler do Next
(`app/api/v1/[...path]/route.ts`), que alcança a API pela rede interna do
Docker. É isso que mantém o cookie de sessão same-site e o segredo interno fora
da rede pública. O domínio `api.beesocial.bio` existe para Postman e clientes
externos; o produto não passa por ele.

**O nginx é nativo do host, instalado por `apt`.** Quem termina o TLS é ele,
com certificado do certbot. Não há serviço de borda no compose.

## Antes de começar

- Uma VPS Ubuntu (22.04 ou 24.04) com acesso `ssh` e **pelo menos 2 GB de RAM**.
  Com menos, o `next build` morre por falta de memória — a saída é criar swap,
  e está explicado em [Quando algo dá errado](#quando-algo-dá-errado).
- Um domínio, com acesso ao painel de DNS.
- `git` e `docker` na máquina (o passo 1 instala).

Todos os comandos abaixo rodam **na VPS**, dentro do diretório do projeto,
exceto onde estiver dito o contrário.

## 1. Preparar a máquina

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git nginx

# Docker Engine + plugin do Compose
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"    # saia e entre de novo para valer
```

Firewall — só as três portas que precisam existir:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

> O ufw não protege porta publicada por container em `0.0.0.0` (o Docker escreve
> iptables antes dele). Nosso compose evita isso publicando só no loopback — mas
> é o motivo de nunca tirar o `127.0.0.1:` de lá.

## 2. Apontar o DNS

No painel do seu domínio, dois registros `A` para o IP da VPS:

| Tipo | Nome | Valor |
| --- | --- | --- |
| A | `@` (ou `beesocial.bio`) | IP da VPS |
| A | `api` | IP da VPS |

Um `CNAME` de `www` para o domínio raiz, se quiser `www` funcionando.

Faça isso **agora**: a propagação leva de minutos a horas, e o certbot do passo
6 só emite certificado depois que o nome resolve para esta máquina.

Sem domínio próprio ainda? O hostname que a Hostinger já entrega
(`srv1846638.hstgr.cloud`) serve para subir e testar. Nesse caso troque os
`server_name` dos blocos do nginx antes do passo 5.

## 3. Trazer o código

```bash
git clone git@github.com:BeeFans-Oficial/socialbee.git
cd socialbee
```

## 4. Escrever o `.env`

```bash
cp .env.production.example .env
```

Gere cada segredo separadamente — não reaproveite os do desenvolvimento:

```bash
openssl rand -hex 32    # JWT_SECRET
openssl rand -hex 32    # POSTGRES_PASSWORD
openssl rand -hex 32    # INTERNAL_API_SECRET
```

Preencha as quatro variáveis obrigatórias:

| Variável | O que é |
| --- | --- |
| `JWT_SECRET` | assina o token de sessão (mínimo 32 caracteres) |
| `POSTGRES_PASSWORD` | senha do banco |
| `INTERNAL_API_SECRET` | autoriza as chamadas do Next para a API |
| `SITE_URL` | origem pública do front, com `https://` e sem barra no fim |

`SITE_URL` é a que mais confunde, porque ela vai para três lugares e um deles é
**build-time**: o `NEXT_PUBLIC_SITE_URL` que o Next embute no bundle. Mudá-la
depois exige rebuild do front, não basta reiniciar. E escreva já o endereço
`https://` final, mesmo que o certificado só nasça no passo 6 — é ele que vai
para o link que a criadora copia.

Se faltar qualquer uma delas, o `up` falha com mensagem explícita, e o build do
front falha antes de produzir uma imagem com `localhost` chumbado no botão de
copiar. É de propósito: configuração incompleta derruba o build, não a
visitante.

## 5. Subir os containers

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

O primeiro build demora — são duas imagens (Next e NestJS), cada uma em vários
estágios. Acompanhe:

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f api
```

Você deve ver o entrypoint da API fazendo, nesta ordem: schema, migrations,
seed, e só então abrindo a porta. A migration acontece uma vez, antes de a
aplicação atender — a API não migra sozinha em runtime, de propósito (duas
instâncias migrando juntas é como se ganha um deadlock em produção).

O serviço `web` só sobe depois de a API responder `healthy`, e o healthcheck da
API **toca o banco**: um processo que responde 200 sem conseguir consultar o
Postgres é o pior tipo de "saudável".

Confira, ainda por dentro da máquina:

```bash
curl -s http://127.0.0.1:3333/v1/health    # API + banco
curl -sI http://127.0.0.1:3000 | head -1   # front
```

Nada responde de fora ainda. É o esperado: falta o nginx.

## 6. Publicar pelo nginx

```bash
sudo cp deploy/nginx/beesocial.bio.conf     /etc/nginx/sites-available/beesocial.bio
sudo cp deploy/nginx/api.beesocial.bio.conf /etc/nginx/sites-available/api.beesocial.bio

sudo ln -s ../sites-available/beesocial.bio     /etc/nginx/sites-enabled/
sudo ln -s ../sites-available/api.beesocial.bio /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

sudo nginx -t && sudo systemctl reload nginx
```

Usa outro domínio? Edite os `server_name` dos dois arquivos antes de recarregar.

Agora o site responde em `http://` — sem TLS ainda. Dá para abrir no navegador e
conferir que a landing e o painel carregam.

> Publicar o vhost da API é **opcional**. O produto não passa por ele; ele
> existe para Postman, curl e clientes externos. Se você não precisa disso
> agora, pule o segundo arquivo: menos superfície exposta, e some junto a brecha
> descrita na nota de segurança no fim de `nginx/api.beesocial.bio.conf`.

## 7. Ligar o HTTPS

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d beesocial.bio -d www.beesocial.bio -d api.beesocial.bio
```

O certbot reescreve os blocos que você acabou de instalar, acrescentando o
`listen 443 ssl`, as linhas de certificado e o redirecionamento da porta 80. Por
isso os arquivos do repositório são a versão **sem** TLS: eles são o ponto de
partida, não o estado final.

Ele também instala um timer de renovação. Confira que funciona:

```bash
sudo certbot renew --dry-run
systemctl list-timers | grep certbot
```

O e-mail que o certbot pede na primeira execução é o único aviso que chega
**antes** de o certificado expirar e o site sair do ar. Use um que alguém leia.

## 8. Conferir de fora

Do seu computador, não da VPS:

```bash
curl -sI https://beesocial.bio | head -1              # 200
curl -s  https://api.beesocial.bio/v1/health          # ok
curl -sI http://beesocial.bio | head -1               # 301 para https
```

E no navegador, o que só o olho pega:

- [ ] A landing abre em `https://`, com cadeado.
- [ ] Criar conta, entrar, e o painel carregar os links — se o cookie de sessão
      não estiver grudando, é aqui que aparece.
- [ ] No painel, **copiar o link** de um link e colar numa aba nova. Ele tem que
      apontar para o seu domínio, não para `localhost`.
- [ ] Abrir o perfil público `/seu-slug` e clicar num link: o contador em
      `/analytics` precisa subir.
- [ ] Trocar a foto de perfil (é o caminho que passa pelo limite de 10 MB do
      nginx).

## Atualizar para uma nova versão

```bash
cd socialbee
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

O Compose recria só o que mudou. Migrations novas são aplicadas sozinhas, pelo
entrypoint da API, antes de a porta abrir.

Duas situações pedem atenção:

**Mudou a `SITE_URL`?** O front precisa ser reconstruído, porque a URL está
embutida no bundle. `restart` não resolve:

```bash
docker compose -f docker-compose.prod.yml up -d --build web
```

**Mudou algum bloco do nginx no repositório?** `git pull` não toca em
`/etc/nginx/`. Copie de novo — mas cuidado: o certbot já editou os arquivos
instalados, e copiar por cima apaga a configuração de TLS. O caminho seguro é
aplicar a mudança à mão no arquivo de `/etc/nginx/sites-available/`, ou copiar e
rodar `sudo certbot --nginx` outra vez para ele reinstalar o TLS.

## Operação do dia a dia

```bash
# logs
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f web
sudo tail -f /var/log/nginx/error.log

# estado
docker compose -f docker-compose.prod.yml ps

# reiniciar um serviço
docker compose -f docker-compose.prod.yml restart api

# psql (o banco não tem porta publicada; entra-se por dentro)
docker compose -f docker-compose.prod.yml exec db psql -U beesocial -d beesocial
```

### Backup do banco

Isto **não é automático**. Enquanto não for, rode antes de qualquer atualização
que mexa em migration:

```bash
docker compose -f docker-compose.prod.yml exec -T db \
  pg_dump -U beesocial beesocial | gzip > ~/backup-$(date +%F-%H%M).sql.gz
```

Restaurar:

```bash
gunzip -c ~/backup-2026-09-21-1430.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T db psql -U beesocial -d beesocial
```

Os dados vivem no volume `beesocial-db`, que sobrevive a `down` e a `up
--build`. Quem apaga tudo é `down -v` — o `-v` remove volumes. Não rode isso em
produção.

## Quando algo dá errado

| Sintoma | Causa provável | O que fazer |
| --- | --- | --- |
| `502 Bad Gateway` | o container não está de pé, ou não está no loopback esperado | `docker compose -f docker-compose.prod.yml ps` e os logs do serviço |
| O build do front morre sem erro claro, VPS pequena | `next build` estourou a memória | crie swap: `sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile` (e a linha em `/etc/fstab` para sobreviver a reboot) |
| `ERRO: NEXT_PUBLIC_SITE_URL nao foi passado ao build` | falta `SITE_URL` no `.env` | preencha e rode o `up --build` de novo. A trava é intencional |
| O link copiado aponta para `localhost` | o build foi feito sem `SITE_URL`, ou ela mudou depois | `up -d --build web` |
| `413 Request Entity Too Large` ao trocar a foto | `client_max_body_size` faltando no bloco do nginx | as fotos vão como data URL base64 (~1,8 MB); os blocos do repositório já trazem `10m` |
| Entra e cai para o login na primeira navegação | cookie `secure` sem HTTPS na borda | conclua o passo 7. O `COOKIE_SECURE: "true"` é fixo no compose, e sem TLS o navegador descarta o cookie |
| O contador de cliques não sobe | `INTERNAL_API_SECRET` divergente ou ausente | com os dois containers lendo o mesmo `.env` isso não deveria acontecer; confira os logs da API por 401 |
| `certbot` falha na validação | DNS ainda não propagou, ou a porta 80 está fechada | `dig +short beesocial.bio` e `sudo ufw status` |
| A API responde, o healthcheck diz `unhealthy` | ela não alcança o Postgres | logs do `db`; o healthcheck toca o banco de propósito |

## O que este deploy ainda não resolve

- **Backup automático.** Hoje é o comando manual acima. Um `cron` com retenção
  resolve, e não existe.
- **Zero-downtime.** `up -d --build` derruba e sobe o container: há alguns
  segundos de indisponibilidade. Para o estágio atual do produto, é aceitável.
- **CI.** A API tem 49 testes que passam; nada os roda antes do deploy.
- **A brecha do `x-forwarded-for`**, se você publicar o vhost da API. Está
  descrita, com as saídas possíveis, no fim de `nginx/api.beesocial.bio.conf`.
  Decisão pendente.
