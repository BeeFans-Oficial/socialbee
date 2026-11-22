"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, ExternalLink, Loader2, Pencil, Plus, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useUltimo } from "@/components/painel/ConfirmarExclusao";
import { EsqueletoDeCartoes } from "@/components/painel/Esqueleto";
import { CabecalhoDeTela, Tela } from "@/components/painel/Tela";
import { SeloPro, avisarPro } from "@/components/shared/SeloPro";
import { api, ApiError, definirPaginaAtiva, paginaAtiva } from "@/lib/api/client";
import { invalidateSession, usePlano } from "@/lib/api/use-session";
import type { ApiOwner, ApiProfile } from "@/lib/api/types";
import { CARTAO_DA_GRADE, DURACAO, LISTA, MOLA, SAIDA, SUAVE } from "@/lib/movimento";
import { Pastilha, acaoDaChecagem, resumoDaChecagem, useUltimaChecagem } from "@/components/painel/saude/Pecas";
import { urlDaPagina } from "@/lib/site";
import { TEMPLATE_DO_FREE, resolverVisual } from "@/lib/templates";
import { cn, slugify, validateSlug } from "@/lib/utils";

/**
 * Páginas: todas as páginas da conta, em cartões.
 *
 * É a porta de entrada do painel. Cada cartão mostra uma miniatura com as
 * cores da página, o endereço completo e as ações. Clicar entra na área da
 * página: links, aparência, saúde e analytics, em abas (`AbasDaPagina`).
 */
