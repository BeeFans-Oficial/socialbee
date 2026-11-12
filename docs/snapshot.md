# Snapshot da aplicação

Registro do que está implementado na `main`, atualizado no fim de cada sessão
de trabalho. No início da sessão, confere-se este arquivo contra o código; no
fim, marca-se o que entrou.

| | |
| --- | --- |
| **Commit da `main`** | `adaf9f0f` (merge da PR #53, 2026-11-07) |
| **Snapshot tirado em** | 2026-11-12 |
| **PRs mergeadas** | #1 a #53 (#54 aberta) |
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
- [x] **Chegada não repete fora do app** (sessão de 12/11, PR #54): a rolagem
      dentro do app pede um passe assinado (`POST /<slug>/p`), o botão abre
      `/<slug>/p/<passe>` no navegador de fora, a rota grava um cookie
      `HttpOnly` de 30 min e responde 307 para o endereço limpo; com o cookie,
      o servidor não inclui a chegada. Sem estado, sem parâmetro na URL, sem
      ramo por user-agent ou IP (`lib/passe-chegada.ts`). Falta confirmar em
      iPhone real e repetir a checagem da Meta em domínio de reserva.
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

### E-mail

- [x] **Boas-vindas com confirmação obrigatória do e-mail** (sessão de
      06/11, PR #48): Resend em produção, log em dev e teste; o cadastro não
      abre sessão e o login recusa conta não confirmada (`email_nao_confirmado`)
      com reenvio público por e-mail; token hasheado em `email_tokens`, 24 h;
      `POST /v1/auth/email/confirmar` e `/reenviar`, ambas públicas; página
      `/confirmar-email`; telas "confira seu e-mail" no cadastro e no login;
      conta sem confirmar em 7 dias é apagada; contas anteriores marcadas
      como confirmadas.
- [x] **Convite da conta criada pelo admin**: só o e-mail; `password_hash`
      nulo até a pessoa criar a senha em `/definir-senha` pelo link do
      convite (7 dias, `purpose = set_password`), que confirma o e-mail e abre
      sessão; admin reenvia convite com auditoria (`convite.reenviar`).

### Saúde da página (o simulador da revisão da Meta)

- [x] **Simulador da revisão da Meta** (sessão de 06/11, PR #50): quatro
      verificações (consistência entre 5 identidades, destino final de cada
      botão, barreira 18+, domínio e home), veredito verde/amarelo/vermelho
      com ação por item, histórico em `page_reviews`, cron diário com e-mail
      quando piora, tela própria de histórico em `/paginas/:id/revisao`
      (linha do tempo com data, hora, veredito e as quatro camadas em vista
      explodida 3D, no padrão do `/breakdown`, com imersão em cada camada:
      identidades e bytes, cadeia de cada botão, barreira, domínio e
      visitas, navegável por setas), selo clicável na
      lista de páginas e linha no editor, páginas fora do verde na Visão geral
      do admin; "Verificar destino" por link no editor
      de Links. 5 testes e2e com site de mentira no lugar do `fetch`; 4
      unitários.
- [x] **Saúde no painel** (sessão de 07/11, PR #51): a
      revisão vira "Saúde" no vocabulário do painel. Item "Saúde" na barra
      lateral e na barra inferior do celular (que passa a 4 + Mais); tela
      `/saude` com todas as páginas da conta e a última checagem de cada uma
      (resumo verde / para corrigir / sem checagem, o que falta, "Checar"
      por linha e "Checar todas"); a tela de uma página muda para
      `/saude/:id` (o endereço antigo redireciona); o card em Páginas troca o
      ícone de 28 px por uma pastilha legível com veredito e o que corrigir;
      e-mail de alerta aponta para a tela Saúde. API: `GET /v1/me/saude`
      (uma consulta com `LATERAL`) e `POST /v1/me/saude/checar`. 1 teste e2e
      novo (61 no total).

### Tela inicial

- [x] **Tela inicial que se constrói na rolagem** (sessão de 07/11, PR #52,
      `feat/historia-em-camadas`): cada bloco entra quando chega à tela
      (`Revelar`, uma vez, de baixo para cima e desfocado para nítido;
      listas em escada), e "Como funciona" virou a pilha de camadas da vista
      explodida se montando placa a placa, com linha-guia, etiqueta e os
      quatro textos na mesma ordem, terminando no selo verde. Vocabulário
      de benefício para a fã. Substitui os três cards.

### Rastreamento

- [x] Visualizações e cliques por perfil e canal em Postgres; robô não vira
      clique e é contado à parte (`botHits`); `HEAD` não conta; contador
      desnormalizado por link, evento cru com TTL de 90 dias. (PR #2, #4, #28)
- [x] Relatório de 7, 30 ou 90 dias no Analytics (só Pro).
- [x] **Filtros no Analytics** (sessão de 06/11, PR #49): janela livre por
      datas (até 90 dias), recortes por link, origem, endereço de chegada,
      aparelho, país e dentro de app; comparação com a janela anterior nos
      cartões; opções vindas do próprio relatório; recorte na URL; clique nas
      listas aplica o filtro.
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

- [ ] **Recuperação de senha.** O envio de e-mail e a tabela de tokens já
      existem (06/11); falta a rota, o modelo e a tela.
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
- [ ] Agendamento/expiração de link, QR code da página, exportação no
      Analytics, miniatura e descrição fora do modelo Cartões.

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
| 2026-11-06 | `feat/admin-pool-de-dominios`, PR #46 | Tela Domínios no admin: pool com listar, adicionar pausado, ativar, pausar, renomear; 5 rotas em `/v1/admin/dominios*`; 1 teste e2e novo (51 no total). |
| 2026-11-06 | `feat/email-de-boas-vindas`, PR #48 | Resend: e-mail de boas-vindas com confirmação obrigatória antes do login, tokens, rotas públicas, telas de cadastro/login/confirmação, expurgo de contas não confirmadas; convite com criação de senha para conta aberta pelo admin; 3 testes e2e novos. Domínio `beesocial.bio` verificado no Resend. |
| 2026-11-06 | `feat/filtros-no-analytics`, PR #49 | Filtros e janela livre no Analytics, comparação com o período anterior, quebras por aparelho e endereço de chegada; 1 teste e2e novo (55 no total). |
| 2026-11-06 | `feat/simulador-da-revisao-da-meta`, PR #50 (empilhada na #49) | Simulador da revisão da Meta: API, cron, e-mail, editor, lista de páginas, admin, verificação por link; 5 e2e + 4 unitários novos (60 e 62). |
| 2026-11-07 | `feat/saude-no-painel`, PR #51 | "Saúde" na barra lateral e no celular, tela `/saude` com todas as páginas e "Checar todas", tela da página em `/saude/:id`, pastilha legível no card, vocabulário "revisão" → "saúde/checagem"; 1 e2e novo (61). |
| 2026-11-07 | `feat/historia-em-camadas`, PR #52 | Tela inicial que se constrói na rolagem (`Revelar`) e "Como funciona" como a pilha de camadas se montando placa a placa; sem testes novos. |
| 2026-11-07 | `fix/chegada-sem-flash-e-dominio-padrao`, PR #53 | Chegada sem piscar o perfil (script inline esconde `data-perfil` até a tela montar), botão só no fim da rolagem e some ao subir, fechamento no documento sem `?fora=1`; "padrão da plataforma" some do seletor com o host padrão pausado no pool (`padrao` em `GET /me/domains`, 409 ao voltar); mensagens da Saúde sem citar o incidente; 1 e2e novo (62). |
| 2026-11-12 | `fix/chegada-nao-repete-fora-do-app`, PR #54 | Passe assinado da chegada: quem rola e sai do Instagram abre o perfil direto no navegador de fora, sem repetir a tela de rolagem; rotas `/<slug>/p` e `/<slug>/p/<passe>`, cookie `HttpOnly` de 30 min; verificado com Playwright local, sem teste automatizado novo. |
