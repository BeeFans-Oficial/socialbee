"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, Loader2, Palette, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import {
  Aviso,
  CampoDeTexto,
  FUNDO_DO_PAINEL,
  Grupo,
  Linha,
  Secao,
} from "@/components/editor/Painel";
import { EsqueletoDeEditor } from "@/components/painel/Esqueleto";
import { VerificarDestino } from "@/components/painel/VerificarDestino";
import { IconeDePlataforma } from "@/components/shared/IconeDePlataforma";
import { SeloPro, avisarPro } from "@/components/shared/SeloPro";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { api, ApiError } from "@/lib/api/client";
import { usePlano } from "@/lib/api/use-session";
import type { ApiLink, ApiProfile, LinkInput } from "@/lib/api/types";
import { PLATFORMS } from "@/lib/catalog";
import { cn } from "@/lib/utils";


/** Redes que a página segura pode mostrar. */
const REDES_DA_PAGINA_SEGURA = [
  { id: "instagram", label: "Instagram" },
  { id: "twitter", label: "Twitter/X" },
  { id: "tiktok", label: "TikTok" },
  { id: "youtube", label: "YouTube" },
  { id: "twitch", label: "Twitch" },
  { id: "snapchat", label: "Snapchat" },
  { id: "facebook", label: "Facebook" },
];

type Rede = { platform: string; url: string; title: string };

/**
 * Editor de UM link, no mesmo formato do editor de página: a prévia da página
 * à esquerda e o painel à direita.
 *
 * Substitui, para a tela de Links, o modal "Gerenciar links" — que abria todos
 * os links empilhados e não o que a criadora clicou.
 *
 * `/links/novo` cria; qualquer outro id edita. Editando, cada ajuste salva
 * sozinho e a prévia recarrega em seguida, como no editor de página.
 */
