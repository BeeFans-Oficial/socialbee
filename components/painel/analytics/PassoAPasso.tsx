"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, ChevronLeft, ChevronRight, DoorOpen, Eye, LogOut, MousePointer2 } from "lucide-react";

import type { Etapa, ReportEvent } from "@/lib/api/types";
import { SUAVE } from "@/lib/movimento";
import { cn, formatNumber } from "@/lib/utils";
import { MenuDeFiltro, type OpcaoDeFiltro } from "./BarraDeFiltros";
import { ETAPA, NOME_DO_APARELHO, NOME_DO_APP, dataEHora, duracao, nomeDaPlataforma, nomeDoPais, ondeClicou } from "./rotulos";

/**
 * O passo a passo, um visitante por linha.
 *
 * Os passos da mesma pessoa vêm recolhidos numa linha só: quando ela esteve
 * por último, até onde foi, de onde veio e quantos passos deu. Tocar na linha
 * abre o caminho dela, passo a passo, logo abaixo; tocar de novo recolhe.
 * Antes cada passo era uma linha solta, e uma pessoa que abria e fechava a
 * página dez vezes empurrava todas as outras para fora da tela.
 *
 * "A mesma pessoa" é o código da coluna Visitante, que repete nos passos de
 * quem visita no mesmo dia. Ele não identifica ninguém.
 *
 * ## Paginação
 *
 * 20 visitantes por página. A API manda de uma vez os passos mais recentes do
 * recorte (até 1000) e o agrupamento e a troca de página acontecem aqui, sem
 * nova busca. Trocar um filtro volta à primeira página; atualizar os dados
 * não, e quem estava aberto continua aberto. Quando o recorte tem mais passos
 * do que vieram, o cabeçalho diz quantos ficaram de fora.
 *
 * ## Filtro por evento
 *
 * "Até onde foi" recorta a lista pelo ponto em que a pessoa parou: só abriu,
 * viu e não clicou, clicou em qualquer link, ou clicou NAQUELE link (é o que
 * diz quem saiu daqui para o Telegram). Também acontece aqui, sobre os passos
 * que já vieram; por isso as opções são só as que existem no recorte.
 */
const VISITANTES_POR_PAGINA = 20;

/** Quantas linhas entram em cascata; as demais já nascem no lugar. */
const LINHAS_EM_CASCATA = 14;

interface Visitante {
  codigo: string;
  /** Do mais recente ao mais antigo, como a lista chega. */
  passos: ReportEvent[];
}

/** Junta os passos por visitante, mantendo a ordem: vem primeiro quem deu o
 *  passo mais recente. */
function porVisitante(eventos: ReportEvent[]): Visitante[] {
  const grupos = new Map<string, Visitante>();
  for (const evento of eventos) {
    const grupo = grupos.get(evento.visitor);
    if (grupo) grupo.passos.push(evento);
    else grupos.set(evento.visitor, { codigo: evento.visitor, passos: [evento] });
  }
  return [...grupos.values()];
}

/** O valor do filtro para "clicou neste link". */
const NO_LINK = "link:";

/** Até onde a pessoa foi: é o que o passo mais recente dela registra. */
function passaNoFiltro(visitante: Visitante, filtro: string): boolean {
  if (!filtro) return true;
  const { reached, reachedLinks } = visitante.passos[0];
  if (filtro.startsWith(NO_LINK)) return reached === "click" && reachedLinks.includes(filtro.slice(NO_LINK.length));
  return reached === filtro;
}

const ORDEM_DAS_ETAPAS: Etapa[] = ["view", "age", "continue", "arrival"];

/** As opções que existem neste recorte, cada uma com quantas pessoas tem:
 *  qualquer clique, um link por vez (do mais clicado ao menos), e as etapas
 *  em que alguém parou sem clicar. */
