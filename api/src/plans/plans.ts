import { ForbiddenException } from "@nestjs/common";

/**
 * Planos Free e Pro: o que cada um pode.
 *
 * Um lugar só, e o front espelha em `lib/plans.ts`. Duas listas de limites
 * escritas à mão divergem, e o que diverge é a tela prometendo algo que a API
 * recusa.
 *
 * ## O que NÃO é Pro, de propósito
 *
 * - **Sair do aplicativo** (`iab_enabled`). É o que impede o link de morrer
 *   dentro do Instagram — a razão de o produto existir — e está ligado para
 *   todo mundo desde `1790600000000-SairDoAppPorPadrao`. Travar no Pro faria
 *   toda página Free voltar a abrir presa na janelinha do aplicativo.
 * - **O sorteio de domínio** no cadastro. Espalhar as contas pelo pool é o que
 *   impede um bloqueio de derrubar a base inteira. O Pro libera só ESCOLHER o
 *   domínio, não o sorteio.
 *
 * ## Quando a conta volta ao Free
 *
 * Nada é apagado. O que foi configurado no Pro fica gravado e para de valer na
 * página pública (`profiles.service.ts`, `toPublicProfileView`); assinar de
 * novo devolve tudo como estava. Links e páginas acima do limite continuam no
 * ar — esconder link quebraria o que já está divulgado na bio — e só deixa de
 * ser possível criar novos.
 */

export type PlanoId = "free" | "pro";

export interface Limites {
  /** Páginas por conta. `null` é sem limite. */
  paginas: number | null;
  /** Links por página. `null` é sem limite. */
  linksPorPagina: number | null;
  /** Acesso ao relatório de visitas e cliques. */
  relatorio: boolean;
  /** Vagas de domínio próprio. */
  dominiosProprios: number;
}

export const PLANOS: Record<PlanoId, Limites> = {
  free: { paginas: 1, linksPorPagina: 5, relatorio: false, dominiosProprios: 0 },
  pro: { paginas: null, linksPorPagina: null, relatorio: true, dominiosProprios: 3 },
};

/** O único modelo de página do Free. */
export const TEMPLATE_DO_FREE = "classico";

/** O que o Free não cobre — vai no erro para o front saber o que oferecer. */
export type RecursoPro =
  | "paginas"
  | "links"
  | "cloaking"
  | "aparencia"
  | "dominio"
  | "relatorio"
  | "dominioProprio";

const MENSAGENS: Record<RecursoPro, string> = {
  paginas: "O plano Free tem uma página. Assine o Pro para criar mais.",
  links: `O plano Free tem até ${PLANOS.free.linksPorPagina} links por página. Assine o Pro para adicionar mais.`,
  cloaking: "Cloaking e página segura são do plano Pro.",
  aparencia: "Outros modelos, cores e fontes são do plano Pro.",
  dominio: "Escolher o domínio da página é do plano Pro.",
  relatorio: "O relatório de visitas e cliques é do plano Pro.",
  dominioProprio: "Domínio próprio é do plano Pro.",
};

/**
 * O plano a partir da data.
 *
 * `agora` é parâmetro para o teste não depender do relógio.
 */
export function planoDe(proUntil: Date | null | undefined, agora: Date = new Date()): PlanoId {
  return proUntil && proUntil.getTime() > agora.getTime() ? "pro" : "free";
}

/**
 * Recusa a operação se o plano não cobre o recurso.
 *
 * 403 e não 409: não é conflito de estado, é falta de permissão do plano. O
 * `code` é o mesmo para todo recurso — o front trata num lugar só — e
 * `details.recurso` diz qual foi.
 */
export function exigirPro(plano: PlanoId, recurso: RecursoPro): void {
  if (plano === "pro") return;
  throw new ForbiddenException({
    code: "plano_pro_necessario",
    message: MENSAGENS[recurso],
    details: { recurso },
  });
}

/** Cabe mais um item, dado o limite? `null` é sem limite. */
export function cabeMais(limite: number | null, atual: number): boolean {
  return limite === null || atual < limite;
}