export default function EditorDeLink() {
  const { id } = useParams<{ id: string }>();
  const ehNovo = id === "novo";
  const router = useRouter();
  const { ehPro } = usePlano();

  const [link, setLink] = useState<ApiLink | null>(null);
  const [pagina, setPagina] = useState<ApiProfile | null>(null);
  /** O que está sendo digitado ao criar — para a prévia acompanhar. */
  const [rascunho, setRascunho] = useState({ platform: "custom", title: "" });
  const [salvando, setSalvando] = useState(false);
  const [apagando, setApagando] = useState(false);

  useEffect(() => {
    Promise.all([api.profile(), ehNovo ? Promise.resolve([]) : api.links()])
      .then(([perfil, links]) => {
        setPagina(perfil);
        if (ehNovo) return;
        const achado = links.find((l) => l.id === id);
        if (!achado) {
          toast.error("Link não encontrado.");
          router.replace("/links");
          return;
        }
        setLink(achado);
      })
      .catch((caught) => {
        if (caught instanceof ApiError && caught.isUnauthorized) {
          router.replace(`/login?de=/links/${id}`);
          return;
        }
        toast.error("Não foi possível abrir o link.");
      });
  }, [id, ehNovo, router]);

  /** Salva um pedaço do link e recarrega a prévia. Devolve se deu certo. */
  const salvar = useCallback(
    async (input: Partial<LinkInput>): Promise<boolean> => {
      if (!link) return false;
      setSalvando(true);
      try {
        setLink(await api.updateLink(link.id, input));
        return true;
      } catch (caught) {
        toast.error(caught instanceof ApiError ? caught.message : "Não foi possível salvar.");
        return false;
      } finally {
        setSalvando(false);
      }
    },
    [link],
  );

  if (!pagina || (!ehNovo && !link)) return <EsqueletoDeEditor semPrevia />;

  return (
    // Só configuração, sem prévia: uma coluna no meio da tela. Quem quer ver
    // como o botão fica vai à aba Aparência, onde a prévia é a página inteira.
    <div className="mx-auto w-full max-w-2xl lg:px-8 lg:py-8">
      {/* ── Painel ─────────────────────────────────────────────────────── */}
      <aside className={cn("w-full pb-10 lg:rounded-2xl lg:border lg:border-bee-line", FUNDO_DO_PAINEL)}>
        <div className="sticky top-14 lg:static z-20 h-14 lg:h-16 px-4 flex items-center gap-3 border-b border-bee-line bg-bee-panel lg:rounded-t-2xl">
          <Link
            href="/links"
            aria-label="Voltar aos links"
            className="w-9 h-9 rounded-lg border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:border-white/25 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <span className="flex-1 text-[15px] font-medium text-white truncate">
            {ehNovo ? "Novo link" : link!.title}
          </span>
          {salvando && <Loader2 className="w-4 h-4 text-bee-muted animate-spin" />}
        </div>

        {ehNovo ? (
          <NovoLink
            rascunho={rascunho}
            onMudar={setRascunho}
            onCriado={(novo) => router.replace(`/links/${novo.id}`)}
          />
        ) : (
          <>
            <Secao titulo="Link">
              <Linha rotulo="Plataforma">
                <SeletorDePlataforma
                  valor={link!.platform}
                  onEscolher={(platform) => salvar({ platform })}
                />
              </Linha>
              <CampoDeTexto
                rotulo="Título"
                valor={link!.title}
                maxLength={100}
                onSalvar={(v) => (v.trim() ? salvar({ title: v.trim() }) : Promise.resolve(false))}
              />
              <CampoDeTexto
                rotulo="Descrição"
                valor={link!.subtitle ?? ""}
                placeholder="opcional"
                maxLength={120}
                onSalvar={(v) => salvar({ subtitle: v.trim() || null })}
              />
              <CampoDeTexto
                rotulo="Destino"
                dataTour="destino"
                valor={link!.destinationUrl}
                placeholder="https://"
                maxLength={2048}
                onSalvar={(v) => salvar({ destinationUrl: v.trim() })}
              />
              <VerificarDestino linkId={link!.id} destino={link!.destinationUrl} />
              <Linha rotulo="Ativo">
                <Switch checked={link!.isActive} onCheckedChange={(isActive) => salvar({ isActive })} />
              </Linha>
            </Secao>

            <Secao titulo="Proteção">
              <Protecao link={link!} ehPro={ehPro} salvar={salvar} />
            </Secao>

            <Secao titulo="Aparência do botão">
              <Link
                href={`/paginas/${pagina.id}`}
                data-tour="aparencia-do-botao"
                className="mx-2 mb-2 inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-white transition-colors"
              >
                <Palette className="w-4 h-4" />
                Estilo e cor ficam na aba Aparência, com a prévia do perfil
              </Link>
            </Secao>

            <Secao titulo="Desempenho">
              <Linha rotulo="Cliques" compacta>
                <span className="text-sm text-white tabular-nums">
                  {link!.clicks.toLocaleString("pt-BR")}
                </span>
              </Linha>
              <Linha rotulo="Último clique" compacta>
                <span className="text-sm text-white/60">
                  {link!.lastClickAt
                    ? new Date(link!.lastClickAt).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "nenhum ainda"}
                </span>
              </Linha>
              <a
                href={link!.destinationUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 mx-2 inline-flex items-center gap-1.5 text-xs text-bee-muted hover:text-white transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Abrir o destino
              </a>
            </Secao>

            <div className="px-6 py-5 border-t border-white/[0.06]">
              <button
                onClick={() => setApagando(true)}
                className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Apagar link
              </button>
            </div>

            <ApagarLink
              aberto={apagando}
              titulo={link!.title}
              onFechar={() => setApagando(false)}
              onApagar={async () => {
                try {
                  await api.deleteLink(link!.id);
                  toast.success("Link apagado.");
                  router.replace("/links");
                } catch (caught) {
                  toast.error(caught instanceof ApiError ? caught.message : "Não foi possível apagar.");
                }
              }}
            />
          </>
        )}
      </aside>
    </div>
  );
}

// ── Criar ─────────────────────────────────────────────────────────────────────

function NovoLink({
  rascunho,
  onMudar,
  onCriado,
}: {
  rascunho: { platform: string; title: string };
  onMudar: (r: { platform: string; title: string }) => void;
  onCriado: (link: ApiLink) => void;
}) {
  const { platform, title } = rascunho;
  const setPlatform = (p: string) => onMudar({ ...rascunho, platform: p });
  const setTitle = (t: string) => onMudar({ ...rascunho, title: t });
  const [destino, setDestino] = useState("");
  const [criando, setCriando] = useState(false);

  const criar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !destino.trim()) {
      toast.error("Dê um título e um destino ao link.");
      return;
    }
    setCriando(true);
    try {
      onCriado(
        await api.createLink({ title: title.trim(), destinationUrl: destino.trim(), platform }),
      );
    } catch (caught) {
      // Inclui a recusa do plano Free no limite de links, com a mensagem da API.
      toast.error(caught instanceof ApiError ? caught.message : "Não foi possível criar o link.");
      setCriando(false);
    }
  };

  return (
    <form onSubmit={criar} className="p-4 space-y-5" data-tour="novo-link-form">
      <div>
        <div className="mb-2 text-sm text-white/85">Plataforma</div>
        <div className="grid grid-cols-5 gap-2">
          {PLATFORMS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() =>
                onMudar({
                  platform: p.id,
                  title: title.trim() ? title : p.id === "custom" ? "" : p.label,
                })
              }
              title={p.label}
              className={cn(
                "aspect-square rounded-lg border flex items-center justify-center transition-colors",
                platform === p.id
                  ? "border-bee-pink/60 bg-bee-pink/[0.08] text-white"
                  : "border-white/10 text-white/50 hover:text-white hover:border-white/25",
              )}
            >
              <IconeDePlataforma plataforma={p.id} className="w-4 h-4" />
            </button>
          ))}
        </div>
        <div className="mt-2 text-xs text-bee-muted">
          {PLATFORMS.find((p) => p.id === platform)?.label}
        </div>
      </div>

      <label className="block">
        <span className="block mb-2 text-sm text-white/85">Título</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={100}
          placeholder="Como o botão aparece no perfil"
          className="w-full h-11 px-3 rounded-lg bg-bee-surface border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-bee-pink/50"
        />
      </label>

      <label className="block">
        <span className="block mb-2 text-sm text-white/85">Destino</span>
        <input
          value={destino}
          onChange={(e) => setDestino(e.target.value)}
          maxLength={2048}
          inputMode="url"
          autoCapitalize="none"
          placeholder="https://"
          className="w-full h-11 px-3 rounded-lg bg-bee-surface border border-white/10 font-mono text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-bee-pink/50"
        />
      </label>

      <button
        type="submit"
        disabled={criando}
        className="w-full h-11 rounded-lg bg-bee-pink hover:bg-bee-pink-hot text-white text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {criando && <Loader2 className="w-4 h-4 animate-spin" />}
        Criar link
      </button>
      <p className="text-xs text-bee-muted">
        Depois de criar, você ajusta proteção e aparência aqui mesmo.
      </p>
    </form>
  );
}