export default function PaginasPage() {
  const router = useRouter();
  const { plano, ehPro } = usePlano();
  const [paginas, setPaginas] = useState<ApiProfile[] | null>(null);
  /** Donos de página da conta. Vazio é o normal de quem cuida só das
   *  próprias páginas: aí a tela é a grade simples, sem agrupamento. */
  const [donos, setDonos] = useState<ApiOwner[]>([]);
  /** De quem a lista mostra as páginas: "todos", "sem" (sem dono) ou o id. */
  const [filtro, setFiltroCru] = useState<string>(FILTRO_TODOS);
  const [criandoDono, setCriandoDono] = useState(false);
  const [apagandoDono, setApagandoDono] = useState<ApiOwner | null>(null);
  const [criando, setCriando] = useState(false);
  const [apagando, setApagando] = useState<ApiProfile | null>(null);

  // `/paginas?nova=1` abre direto a criação — é o que o seletor da barra do
  // topo manda. Lido de `window.location` para a tela continuar estática.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("nova") === "1") setCriando(true);
  }, []);

  useEffect(() => {
    // Os donos vêm junto, mas a tela não depende deles: se a lista de donos
    // falhar, as páginas aparecem sem agrupamento.
    api
      .owners()
      .then((lista) => {
        setDonos(lista);
        const guardado = lerFiltro();
        if (guardado === FILTRO_SEM || lista.some((d) => d.id === guardado)) setFiltroCru(guardado);
      })
      .catch(() => setDonos([]));
    api
      .profiles()
      .then(setPaginas)
      .catch((caught) => {
        if (caught instanceof ApiError && caught.isUnauthorized) {
          router.replace("/login?de=/paginas");
          return;
        }
        toast.error("Não foi possível carregar seus perfis.");
        setPaginas([]);
      });
  }, [router]);

  const limite = plano?.limits.paginas ?? null;
  const total = paginas?.length ?? 0;
  const noLimite = limite !== null && total >= limite;

  const setFiltro = (valor: string) => {
    setFiltroCru(valor);
    guardarFiltro(valor);
  };

  /**
   * As páginas repartidas por dono. Sem dono nenhum na conta, um grupo só e
   * sem título. A contagem sai das páginas em memória, e não do número que a
   * API mandou com os donos: mover uma página atualiza os dois lados na hora.
   */
  const grupos = useMemo<Grupo[]>(() => {
    if (!paginas) return [];
    if (donos.length === 0) return [{ chave: FILTRO_TODOS, dono: null, paginas }];
    const conhecidos = new Set(donos.map((d) => d.id));
    const todos: Grupo[] = donos.map((dono) => ({
      chave: dono.id,
      dono,
      paginas: paginas.filter((p) => p.ownerId === dono.id),
    }));
    const semDono = paginas.filter((p) => !p.ownerId || !conhecidos.has(p.ownerId));
    if (semDono.length > 0) todos.push({ chave: FILTRO_SEM, dono: null, paginas: semDono });
    return todos;
  }, [paginas, donos]);
  const gruposVisiveis = filtro === FILTRO_TODOS ? grupos : grupos.filter((g) => g.chave === filtro);
  // O filtro guardado pode apontar para um grupo que não existe mais.
  const filtroValido = filtro === FILTRO_TODOS || grupos.some((g) => g.chave === filtro);
  const aMostrar = filtroValido ? gruposVisiveis : grupos;

  const criarDono = async (nome: string): Promise<boolean> => {
    try {
      const novo = await api.createOwner(nome);
      setDonos((atual) => [...atual, novo].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")));
      setFiltro(novo.id);
      toast.success("Dono criado. Mova os perfis dele para cá.");
      return true;
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "Não foi possível criar o dono.");
      return false;
    }
  };

  const renomearDono = async (dono: ApiOwner, nome: string): Promise<boolean> => {
    try {
      const salvo = await api.renameOwner(dono.id, nome);
      setDonos((atual) =>
        atual.map((d) => (d.id === salvo.id ? salvo : d)).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
      );
      return true;
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "Não foi possível renomear.");
      return false;
    }
  };

  const mudarDono = async (pagina: ApiProfile, ownerId: string | null) => {
    try {
      const salva = await api.setProfileOwner(pagina.id, ownerId);
      setPaginas((atual) => atual?.map((p) => (p.id === salva.id ? salva : p)) ?? null);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "Não foi possível mudar o dono.");
    }
  };

  // Abrir uma página é entrar na área dela: ela vira a ativa do painel e a
  // primeira aba são os links. As outras abas (aparência, saúde, analytics)
  // ficam na faixa que aparece dali em diante (`AbasDaPagina`).
  const abrir = (pagina: ApiProfile) => {
    definirPaginaAtiva(pagina.id);
    invalidateSession();
    router.push("/links");
  };
  // Página recém-criada começa pela aparência: ainda não há o que listar.
  const editar = (pagina: ApiProfile) => {
    definirPaginaAtiva(pagina.id);
    invalidateSession();
    router.push(`/paginas/${pagina.id}`);
  };

  // O nome se muda AQUI, no cartão, e não no editor de aparência: é a lista
  // que quem administra várias páginas usa para se achar. O pedido leva o id
  // da página do cartão, sem trocar a ativa do painel.
  const renomear = async (pagina: ApiProfile, nome: string): Promise<boolean> => {
    try {
      const salva = await api.renameProfile(pagina.id, nome);
      setPaginas((atual) => atual?.map((p) => (p.id === salva.id ? salva : p)) ?? null);
      // A sessão guarda o nome da página ativa (faixa de abas, seletor).
      invalidateSession();
      toast.success("Nome atualizado.");
      return true;
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "Não foi possível renomear.");
      return false;
    }
  };

  const copiar = async (pagina: ApiProfile) => {
    try {
      await navigator.clipboard.writeText(urlDaPagina(pagina.host, pagina.slug));
      toast.success("Link copiado.");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  return (
    <Tela>
      <CabecalhoDeTela
        titulo="Perfis"
        descricao={
          paginas === null
            ? "Carregando…"
            : limite === null
              ? `${total} ${total === 1 ? "perfil" : "perfis"}`
              : `${total} de ${limite} ${limite === 1 ? "perfil" : "perfis"}`
        }
        acoes={
          <button
            data-tour="nova-pagina"
            onClick={() => (noLimite ? avisarPro("Mais de um perfil") : setCriando(true))}
            className="flex items-center gap-2 h-10 px-4 rounded-lg bg-bee-pink hover:bg-bee-pink-hot text-white text-sm font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo perfil
            {noLimite && <SeloPro className="bg-white/20 text-white border-white/30" />}
          </button>
        }
      />

      {paginas !== null && paginas.length > 0 && (
        <FiltroDeDonos
          grupos={grupos}
          total={paginas.length}
          temDonos={donos.length > 0}
          filtro={filtroValido ? filtro : FILTRO_TODOS}
          onEscolher={setFiltro}
          onNovo={() => setCriandoDono(true)}
        />
      )}

      {paginas === null ? (
        <EsqueletoDeCartoes />
      ) : paginas.length === 0 ? (
        <SemPaginas onCriar={() => setCriando(true)} />
      ) : (
        <div className="space-y-10">
          {/* Trocar de dono: o grupo que sai some rápido, o que fica sobe para
              o lugar (`layout`) e o que entra chega de baixo. Saída mais
              curta que a entrada, como no resto do painel. */}
          <AnimatePresence mode="popLayout" initial={false}>
          {aMostrar.map((grupo, g) => (
            <motion.section
              key={grupo.chave}
              layout="position"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0, transition: { duration: DURACAO.lenta, ease: SUAVE } }}
              exit={{ opacity: 0, transition: { duration: DURACAO.rapida, ease: SAIDA } }}
              aria-label={grupo.dono?.name ?? "Perfis"}
            >
              {donos.length > 0 && (
                <div className="mb-4 flex items-center gap-2 min-w-0">
                  <UserRound className="w-4 h-4 flex-shrink-0 text-white/40" />
                  {grupo.dono ? (
                    <NomeDaPagina
                      nome={grupo.dono.name}
                      oQue="dono"
                      onRenomear={(nome) => renomearDono(grupo.dono!, nome)}
                    />
                  ) : (
                    <span className="text-[15px] font-medium text-white/70">Sem dono</span>
                  )}
                  <span className="text-sm text-bee-muted flex-shrink-0">
                    · {grupo.paginas.length} {grupo.paginas.length === 1 ? "perfil" : "perfis"}
                  </span>
                  {grupo.dono && (
                    <button
                      onClick={() => setApagandoDono(grupo.dono)}
                      title="Apagar o dono (os perfis ficam)"
                      aria-label={`Apagar o dono ${grupo.dono.name}`}
                      className="ml-auto w-8 h-8 flex-shrink-0 rounded-md flex items-center justify-center text-white/35 hover:text-red-400 hover:bg-white/[0.06] transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
              {grupo.paginas.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-white/10 px-5 py-8 text-center text-sm text-bee-muted">
                  Nenhum perfil deste dono ainda. Crie um em “Novo perfil” ou mova um existente pelo campo
                  “Dono” do cartão.
                </p>
              ) : (
                <motion.div variants={LISTA} initial="initial" animate="animate" className="grid gap-5 md:grid-cols-2">
                  {grupo.paginas.map((pagina, i) => (
                    <motion.div
                      key={pagina.id}
                      variants={CARTAO_DA_GRADE}
                      data-tour={g === 0 && i === 0 ? "cartao-da-pagina" : undefined}
                    >
                      <CartaoDePagina
                        pagina={pagina}
                        donos={donos}
                        primeiro={g === 0 && i === 0}
                        onAbrir={() => abrir(pagina)}
                        onRenomear={(nome) => renomear(pagina, nome)}
                        onMudarDono={(ownerId) => void mudarDono(pagina, ownerId)}
                        onCopiar={() => copiar(pagina)}
                        onApagar={() => setApagando(pagina)}
                      />
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </motion.section>
          ))}
          </AnimatePresence>
        </div>
      )}

      <NovoDono aberto={criandoDono} onFechar={() => setCriandoDono(false)} onCriar={criarDono} />
      <ApagarDono
        dono={apagandoDono}
        onFechar={() => setApagandoDono(null)}
        onApagar={async (dono) => {
          try {
            await api.deleteOwner(dono.id);
            setDonos((atual) => atual.filter((d) => d.id !== dono.id));
            // As páginas dele continuam: passam para "Sem dono".
            setPaginas((atual) => atual?.map((p) => (p.ownerId === dono.id ? { ...p, ownerId: null } : p)) ?? null);
            if (filtro === dono.id) setFiltro(FILTRO_TODOS);
            toast.success("Dono apagado. Os perfis dele continuam, sem dono.");
            return true;
          } catch (caught) {
            toast.error(caught instanceof ApiError ? caught.message : "Não foi possível apagar o dono.");
            return false;
          }
        }}
      />
      <NovaPagina
        aberto={criando}
        ehPro={ehPro}
        donos={donos}
        // Quem está vendo as páginas de um dono quase sempre cria para ele.
        donoInicial={donos.some((d) => d.id === filtro) ? filtro : null}
        onFechar={() => setCriando(false)}
        onCriada={(nova) => {
          // A sessão pode ter nascido sem página (conta aberta pelo admin):
          // a partir daqui ela existe, e o cabeçalho tem que saber.
          invalidateSession();
          editar(nova);
        }}
      />
      <ApagarPagina
        pagina={apagando}
        onFechar={() => setApagando(null)}
        onApagada={(id) => {
          setPaginas((atual) => atual?.filter((p) => p.id !== id) ?? null);
          // Apagou a ativa: volta para a da sessão, senão o painel inteiro
          // passaria a mandar o id de uma página que não existe mais.
          if (id === paginaAtiva()) {
            definirPaginaAtiva(null);
            invalidateSession();
          }
        }}
      />
    </Tela>
  );
}

function CartaoDePagina({
  pagina,
  donos,
  primeiro,
  onAbrir,
  onRenomear,
  onMudarDono,
  onCopiar,
  onApagar,
}: {
  pagina: ApiProfile;
  /** Donos da conta. Vazio = a conta não usa donos, e o campo não aparece. */
  donos: ApiOwner[];
  /** O primeiro cartão da tela carrega os alvos do guia (`data-tour`). */
  primeiro: boolean;
  onAbrir: () => void;
  onRenomear: (nome: string) => Promise<boolean>;
  onMudarDono: (ownerId: string | null) => void;
  onCopiar: () => void;
  onApagar: () => void;
}) {
  const { revisao } = useUltimaChecagem(pagina.id);
  const [avisado, setAvisado] = useState(false);
  // A miniatura usa as mesmas regras de cor da página pública.
  const visual = useMemo(
    () =>
      resolverVisual({
        templateId: pagina.template?.templateId,
        themeId: pagina.themeId,
        buttonStyle: pagina.buttonStyle,
        bgColor: pagina.template?.bgColor,
        accentColor: pagina.template?.accentColor,
        fontId: pagina.template?.fontId,
      }),
    [pagina],
  );

  return (
    <div
      className={cn(
        "h-full rounded-2xl border overflow-hidden bg-bee-surface transition-[border-color,transform,box-shadow] duration-200 ease-[cubic-bezier(0.2,0,0,1)]",
        "hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(0,0,0,0.35)]",
        "border-white/[0.08] hover:border-white/20",
      )}
    >
      {/* Miniatura */}
      <button
        onClick={onAbrir}
        className="relative block w-full h-44 px-8 pt-8 text-center"
        style={{ background: visual.bg }}
        aria-label={`Abrir ${pagina.displayName}`}
      >
        <div className="text-sm font-semibold text-white truncate">{pagina.displayName}</div>
        <div className="mt-5 space-y-2.5">
          {[0.55, 0.35, 0.22].map((opacidade) => (
            <div
              key={opacidade}
              className="h-6 rounded-md"
              style={{ background: visual.accent, opacity: opacidade }}
            />
          ))}
        </div>
      </button>

      {/* Dados e ações */}
      <div className="p-5">
        <NomeDaPagina
          nome={pagina.displayName}
          dataTour={primeiro ? "renomear-perfil" : undefined}
          onRenomear={onRenomear}
        />
        <div className="mt-2.5 flex items-center gap-2 min-w-0">
          <span className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-bee-bg/60 font-mono text-xs text-white/85 flex-shrink-0">
            <span
              className={cn(
                "w-1.5 h-1.5 rounded-full",
                pagina.published ? "bg-emerald-400" : "bg-white/30",
              )}
              title={pagina.published ? "No ar" : "Fora do ar"}
            />
            {pagina.host}
          </span>
          <span className="font-mono text-xs text-bee-muted truncate">/{pagina.slug}</span>
        </div>

        {/* De quem é a página. Só para a conta que usa donos. */}
        {donos.length > 0 && (
          <label
            data-tour={primeiro ? "dono-no-cartao" : undefined}
            className="mt-3 flex items-center gap-2 min-w-0 text-xs text-bee-muted"
          >
            <UserRound className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="flex-shrink-0">Dono</span>
            <select
              value={pagina.ownerId && donos.some((d) => d.id === pagina.ownerId) ? pagina.ownerId : ""}
              onChange={(e) => onMudarDono(e.target.value || null)}
              aria-label={`Dono de ${pagina.displayName}`}
              className="min-w-0 flex-1 h-8 px-2 rounded-md border border-white/10 bg-bee-bg/60 text-xs text-white/85 focus:outline-none focus:border-bee-pink/50 cursor-pointer"
            >
              <option value="">Sem dono</option>
              {donos.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {/* A saúde, em palavras: o que a checagem viu e o que corrigir. */}
        <div className="mt-3 flex flex-wrap items-center gap-2 min-w-0">
          <Pastilha profileId={pagina.id} revisao={revisao} />
          {revisao && revisao.veredito !== "verde" && (
            <p className="basis-full text-xs text-white/70 leading-relaxed">
              {resumoDaChecagem(revisao)}
              {acaoDaChecagem(revisao) && <span className={cn("block mt-0.5", revisao.veredito === "vermelho" ? "text-red-300" : "text-amber-300")}>{acaoDaChecagem(revisao)}</span>}
            </p>
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-white/[0.06] flex items-center gap-2">
          <button
            onClick={() => {
              // Saúde vermelha: o primeiro clique avisa, o segundo copia.
              if (revisao?.veredito === "vermelho" && !avisado) {
                setAvisado(true);
                toast.warning("A saúde deste perfil está vermelha. Clique de novo para copiar mesmo assim.");
                return;
              }
              onCopiar();
            }}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-full border text-sm transition-colors",
              revisao?.veredito === "vermelho" ? "border-red-400/40 text-red-300 hover:border-red-400/70" : "border-white/15 text-white/85 hover:border-white/30",
            )}
          >
            <Copy className="w-3.5 h-3.5" />
            {revisao?.veredito === "vermelho" && avisado ? "Copiar mesmo assim" : "Copiar link"}
          </button>
          <button
            onClick={onAbrir}
            className="px-5 py-2 rounded-full bg-white text-bee-bg text-sm font-semibold hover:bg-white/90 transition-colors"
          >
            Abrir
          </button>
          <div className="ml-auto flex items-center gap-2">
            <a
              href={urlDaPagina(pagina.host, pagina.slug)}
              target="_blank"
              rel="noreferrer"
              title="Abrir o perfil numa aba nova"
              className="w-9 h-9 rounded-full border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:border-white/30 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
            <button
              onClick={onApagar}
              title="Apagar o perfil"
              className="w-9 h-9 rounded-full border border-white/10 flex items-center justify-center text-white/60 hover:text-red-400 hover:border-red-400/40 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * O nome da página no cartão, editável no lugar: o lápis troca o texto por um
 * campo. Enter ou sair do campo salva; Esc desiste. Nome vazio ou igual ao
 * atual não salva nada.
 */
function NomeDaPagina({
  nome,
  oQue = "perfil",
  dataTour,
  onRenomear,
}: {
  /** Alvo do guia (`data-tour`) no lápis. */
  dataTour?: string;
  nome: string;
  /** O que está sendo renomeado: o mesmo campo serve ao nome do dono. */
  oQue?: "perfil" | "dono";
  onRenomear: (nome: string) => Promise<boolean>;
}) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(nome);
  const [salvando, setSalvando] = useState(false);
  const desistiu = useRef(false);

  const concluir = async () => {
    if (desistiu.current) {
      desistiu.current = false;
      return;
    }
    const novo = valor.trim();
    if (!novo || novo === nome) {
      setEditando(false);
      return;
    }
    setSalvando(true);
    const ok = await onRenomear(novo);
    setSalvando(false);
    if (ok) setEditando(false);
  };

  if (!editando) {
    return (
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-[15px] font-medium text-white truncate">{nome}</span>
        <button
          onClick={() => {
            setValor(nome);
            setEditando(true);
          }}
          data-tour={dataTour}
          title={oQue === "dono" ? "Renomear o dono" : "Renomear o perfil"}
          aria-label={`Renomear ${nome}`}
          className="w-7 h-7 flex-shrink-0 rounded-md flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <form
      className="flex items-center gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        void concluir();
      }}
    >
      <input
        autoFocus
        value={valor}
        maxLength={60}
        disabled={salvando}
        aria-label={oQue === "dono" ? "Nome do dono" : "Nome do perfil"}
        onChange={(e) => setValor(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={() => void concluir()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            desistiu.current = true;
            setEditando(false);
          }
        }}
        className="min-w-0 flex-1 h-8 px-2 -ml-2 rounded-md border border-white/20 bg-bee-bg/60 text-[15px] font-medium text-white focus:outline-none focus:border-bee-pink/60"
      />
      {/* `onMouseDown` sem tirar o foco: o blur do campo já salva, e os dois
          juntos salvariam duas vezes. */}
      <button
        type="submit"
        disabled={salvando}
        onMouseDown={(e) => e.preventDefault()}
        title="Salvar"
        aria-label="Salvar o nome"
        className="w-7 h-7 flex-shrink-0 rounded-md flex items-center justify-center text-white/70 hover:text-white hover:bg-white/[0.06] transition-colors"
      >
        {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
      </button>
    </form>
  );
}

// ── Donos ─────────────────────────────────────────────────────────────────────

const FILTRO_TODOS = "todos";
const FILTRO_SEM = "sem";
const CHAVE_DO_FILTRO = "bs_filtro_de_dono";

interface Grupo {
  /** O id do dono, `FILTRO_SEM` ou, na conta sem donos, `FILTRO_TODOS`. */
  chave: string;
  dono: ApiOwner | null;
  paginas: ApiProfile[];
}

/** O filtro é preferência de quem está na frente do navegador, como a página
 *  ativa: fica no `localStorage`, e some sem drama se ele estiver bloqueado. */
function lerFiltro(): string {
  try {
    return window.localStorage.getItem(CHAVE_DO_FILTRO) ?? FILTRO_TODOS;
  } catch {
    return FILTRO_TODOS;
  }
}

function guardarFiltro(valor: string): void {
  try {
    window.localStorage.setItem(CHAVE_DO_FILTRO, valor);
  } catch {
    /* idem */
  }
}

/**
 * De quem ver as páginas: "Todos", um botão por dono e "Sem dono", cada um
 * com a contagem, e "Novo dono" no fim. A fileira rola de lado no celular.
 *
 * Na conta que ainda não tem dono nenhum, sobra só o convite para criar o
 * primeiro — discreto, porque quem cuida das próprias páginas não precisa.
 */
function FiltroDeDonos({
  grupos,
  total,
  temDonos,
  filtro,
  onEscolher,
  onNovo,
}: {
  grupos: Grupo[];
  total: number;
  temDonos: boolean;
  filtro: string;
  onEscolher: (chave: string) => void;
  onNovo: () => void;
}) {
  const novo = (
    <button
      onClick={onNovo}
      data-tour="novo-dono"
      className="self-start flex items-center gap-1.5 h-9 px-3 rounded-full border border-dashed border-white/15 text-sm text-white/60 hover:text-white hover:border-white/30 transition-colors flex-shrink-0"
    >
      <Plus className="w-3.5 h-3.5" />
      Novo dono
    </button>
  );

  if (!temDonos) {
    return (
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 text-sm text-bee-muted">
        {novo}
        <span>Administra perfis de várias pessoas? Crie um dono para cada uma e veja os perfis dela separados.</span>
      </div>
    );
  }

  const opcoes = [
    { chave: FILTRO_TODOS, rotulo: "Todos", quantas: total },
    ...grupos.map((g) => ({ chave: g.chave, rotulo: g.dono?.name ?? "Sem dono", quantas: g.paginas.length })),
  ];

  return (
    <div
      role="tablist"
      aria-label="Ver os perfis de qual dono"
      data-tour="filtro-de-donos"
      className="mb-6 -mx-4 px-4 sm:mx-0 sm:px-0 flex items-center gap-2 overflow-x-auto sem-barra"
    >
      {opcoes.map((o) => {
        const ativo = o.chave === filtro;
        return (
          <button
            key={o.chave}
            role="tab"
            aria-selected={ativo}
            onClick={() => onEscolher(o.chave)}
            className={cn(
              "relative flex items-center gap-2 h-9 px-3.5 rounded-full border text-sm whitespace-nowrap transition-colors duration-200 flex-shrink-0",
              ativo ? "border-transparent text-white" : "border-white/10 text-white/65 hover:text-white hover:border-white/25",
            )}
          >
            {/* O fundo do filtro ativo DESLIZA de um dono para o outro, como o
                item ativo da barra lateral: o olho acompanha a troca. */}
            {ativo && (
              <motion.span
                layoutId="filtro-de-dono-ativo"
                transition={MOLA}
                className="absolute inset-0 rounded-full border border-bee-pink/60 bg-bee-pink/[0.1]"
                aria-hidden
              />
            )}
            <span className="relative">{o.rotulo}</span>
            <span className={cn("relative text-xs tabular-nums", ativo ? "text-white/70" : "text-white/35")}>{o.quantas}</span>
          </button>
        );
      })}
      {novo}
    </div>
  );
}

function NovoDono({
  aberto,
  onFechar,
  onCriar,
}: {
  aberto: boolean;
  onFechar: () => void;
  onCriar: (nome: string) => Promise<boolean>;
}) {
  const [nome, setNome] = useState("");
  const [salvando, setSalvando] = useState(false);
  useEffect(() => {
    if (aberto) setNome("");
  }, [aberto]);

  const criar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;
    setSalvando(true);
    const ok = await onCriar(nome.trim());
    setSalvando(false);
    if (ok) onFechar();
  };

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="bg-bee-surface border-white/10 max-w-md">
        <DialogTitle className="text-white">Novo dono</DialogTitle>
        <p className="text-sm text-bee-muted leading-relaxed">
          O dono reúne os perfis de uma mesma pessoa nesta lista. É só organização: ele não ganha acesso
          ao painel e o nome não aparece para ninguém de fora.
        </p>
        <form onSubmit={criar} className="space-y-3 mt-1">
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome do dono"
            maxLength={60}
            autoFocus
            className="w-full h-11 px-3 rounded-lg bg-bee-bg border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-bee-pink/50"
          />
          <button
            type="submit"
            disabled={salvando || !nome.trim()}
            className="w-full h-11 rounded-lg bg-bee-pink hover:bg-bee-pink-hot text-white text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
            Criar dono
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Apagar um dono não apaga página: por isso basta confirmar, sem digitar. */
function ApagarDono({
  dono,
  onFechar,
  onApagar,
}: {
  dono: ApiOwner | null;
  onFechar: () => void;
  onApagar: (dono: ApiOwner) => Promise<boolean>;
}) {
  const [apagando, setApagando] = useState(false);
  const mostrado = useUltimo(dono);

  return (
    <Dialog open={dono !== null} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="bg-bee-surface border-white/10 max-w-md">
        <DialogTitle className="text-white">Apagar o dono {mostrado?.name}?</DialogTitle>
        <p className="text-sm text-bee-muted leading-relaxed">
          Os perfis dele <span className="text-white">não são apagados</span>: continuam no ar, com os
          links e os relatórios, e passam para “Sem dono”.
        </p>
        <div className="mt-2 flex justify-end gap-2">
          <button
            onClick={onFechar}
            className="h-10 px-4 rounded-lg border border-white/15 text-sm text-white/80 hover:border-white/30 transition-colors"
          >
            Cancelar
          </button>
          <button
            disabled={apagando}
            onClick={async () => {
              if (!dono) return;
              setApagando(true);
              const ok = await onApagar(dono);
              setApagando(false);
              if (ok) onFechar();
            }}
            className="h-10 px-4 rounded-lg bg-red-500/90 hover:bg-red-500 text-white text-sm font-semibold transition-colors disabled:opacity-60 flex items-center gap-2"
          >
            {apagando && <Loader2 className="w-4 h-4 animate-spin" />}
            Apagar dono
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NovaPagina({
  aberto,
  ehPro,
  donos,
  donoInicial,
  onFechar,
  onCriada,
}: {
  aberto: boolean;
  ehPro: boolean;
  donos: ApiOwner[];
  donoInicial: string | null;
  onFechar: () => void;
  onCriada: (pagina: ApiProfile) => void;
}) {
  const [nome, setNome] = useState("");
  const [slug, setSlug] = useState("");
  const [dono, setDono] = useState("");
  // Ao abrir, o dono vem do filtro da lista.
  useEffect(() => {
    if (aberto) setDono(donoInicial ?? "");
  }, [aberto, donoInicial]);
  const [salvando, setSalvando] = useState(false);

  const criar = async (e: React.FormEvent) => {
    e.preventDefault();
    const limpo = slug.trim() || slugify(nome);
    if (!nome.trim() || !validateSlug(limpo)) {
      toast.error("Dê um nome e um endereço de 3 a 30 letras, números ou hífen.");
      return;
    }
    setSalvando(true);
    try {
      onCriada(
        await api.createProfile({
          displayName: nome.trim(),
          slug: limpo,
          // O Free só tem o Clássico; o modelo se troca depois, no editor.
          templateId: TEMPLATE_DO_FREE,
          ...(dono ? { ownerId: dono } : {}),
        }),
      );
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "Não foi possível criar o perfil.");
      setSalvando(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="bg-bee-surface border-white/10 max-w-md">
        <DialogTitle className="text-white">Novo perfil</DialogTitle>
        <form onSubmit={criar} className="space-y-3 mt-2">
          <input
            value={nome}
            onChange={(e) => {
              setNome(e.target.value);
              // O endereço acompanha o nome até a criadora mexer nele.
              if (!slug || slug === slugify(nome)) setSlug(slugify(e.target.value));
            }}
            placeholder="Nome do perfil"
            autoFocus
            className="w-full h-11 px-3 rounded-lg bg-bee-bg border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-bee-pink/50"
          />
          {/* Sem domínio na frente: a página nova recebe um domínio sorteado. */}
          <label className="flex items-center gap-1 h-11 px-3 rounded-lg bg-bee-bg border border-white/10 focus-within:border-bee-pink/50">
            <span className="text-sm text-white/35">/</span>
            <input
              value={slug}
              onChange={(e) => setSlug(slugify(e.target.value))}
              placeholder="endereco"
              className="flex-1 min-w-0 bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none"
            />
          </label>
          {donos.length > 0 && (
            <label className="flex items-center gap-2 h-11 px-3 rounded-lg bg-bee-bg border border-white/10 focus-within:border-bee-pink/50">
              <span className="text-sm text-white/35 flex-shrink-0">Dono</span>
              <select
                value={dono}
                onChange={(e) => setDono(e.target.value)}
                className="flex-1 min-w-0 bg-transparent text-sm text-white focus:outline-none cursor-pointer"
              >
                <option value="">Sem dono</option>
                {donos.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {!ehPro && (
            <p className="text-xs text-bee-muted">
              O perfil nasce com o modelo Clássico. Outros modelos são do plano Pro.
            </p>
          )}
          <button
            type="submit"
            disabled={salvando}
            className="w-full h-11 rounded-lg bg-bee-pink hover:bg-bee-pink-hot text-white text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
            Criar perfil
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Apagar é para sempre e leva links e cliques junto, então a criadora digita o
 * endereço para confirmar.
 */
function ApagarPagina({
  pagina,
  onFechar,
  onApagada,
}: {
  pagina: ApiProfile | null;
  onFechar: () => void;
  onApagada: (id: string) => void;
}) {
  const [confirmacao, setConfirmacao] = useState("");
  const [apagando, setApagando] = useState(false);
  // O diálogo fecha com animação; o nome continua visível até o fim dela.
  const exibida = useUltimo(pagina);

  useEffect(() => setConfirmacao(""), [pagina]);

  const apagar = async () => {
    if (!pagina || confirmacao !== pagina.slug) return;
    setApagando(true);
    try {
      await api.deleteProfile(pagina.id);
      onApagada(pagina.id);
      toast.success("Perfil apagado.");
      onFechar();
    } catch (caught) {
      // A API recusa apagar a última página e explica por quê.
      toast.error(caught instanceof ApiError ? caught.message : "Não foi possível apagar.");
    } finally {
      setApagando(false);
    }
  };

  return (
    <Dialog open={pagina !== null} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="bg-bee-surface border-white/10 max-w-md">
        <DialogTitle className="text-white">Apagar {exibida?.displayName}?</DialogTitle>
        <p className="text-sm text-bee-muted">
          Os links e o histórico de cliques deste perfil somem junto, e não dá para desfazer. Se
          quiser só tirar do ar, desligue "Perfil no ar" na aba Aparência. Para confirmar, digite{" "}
          <span className="font-mono text-white">{exibida?.slug}</span>.
        </p>
        <input
          value={confirmacao}
          onChange={(e) => setConfirmacao(e.target.value)}
          placeholder={exibida?.slug}
          className="w-full h-11 px-3 rounded-lg bg-bee-bg border border-white/10 font-mono text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-red-400/50"
        />
        <button
          onClick={apagar}
          disabled={!pagina || confirmacao !== pagina.slug || apagando}
          className="w-full h-11 rounded-lg bg-red-500/90 hover:bg-red-500 text-white text-sm font-semibold transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {apagando && <Loader2 className="w-4 h-4 animate-spin" />}
          Apagar para sempre
        </button>
      </DialogContent>
    </Dialog>
  );
}

/** A conta que ainda não tem página: foi aberta pelo admin, e a primeira
 *  página é dela para montar. Um convite, não uma lista vazia. */
function SemPaginas({ onCriar }: { onCriar: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-dashed border-white/15 bg-bee-surface/60 px-6 py-14 text-center"
    >
      <div className="mx-auto w-12 h-12 rounded-xl bg-bee-pink/15 text-bee-pink flex items-center justify-center mb-4">
        <Plus className="w-6 h-6" />
      </div>
      <h2 className="text-lg font-semibold text-white">Crie o seu primeiro perfil</h2>
      <p className="text-sm text-bee-muted mt-1 max-w-md mx-auto">
        É o endereço que você vai colocar na bio. Escolha um nome e um link; o resto (foto, capa, links) você monta depois no editor.
      </p>
      <button
        onClick={onCriar}
        className="mt-6 inline-flex items-center gap-2 h-11 px-5 rounded-lg bg-bee-pink hover:bg-bee-pink-hot text-white text-sm font-semibold transition-colors"
      >
        <Plus className="w-4 h-4" />
        Criar meu perfil
      </button>
    </motion.div>
  );
}