function opcoesDeEvento(visitantes: Visitante[], titulo: (linkId: string) => string | undefined): OpcaoDeFiltro[] {
  const porEtapa = new Map<Etapa, number>();
  const porLink = new Map<string, number>();
  for (const { passos } of visitantes) {
    const { reached, reachedLinks } = passos[0];
    porEtapa.set(reached, (porEtapa.get(reached) ?? 0) + 1);
    if (reached === "click") for (const id of reachedLinks) porLink.set(id, (porLink.get(id) ?? 0) + 1);
  }
  const opcoes: OpcaoDeFiltro[] = [];
  const cliques = porEtapa.get("click");
  if (cliques) opcoes.push({ valor: "click", nome: `Clicou em qualquer link (${formatNumber(cliques)})` });
  for (const [id, n] of [...porLink].sort((a, b) => b[1] - a[1])) {
    opcoes.push({ valor: `${NO_LINK}${id}`, nome: `Clicou em ${titulo(id) ?? "link removido"} (${formatNumber(n)})` });
  }
  for (const etapa of ORDEM_DAS_ETAPAS) {
    const n = porEtapa.get(etapa);
    if (n) opcoes.push({ valor: etapa, nome: `${ETAPA[etapa].parou} (${formatNumber(n)})` });
  }
  return opcoes;
}