// ── Peças ─────────────────────────────────────────────────────────────────────

function SeletorDePlataforma({ valor, onEscolher }: { valor: string; onEscolher: (p: string) => void }) {
  return (
    <label className="relative flex items-center gap-2 pl-3 pr-3 py-1.5 rounded-lg border border-white/10 bg-bee-bg/60 text-sm text-white/85">
      <IconeDePlataforma plataforma={valor} className="w-3.5 h-3.5 text-white/60" />
      <select
        value={valor}
        onChange={(e) => onEscolher(e.target.value)}
        className="appearance-none bg-transparent focus:outline-none cursor-pointer pr-1"
        aria-label="Plataforma"
      >
        {PLATFORMS.map((p) => (
          <option key={p.id} value={p.id} className="bg-bee-surface">
            {p.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Cloaking + página segura.
 *
 * O cloaking só liga com a página segura pronta (pelo menos uma rede): ligar
 * sem ela deixaria o link sem nada para mostrar a quem não deve ver o destino —
 * a regra que a pauta dos devs pede, e que o modal antigo também cobrava.
 */
function Protecao({
  link,
  ehPro,
  salvar,
}: {
  link: ApiLink;
  ehPro: boolean;
  salvar: (input: Partial<LinkInput>) => Promise<boolean>;
}) {
  const salvas: Rede[] = (link.safePage?.socialLinks ?? []).map((s) => ({
    platform: s.platform,
    url: s.url,
    title: s.title,
  }));
  const [redes, setRedes] = useState<Rede[]>(salvas);
  const [guardando, setGuardando] = useState(false);
  useEffect(() => setRedes(salvas), [link.safePage]); // eslint-disable-line react-hooks/exhaustive-deps

  const mudouAlgo = JSON.stringify(redes) !== JSON.stringify(salvas);
  const temPaginaSegura = salvas.length > 0;
  const travado = !ehPro && !link.cloakEnabled;

  const alternar = (ligar: boolean) => {
    if (ligar && travado) return avisarPro("O cloaking");
    if (ligar && !temPaginaSegura) {
      toast.info("Adicione pelo menos uma rede na página segura antes de ligar o cloaking.");
      return;
    }
    void salvar({ cloakEnabled: ligar });
  };

  const guardar = async () => {
    const validas = redes.filter((r) => r.url.trim());
    if (link.cloakEnabled && validas.length === 0) {
      toast.error("Com o cloaking ligado, a página segura precisa de pelo menos uma rede.");
      return;
    }
    setGuardando(true);
    await salvar({
      safePage: validas.length ? { socialLinks: validas.map((r) => ({ ...r, url: r.url.trim() })) } : null,
    });
    setGuardando(false);
  };

  return (
    <>
      <Grupo
        titulo="Cloaking"
        nota="Ligado, robôs e quem não deve ver o destino recebem a página segura, só com as suas redes."
        dataTour="cloaking"
      >
        <Linha rotulo="Página segura no lugar do destino" compacta>
          <span className="flex items-center gap-2">
            {travado && <SeloPro />}
            <Switch checked={link.cloakEnabled} onCheckedChange={alternar} />
          </span>
        </Linha>
      </Grupo>

      {(ehPro || link.cloakEnabled) && (
        <Grupo titulo="Página segura" nota="Até 12 redes. Use perfis sem conteúdo adulto.">
          <div className="space-y-2 px-2">
            {redes.map((rede, i) => (
              <div key={i} className="flex items-center gap-2">
                <select
                  value={rede.platform}
                  onChange={(e) => {
                    const label = REDES_DA_PAGINA_SEGURA.find((r) => r.id === e.target.value)?.label ?? "";
                    setRedes(redes.map((r, j) => (j === i ? { ...r, platform: e.target.value, title: label } : r)));
                  }}
                  className="h-9 px-2 rounded-md bg-bee-surface border border-white/10 text-xs text-white focus:outline-none"
                  aria-label="Rede"
                >
                  {REDES_DA_PAGINA_SEGURA.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <input
                  value={rede.url}
                  onChange={(e) => setRedes(redes.map((r, j) => (j === i ? { ...r, url: e.target.value } : r)))}
                  placeholder="https://"
                  className="flex-1 min-w-0 h-9 px-2 rounded-md bg-bee-surface border border-white/10 font-mono text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-bee-pink/50"
                />
                <button
                  onClick={() => setRedes(redes.filter((_, j) => j !== i))}
                  aria-label="Remover rede"
                  className="p-1.5 text-white/40 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            <div className="flex items-center gap-3 pt-1">
              {redes.length < 12 && (
                <button
                  onClick={() => setRedes([...redes, { platform: "instagram", url: "", title: "Instagram" }])}
                  className="inline-flex items-center gap-1.5 text-xs text-white/60 hover:text-white"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar rede
                </button>
              )}
              {mudouAlgo && (
                <button
                  onClick={guardar}
                  disabled={guardando}
                  className="ml-auto px-3 py-1.5 rounded-md bg-white text-bee-bg text-xs font-semibold disabled:opacity-60"
                >
                  Salvar página segura
                </button>
              )}
            </div>
          </div>
          {!temPaginaSegura && !mudouAlgo && (
            <div className="px-2">
              <Aviso>Sem página segura o cloaking não pode ser ligado.</Aviso>
            </div>
          )}
        </Grupo>
      )}
    </>
  );
}

function ApagarLink({
  aberto,
  titulo,
  onFechar,
  onApagar,
}: {
  aberto: boolean;
  titulo: string;
  onFechar: () => void;
  onApagar: () => Promise<void>;
}) {
  const [apagando, setApagando] = useState(false);
  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="bg-bee-surface border-white/10 max-w-md">
        <DialogTitle className="text-white">Apagar &quot;{titulo}&quot;?</DialogTitle>
        <p className="text-sm text-bee-muted">
          O botão some do seu perfil e o contador de cliques dele é apagado. Não dá para desfazer.
        </p>
        <button
          onClick={async () => {
            setApagando(true);
            await onApagar();
            setApagando(false);
          }}
          disabled={apagando}
          className="w-full h-11 rounded-lg bg-red-500/90 hover:bg-red-500 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {apagando && <Loader2 className="w-4 h-4 animate-spin" />}
          Apagar link
        </button>
      </DialogContent>
    </Dialog>
  );
}
