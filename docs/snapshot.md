# Snapshot da aplicação

Registro do que está implementado na `main`, atualizado no fim de cada sessão
de trabalho. No início da sessão, confere-se este arquivo contra o código; no
fim, marca-se o que entrou.

| | |
| --- | --- |
| **Commit da `main`** | `ba9313ba` (merge da PR #45, 2026-11-03) |
| **Snapshot tirado em** | 2026-11-06 |
| **PRs mergeadas** | #1 a #45 |
| **Produção** | https://beesocial.bio, deploy automático a cada merge na `main` |

## 1. Implementado

### Fundação

- [x] App Next 16 (App Router) + API NestJS + Postgres, tudo em container no
      `docker-compose.yml`; em dev só o banco roda em container. (PR #4, #8)
- [x] Proxy `/api/v1/*` no servidor do app; o navegador nunca fala com a API
      direto e o cookie de sessão é same-site.
- [x] Autenticação por email e senha, sessão em cookie assinado (7 dias, sem
      refresh), registro em `sessions`, `proxy.ts` barrando o painel sem cookie.
- [x] CI/CD: testes da API com Postgres real em toda PR, build do front, deploy
      na VPS a cada push na `main`, com backup pré-deploy e rollback por
      `workflow_dispatch`. (PR #22, #41)
- [x] Deploy em VPS com nginx nativo terminando TLS e runbook em
      `deploy/README.md`. (PR #10, #35)
- [x] 11 migrations, seed da conta demo (`bella@beesocial.app`).

### Perfil público e página de chegada

- [x] Perfil renderizado no servidor em `/[slug]`, com barreira 18+. (PR #9)
- [x] **Mesmo HTML para todo mundo** (fã, crawler, navegador da Meta). A página
      de chegada é sobreposição decidida no aparelho; o redirecionador `/r/[code]`
      dá o mesmo 307 a qualquer visitante. Decisão tomada após o incidente de
      15/10/2026 (`docs/incidente-meta-2026-10-15.md`). (PR #37)
- [x] Página de chegada (`IabLanding`) para todo visitante, com imagem padrão,
      botão revelado após interação, saída do Instagram no iPhone via extbrowser,
      sem entrada no histórico do navegador. (PR #11, #17, #18, #23, #24, #25,
      #39, #43)
- [x] Cada página responde só pelo domínio dela; pool de 7 domínios com sorteio
      no cadastro e escolha pela criadora (Pro). (PR #15, #16)
- [x] Domínio próprio: a criadora conecta, a API checa o DNS, a equipe ativa por
      script (`dominio:ativar`) e configura nginx + certificado à mão. (PR #21)

### Painel da criadora

- [x] Telas: Páginas (lista e editor), Links (lista e editor), Analytics,
      Domínios, Configurações. Seletor de página em Links e Analytics.
      (PR #13, #26, #27)
- [x] Várias páginas por conta, modelos de página, tema, cores e fonte; aba
      Aparência foi absorvida pelo editor de página. (PR #13, #40)
- [x] Tirar do ar e apagar página e link. (PR #14)
- [x] Reordenação de links por arrastar (lista completa).
- [x] Prévia da página no painel, editável na própria prévia. (PR #40, #44)
- [x] Upload de avatar, capa, foto da chegada e miniatura de link via multipart,
      redimensionado com `sharp`, guardado em S3 (R2 em produção, RustFS em dev),
      servido por `/media/` com cache no nginx. Base64 removido. (PR #30, #32,
      #33, #34)
- [x] Tour guiado por tela, com holofote e balões, estado em `localStorage`.
      (PR #42)
- [x] Interface sem neon, tooltip próprio, favicon. (PR #20, #21, #30)

### Rastreamento

- [x] Visualizações e cliques por perfil e canal em Postgres; robô não vira
      clique e é contado à parte (`botHits`); `HEAD` não conta; contador
      desnormalizado por link, evento cru com TTL de 90 dias. (PR #2, #4, #28)
- [x] Relatório de 7, 30 ou 90 dias no Analytics (só Pro).
- [x] `arrival_host` gravado no evento (base para a saúde do pool de domínios).

### Planos

- [x] Free e Pro por `users.pro_until`, regras em `api/src/plans/plans.ts`,
      histórico em `plan_grants`. Limites do Free: 1 página, 5 links, só modelo
      Clássico, sem escolha de domínio, sem relatório, sem `cloakEnabled`. Nada
      é apagado ao voltar para Free. (PR #21)
- [x] Liberação manual por script (`plano:liberar`) ou pelo painel admin.

### Painel admin (`/admin`)

- [x] Papel `users.role` (`creator` | `admin`), `RolesGuard` + `@Roles`, rotas
      `/v1/admin/*`, `proxy.ts` devolve 404 a quem não é admin, primeiro admin
      promovido por script (`admin:promover`). (PR #45)
- [x] Telas: Visão geral, Contas (busca, detalhe, criar, editar, apagar),
      Auditoria. Tema claro, paleta slate, para não confundir com o painel da
      criadora.
- [x] Ações na conta: liberar e rebaixar Pro, revogar sessões, promover e
      rebaixar admin, tudo com motivo obrigatório gravado em `admin_actions`.
- [x] Conta criada pelo admin nasce sem página; a criadora monta a própria.
- [x] **Pool de domínios** (`/admin/dominios`, sessão de 06/11, ainda sem PR):
      lista com páginas, páginas no ar e visitas da semana por host; adicionar
      (nasce pausado), ativar, pausar e renomear, com motivo e auditoria.
      Alerta "ativo, sem visitas" para domínio com página no ar e zero visitas
      em 7 dias.

### Qualidade

- [x] API: 8 arquivos de teste (unitários + e2e), cerca de 109 casos, rodando no
      CI.

## 2. Não implementado

Lista cruzada entre `README.md` ("O que ainda não existe"), o To-do do vault e
a nota "Melhorias recomendadas — 2026-11-03".

### Produto

- [ ] **Recuperação de senha e envio de e-mail.** A API não envia e-mail
      nenhum; sem verificação de cadastro.
- [ ] **Assinatura Pro por Pix.** Pro só na mão.
- [ ] **Ativação de domínio próprio sem SSH.** Certificado e nginx ainda são
      manuais; o painel admin não tem tela de domínios próprios (a de pool
      existe desde 06/11). Entrada de domínio no pool também ainda exige nginx e
      certificado à mão na VPS; o painel só faz a linha no banco.
- [ ] **Troca de senha** em `/configuracoes`.
- [ ] **Safe Page**: o editor grava `safe_pages`, nenhuma rota serve. Decisão
      em aberto: remover ou reaproveitar.
- [ ] **Saúde do pool de domínios** (Fase D do plano): `arrival_host` já
      coleta, falta o sistema que pausa um domínio esfriado.
- [ ] **Medir a página de chegada**: "viu" e "continuou" não são eventos.
- [ ] **Estado do tour no servidor** (hoje `localStorage`).
- [ ] Painel admin, Fase 1 restante: filtro na Auditoria, último deploy e
      saúde da API na Visão geral, domínios próprios.
- [ ] Painel admin, Fases 2 e 3: Páginas, Links com domínios bloqueados,
      rastreamento global, suporte (reset de senha, zerar tour), configurações
      da plataforma, pagamentos, saúde, 2FA de admin, "Ver como".
- [ ] Agendamento/expiração de link, QR code da página, comparação de período e
      exportação no Analytics, miniatura e descrição fora do modelo Cartões.

### Engenharia

- [ ] **ESLint**: sem config, `npm run lint` quebra desde o Next 16.
- [ ] **Testes do front**: zero. Os roteiros Playwright de 03/11 são a base.
- [ ] **Monitoramento de erro** (Sentry ou similar) e erros amigáveis na API
      (`AccessDenied` do R2 vira 500).
- [ ] **Ambiente de homologação**: push na `main` vai direto para produção.
- [ ] **Backup diário agendado** com retenção e teste de restauração.
- [ ] **Credenciais do R2 separadas por ambiente**: dev e produção usam o mesmo
      bucket e token.
- [ ] Sessão deslizante ou refresh; teto de armazenamento por conta; registro
      de IP e versão do termo na confirmação de idade.

### Documentação desatualizada

- `README.md` diz que "nada roda os testes automaticamente" e cita 49 testes;
  o CI existe desde a PR #22 e os casos são cerca de 109.
- O To-do do vault ainda lista "Montar os planos Pro e Free" e "Autenticação via
  Clerk" como abertos; o primeiro está feito (PR #21) e o segundo foi
  substituído pela autenticação própria.
- A nota-hub `BeeSocial.md` do vault está datada de 2026-10-14 e ainda descreve
  o cloaking como diferencial; desde 15/10 a decisão é o oposto.

## 3. Histórico de sessões

| Data | Branch / PR | O que entrou |
| --- | --- | --- |
| 2026-11-06 | — | Snapshot inicial, a partir da `main` em `ba9313ba`. |
| 2026-11-06 | `feat/admin-pool-de-dominios` (sem PR ainda) | Tela Domínios no admin: pool com listar, adicionar pausado, ativar, pausar, renomear; 5 rotas em `/v1/admin/dominios*`; 1 teste e2e novo (51 no total). |
