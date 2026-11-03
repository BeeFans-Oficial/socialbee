import { SetMetadata } from "@nestjs/common";

export const PODE_SEM_PAGINA_KEY = "beesocial:podeSemPagina";

/**
 * Rota que funciona para uma conta SEM nenhuma página.
 *
 * O normal é toda conta ter ao menos uma (o cadastro cria conta e página
 * juntas). A exceção é a conta aberta pelo admin, que nasce vazia para a
 * própria pessoa montar a página. Até ela criar, só passam as rotas marcadas
 * aqui: sessão, lista e criação de páginas, admin. O resto responde
 * `sem_pagina` em vez de tropeçar num id vazio.
 */
export const SemPagina = () => SetMetadata(PODE_SEM_PAGINA_KEY, true);