export function PassoAPasso({
  eventos,
  total,
  recorte,
  titulo,
}: {
  eventos: ReportEvent[];
  total: number;
  /** Muda quando o recorte muda (filtros, janela): a lista volta à página 1. */
  recorte: string;
  titulo: (linkId: string) => string | undefined;
}) {
  const todos = useMemo(() => porVisitante(eventos), [eventos]);
  const [filtro, setFiltro] = useState("");
  const opcoes = useMemo(() => opcoesDeEvento(todos, titulo), [todos, titulo]);
  const visitantes = useMemo(() => todos.filter((v) => passaNoFiltro(v, filtro)), [todos, filtro]);
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const secao = useRef<HTMLElement>(null);

  const paginas = Math.max(1, Math.ceil(visitantes.length / VISITANTES_POR_PAGINA));
  const [pagina, setPagina] = useState(1);
  // Recorte novo, lista nova: a página 7 de antes pode nem existir mais.
  useEffect(() => setPagina(1), [recorte, filtro]);
  const atual = Math.min(pagina, paginas);
  const inicio = (atual - 1) * VISITANTES_POR_PAGINA;
  const daPagina = visitantes.slice(inicio, inicio + VISITANTES_POR_PAGINA);
  const todosAbertos = daPagina.length > 0 && daPagina.every((v) => abertos.has(v.codigo));

  const irPara = (n: number) => {
    setPagina(Math.min(Math.max(n, 1), paginas));
    // Quem trocou de página no rodapé volta ao topo da tabela.
    const topo = secao.current?.getBoundingClientRect().top ?? 0;
    if (topo < 0) secao.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const alternar = (codigo: string) =>
    setAbertos((antes) => {
      const depois = new Set(antes);
      if (!depois.delete(codigo)) depois.add(codigo);
      return depois;
    });

  const alternarTodos = () =>
    setAbertos((antes) => {
      const depois = new Set(antes);
      for (const v of daPagina) {
        if (todosAbertos) depois.delete(v.codigo);
        else depois.add(v.codigo);
      }
      return depois;
    });

  return (
    <section ref={secao} data-tour="passo-a-passo" className="scroll-mt-24 bg-bee-surface rounded-xl p-6 border border-bee-line">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
        <h2 className="text-xl text-white font-semibold">Passo a passo de cada visitante</h2>
        <span className="text-xs text-bee-muted tabular-nums">
          {filtro
            ? `${formatNumber(visitantes.length)} de ${formatNumber(todos.length)} visitantes`
            : `${formatNumber(visitantes.length)} ${visitantes.length === 1 ? "visitante" : "visitantes"}`}{" "}
          ·{" "}
          {total > eventos.length
            ? `os ${formatNumber(eventos.length)} passos mais recentes de ${formatNumber(total)}`
            : `${formatNumber(eventos.length)} ${eventos.length === 1 ? "passo" : "passos"} no recorte`}
        </span>
      </div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <p className="text-xs text-bee-muted max-w-2xl">
          Cada linha é uma pessoa, com até onde ela foi. Toque na linha para abrir o caminho dela,
          passo a passo. O código em Visitante repete para a mesma pessoa no mesmo dia e não
          identifica ninguém: nome, perfil e telefone de quem visita nunca chegam à página.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <MenuDeFiltro
            filtro={{ chave: "evento", rotulo: "Até onde foi", valor: filtro, opcoes }}
            onEscolher={setFiltro}
          />
          <button
            type="button"
            onClick={alternarTodos}
            className="h-9 px-3 rounded-lg border border-bee-line text-xs text-bee-muted transition-colors hover:text-white hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-bee-pink"
          >
            {todosAbertos ? "Recolher todos" : "Abrir todos"}
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead>
            <tr className="border-b border-white/5">
              {["Quando", "Evento", "Origem", "Aparelho", "País", "Rede", "Visitante"].map((coluna) => (
                <th key={coluna} className="text-left text-xs font-medium text-bee-muted pb-3 pr-4 first:pl-2">{coluna}</th>
              ))}
            </tr>
          </thead>
          {/* A chave troca com a página: as linhas novas entram em cascata. */}
          <tbody key={atual}>
            {daPagina.map((visitante, index) => {
              const aberto = abertos.has(visitante.codigo);
              return (
                <React.Fragment key={visitante.codigo}>
                  <LinhaDeVisitante
                    visitante={visitante}
                    titulo={titulo}
                    indice={index}
                    aberto={aberto}
                    onAlternar={() => alternar(visitante.codigo)}
                  />
                  {aberto &&
                    visitante.passos.map((passo, i) => (
                      <LinhaDePasso
                        key={`${passo.at}-${passo.type}-${i}`}
                        evento={passo}
                        titulo={passo.linkId ? titulo(passo.linkId) : undefined}
                        indice={i}
                        ultimo={i === visitante.passos.length - 1}
                      />
                    ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        {visitantes.length === 0 && filtro && (
          <p className="py-8 text-center text-sm text-bee-muted">
            Ninguém neste recorte parou aí.{" "}
            <button type="button" onClick={() => setFiltro("")} className="text-bee-pink hover:underline">
              Ver todos
            </button>
          </p>
        )}
      </div>

      {paginas > 1 && (
        <nav aria-label="Páginas do passo a passo" className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-bee-muted tabular-nums" aria-live="polite">
            {formatNumber(inicio + 1)}–{formatNumber(inicio + daPagina.length)} de {formatNumber(visitantes.length)} visitantes
          </p>
          <div className="flex items-center gap-1">
            <BotaoDePagina rotulo="Página anterior" desligado={atual === 1} onClick={() => irPara(atual - 1)}>
              <ChevronLeft className="w-4 h-4" aria-hidden />
            </BotaoDePagina>
            {janelaDePaginas(atual, paginas).map((n, i) =>
              n === null ? (
                <span key={`salto-${i}`} className="w-6 text-center text-xs text-bee-muted" aria-hidden>…</span>
              ) : (
                <BotaoDePagina key={n} rotulo={`Página ${n}`} ativo={n === atual} onClick={() => irPara(n)}>
                  {n}
                </BotaoDePagina>
              ),
            )}
            <BotaoDePagina rotulo="Próxima página" desligado={atual === paginas} onClick={() => irPara(atual + 1)}>
              <ChevronRight className="w-4 h-4" aria-hidden />
            </BotaoDePagina>
          </div>
        </nav>
      )}
    </section>
  );
}

/** As páginas que o rodapé mostra: a primeira, a última e as vizinhas da
 *  atual; `null` é o salto ("…"). Até sete páginas, todas. */
function janelaDePaginas(atual: number, paginas: number): Array<number | null> {
  if (paginas <= 7) return Array.from({ length: paginas }, (_, i) => i + 1);
  const meio = [atual - 1, atual, atual + 1].filter((n) => n > 1 && n < paginas);
  return [1, ...(meio[0] > 2 ? [null] : []), ...meio, ...(meio[meio.length - 1] < paginas - 1 ? [null] : []), paginas];
}

function BotaoDePagina({
  rotulo,
  ativo,
  desligado,
  onClick,
  children,
}: {
  rotulo: string;
  ativo?: boolean;
  desligado?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desligado}
      aria-label={rotulo}
      aria-current={ativo ? "page" : undefined}
      className={cn(
        "min-w-9 h-9 px-2 rounded-lg text-sm tabular-nums flex items-center justify-center transition-colors active:scale-95",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-bee-pink disabled:opacity-30 disabled:pointer-events-none",
        ativo ? "bg-bee-pink text-white font-semibold" : "text-bee-muted hover:text-white hover:bg-white/[0.06]",
      )}
    >
      {children}
    </button>
  );
}

function Origem({ evento }: { evento: ReportEvent }) {
  const campanha = [evento.medium, evento.campaign].filter(Boolean).join(" · ");
  return (
    <>
      <div className="text-sm text-white truncate max-w-[160px]" title={evento.source}>{evento.source}</div>
      {campanha && <div className="mt-0.5 text-xs text-bee-muted truncate max-w-[160px]" title={campanha}>{campanha}</div>}
      {evento.clickIds.length > 0 && (
        <div className="mt-0.5 text-xs text-bee-muted truncate max-w-[160px]" title="Identificador de anúncio presente no link">
          {evento.clickIds.join(", ")}
        </div>
      )}
    </>
  );
}

/** O resumo de uma pessoa: a linha que se toca para abrir o caminho dela. */
function LinhaDeVisitante({
  visitante,
  titulo,
  indice,
  aberto,
  onAlternar,
}: {
  visitante: Visitante;
  titulo: (linkId: string) => string | undefined;
  indice: number;
  aberto: boolean;
  onAlternar: () => void;
}) {
  const { passos } = visitante;
  const recente = passos[0];
  // De onde veio é o que o primeiro passo diz; os seguintes herdam ou perdem.
  const primeiro = passos[passos.length - 1];
  const clicou = recente.reached === "click";
  const ateOnde = clicou
    ? ondeClicou(recente.reachedLinks, (id) => titulo(id) ?? "link removido")
    : ETAPA[recente.reached].parou;
  const tempo = new Date(recente.at).getTime() - new Date(primeiro.at).getTime();
  const aparelho = [NOME_DO_APARELHO[recente.device] ?? recente.device, recente.os, recente.browser].filter(Boolean).join(" · ");
  const emCascata = indice < LINHAS_EM_CASCATA;
  return (
    <motion.tr
      initial={emCascata ? { y: 8 } : false}
      whileInView={{ y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.24, ease: SUAVE, delay: emCascata ? indice * 0.02 : 0 }}
      onClick={onAlternar}
      className={cn(
        "cursor-pointer border-b border-white/5 align-top transition-colors duration-150 hover:bg-white/[0.04]",
        aberto ? "bg-bee-pink/[0.07]" : indice % 2 === 1 && "bg-white/[0.02]",
      )}
    >
      <td className={cn("py-3 pr-4 pl-1 whitespace-nowrap border-l-2 transition-colors duration-150", aberto ? "border-bee-pink" : "border-transparent")}>
        {/* O clique sobe para a linha; o botão existe para o teclado e para
            o leitor de tela saberem que isto abre e fecha. */}
        <button
          type="button"
          aria-expanded={aberto}
          aria-label={`${aberto ? "Recolher" : "Abrir"} os ${passos.length} passos do visitante ${visitante.codigo}`}
          className="flex items-center gap-1.5 rounded text-sm text-white/80 tabular-nums focus-visible:outline focus-visible:outline-2 focus-visible:outline-bee-pink"
        >
          <ChevronRight className={cn("w-4 h-4 text-bee-muted transition-transform duration-200", aberto && "rotate-90 text-bee-pink")} aria-hidden />
          {dataEHora(recente.at)}
        </button>
      </td>
      <td className="py-3 pr-4">
        <div className={cn("text-sm font-medium truncate max-w-[220px]", clicou ? "text-bee-pink" : "text-white")} title={ateOnde}>
          {ateOnde}
        </div>
        <div className="mt-0.5 text-xs text-bee-muted tabular-nums">
          {passos.length} {passos.length === 1 ? "passo" : "passos"}
          {tempo >= 1000 && ` em ${duracao(tempo)}`}
        </div>
      </td>
      <td className="py-3 pr-4"><Origem evento={primeiro} /></td>
      <td className="py-3 pr-4">
        <div className="text-sm text-white/80 whitespace-nowrap">{aparelho}</div>
        {recente.inApp && (
          <div className="mt-0.5 text-xs text-bee-pink/90">dentro do {NOME_DO_APP[recente.inApp] ?? recente.inApp}</div>
        )}
      </td>
      <td className="py-3 pr-4 text-sm text-white/80 whitespace-nowrap">{recente.country ? nomeDoPais(recente.country) : "—"}</td>
      <td className="py-3 pr-4 text-xs text-bee-muted font-mono whitespace-nowrap">{recente.network ?? "—"}</td>
      <td className="py-3 pr-2 text-xs text-bee-muted font-mono whitespace-nowrap">{visitante.codigo}</td>
    </motion.tr>
  );
}

/** Um passo do caminho de uma pessoa, dentro da linha aberta dela. Aparelho,
 *  país e rede já estão no resumo: aqui ficam só a hora, o que ela fez e de
 *  onde veio naquele passo. */
function LinhaDePasso({ evento, titulo, indice, ultimo }: { evento: ReportEvent; titulo?: string; indice: number; ultimo: boolean }) {
  const destino = [nomeDaPlataforma(evento.channel), evento.destinationHost].filter(Boolean).join(" · ");
  const clique = evento.type === "click";
  const saida = evento.type === "leave";
  const Icone = clique ? MousePointer2 : saida ? LogOut : evento.type === "view" ? Eye : evento.type === "arrival" ? DoorOpen : ArrowUpRight;
  return (
    <motion.tr
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: SUAVE, delay: Math.min(indice, 12) * 0.02 }}
      className={cn("align-top bg-bee-pink/[0.03]", ultimo && "border-b border-white/5")}
    >
      <td className="py-2 pr-4 pl-7 text-xs text-bee-muted whitespace-nowrap tabular-nums border-l-2 border-bee-pink/40">
        {dataEHora(evento.at)}
      </td>
      <td className="py-2 pr-4">
        <div className="flex items-center gap-2 text-sm text-white/90">
          <Icone className={cn("w-3.5 h-3.5 flex-shrink-0", clique ? "text-bee-pink" : "text-white/40")} aria-hidden />
          <span className="truncate max-w-[200px]">{clique ? (titulo ?? "Link removido") : saida ? "Saiu da página" : ETAPA[evento.type as Etapa].fez}</span>
        </div>
        {clique && destino && (
          <div className="mt-0.5 pl-[22px] text-xs text-bee-muted truncate max-w-[220px]">{destino}</div>
        )}
      </td>
      <td className="py-2 pr-4 opacity-80"><Origem evento={evento} /></td>
      <td colSpan={4} />
    </motion.tr>
  );
}
