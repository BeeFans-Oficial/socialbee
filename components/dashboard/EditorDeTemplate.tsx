"use client";

import React, { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Eye, EyeOff, ImagePlus, Plus, RotateCcw, Trash2 } from "lucide-react";

import { PreviaDaPagina } from "@/components/shared/PreviaDaPagina";
import { api, ApiError, definirPaginaAtiva } from "@/lib/api/client";
import { invalidateSession } from "@/lib/api/use-session";
import { THEMES, type Link as LinkType } from "@/lib/catalog";
import { FONTES, TEMPLATES, resolverVisual } from "@/lib/templates";
import { cn } from "@/lib/utils";

/**
 * O editor da página pública.
 *
 * Uma tela onde a criadora muda **tudo o que é visual** e vê o resultado do
 * lado, no mesmo gesto: template, imagem de fundo e seu enquadramento, cores,
 * fonte, formato do botão, os textos e os próprios links.
 *
 * ## Por que a prévia não é um iframe
 *
 * A tela de Prévia (`/previa`) usa iframes da rota real, e está certo lá: ela
 * responde "o que está no ar agora?". Aqui a pergunta é outra — "como vai
 * ficar o que estou mexendo?" — e essa só se responde renderizando o estado
 * não salvo. A fidelidade vem de a prévia usar os MESMOS componentes e a MESMA
 * função de resolução (`resolverVisual`) da página pública.
 *
 * ## Salvamento explícito
 *
 * Nada é gravado enquanto ela mexe. Um editor que salva a cada tecla transforma
 * experimentar em publicar — e a página dela está no ar, sendo vista. O botão
 * Salvar é a fronteira entre brincar e publicar.
 */

const ESTILOS_DE_BOTAO = [
  { id: "soft", label: "Suave" },
  { id: "filled", label: "Preenchido" },
  { id: "outlined", label: "Contorno" },
  { id: "glass", label: "Vidro" },
  { id: "pill", label: "Pílula" },
] as const;

export interface EstadoInicialDoEditor {
  /** Id da página em edição — necessário para apagá-la. */
  profileId: string;
  slug: string;
  published: boolean;
  templateId: string;
  themeId: string;
  buttonStyle: string;
  bgColor: string | null;
  accentColor: string | null;
  fontId: string | null;
  coverUrl: string | null;
  coverPosX: number;
  coverPosY: number;
  coverOverlay: number;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  isAdult: boolean;
}

interface EditorDeTemplateProps {
  inicial: EstadoInicialDoEditor;
  links: LinkType[];
  /** Recarrega a lista depois de criar um link — quem é dono dela é a página. */
  onLinksMudaram: () => void;
  onNaoAutorizado: () => void;
}

export function EditorDeTemplate({
  inicial,
  links,
  onLinksMudaram,
  onNaoAutorizado,
}: EditorDeTemplateProps) {
  const [templateId, setTemplateId] = useState(inicial.templateId);
  const [themeId, setThemeId] = useState(inicial.themeId);
  const [buttonStyle, setButtonStyle] = useState(inicial.buttonStyle);
  const [bgColor, setBgColor] = useState(inicial.bgColor);
  const [accentColor, setAccentColor] = useState(inicial.accentColor);
  const [fontId, setFontId] = useState(inicial.fontId);
  const [coverUrl, setCoverUrl] = useState(inicial.coverUrl);
  const [coverPosX, setCoverPosX] = useState(inicial.coverPosX);
  const [coverPosY, setCoverPosY] = useState(inicial.coverPosY);
  const [coverOverlay, setCoverOverlay] = useState(inicial.coverOverlay);
  const [displayName, setDisplayName] = useState(inicial.displayName);
  const [bio, setBio] = useState(inicial.bio);
  const [noAr, setNoAr] = useState(inicial.published);

  // Exclusão: a criadora digita o endereço para confirmar. Um "tem certeza?"
  // se responde no reflexo; digitar o endereço obriga a olhar QUAL página está
  // prestes a sumir — e é a página errada que dói, não a confirmação rápida.
  const [confirmacao, setConfirmacao] = useState("");
  const [apagando, setApagando] = useState(false);

  const [salvando, setSalvando] = useState(false);
  const [novoTitulo, setNovoTitulo] = useState("");
  const [novoDestino, setNovoDestino] = useState("");
  const [criandoLink, setCriandoLink] = useState(false);
  const arquivoRef = useRef<HTMLInputElement>(null);

  /** A mesma resolução da rota pública — é o que faz a prévia não mentir. */
  const visual = useMemo(
    () =>
      resolverVisual({
        templateId,
        themeId,
        buttonStyle,
        bgColor,
        accentColor,
        fontId,
        coverUrl,
        coverPosX,
        coverPosY,
        coverOverlay,
      }),
    [templateId, themeId, buttonStyle, bgColor, accentColor, fontId, coverUrl, coverPosX, coverPosY, coverOverlay],
  );

  const apagarPagina = async () => {
    if (confirmacao.trim() !== inicial.slug) {
      toast.error("Digite o endereço da página para confirmar.");
      return;
    }
    setApagando(true);
    try {
      await api.deleteProfile(inicial.profileId);
      // A página ativa deixou de existir: limpar a escolha faz a API cair na
      // padrão da conta no próximo carregamento, em vez de mandar um id morto.
      definirPaginaAtiva(null);
      invalidateSession();
      window.location.reload();
    } catch (caught) {
      tratarErro(caught, "Não foi possível apagar a página.");
      setApagando(false);
    }
  };

  const alternarLink = async (id: string, ativo: boolean) => {
    try {
      await api.updateLink(id, { isActive: !ativo });
      onLinksMudaram();
    } catch (caught) {
      tratarErro(caught, "Não foi possível mudar o link.");
    }
  };

  /**
   * Escolher um template aplica o visual dele por inteiro.
   *
   * O `botaoPadrao` do descritor parecia funcionar e não funcionava: como todo
   * perfil tem `buttonStyle` gravado (o default é "soft"), a precedência
   * "escolha da criadora ganha do template" fazia o padrão do template nunca
   * chegar à tela. Ela clicava em Cartões e os botões continuavam iguais.
   *
   * Aqui a escolha do template passa a mexer no estilo do botão também — é o
   * que "escolher um modelo" significa. Ela continua livre para trocar depois,
   * e a troca dela sobrevive até escolher outro modelo.
   *
   * A fonte não precisa disso porque `fontId` é anulável: nulo já cai no padrão
   * do template sozinho.
   */
  const escolherTemplate = (id: string) => {
    setTemplateId(id);
    const escolhido = TEMPLATES.find((t) => t.id === id);
    if (escolhido) setButtonStyle(escolhido.botaoPadrao);
  };

  const tratarErro = (caught: unknown, fallback: string) => {
    if (caught instanceof ApiError && caught.isUnauthorized) {
      onNaoAutorizado();
      return;
    }
    toast.error(caught instanceof ApiError ? caught.message : fallback);
  };

  const escolherImagem = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setCoverUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const salvar = async () => {
    setSalvando(true);
    try {
      await api.updateProfile({
        published: noAr,
        templateId,
        themeId,
        buttonStyle,
        bgColor,
        accentColor,
        fontId,
        coverUrl,
        coverPosX,
        coverPosY,
        coverOverlay,
        displayName,
        bio,
      });
      invalidateSession();
      toast.success("Página atualizada! ✓");
    } catch (caught) {
      tratarErro(caught, "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  };

  const criarLink = async () => {
    if (!novoTitulo.trim() || !novoDestino.trim()) {
      toast.error("Dê um nome e um destino ao botão.");
      return;
    }
    setCriandoLink(true);
    try {
      await api.createLink({ title: novoTitulo.trim(), destinationUrl: novoDestino.trim() });
      setNovoTitulo("");
      setNovoDestino("");
      onLinksMudaram();
      toast.success("Botão adicionado! ✓");
    } catch (caught) {
      tratarErro(caught, "Não foi possível adicionar o botão.");
    } finally {
      setCriandoLink(false);
    }
  };

  const apagarLink = async (id: string) => {
    try {
      await api.deleteLink(id);
      onLinksMudaram();
      toast.success("Botão removido.");
    } catch (caught) {
      tratarErro(caught, "Não foi possível remover.");
    }
  };

  const usaCapa = visual.capa !== "nenhuma";

  return (
    <div className="flex flex-col xl:flex-row gap-8">
      {/* ── Prévia ──────────────────────────────────────────────────────── */}
      <div className="xl:sticky xl:top-8 xl:self-start">
        <div className="text-[11px] uppercase tracking-[0.2em] text-white/30 text-center mb-3">
          Sua página
        </div>
        <PreviaDaPagina
          visual={visual}
          user={{ displayName, bio, avatarUrl: inicial.avatarUrl, isAdult: inicial.isAdult }}
          links={links}
        />
        <button
          onClick={salvar}
          disabled={salvando}
          className="mt-5 w-full py-3 rounded-xl bg-bee-pink text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          {salvando ? "Salvando…" : "Salvar"}
        </button>
        <p className="text-[11px] text-white/25 text-center mt-2">
          Nada vai para o ar antes de salvar.
        </p>
      </div>

      {/* ── Controles ───────────────────────────────────────────────────── */}
      <div className="flex-1 space-y-8 max-w-xl">
        <Secao titulo="Modelo">
          <div className="grid grid-cols-2 gap-3">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => escolherTemplate(t.id)}
                className={cn(
                  "text-left p-3 rounded-xl border transition-all",
                  templateId === t.id
                    ? "border-bee-pink bg-bee-pink/[0.07]"
                    : "border-white/10 hover:border-white/25",
                )}
              >
                <div className="text-sm font-semibold text-white">{t.label}</div>
                <div className="text-[11px] text-white/35 leading-snug mt-0.5">{t.descricao}</div>
              </button>
            ))}
          </div>
        </Secao>

        <Secao
          titulo="Imagem de fundo"
          nota={usaCapa ? undefined : "O modelo escolhido não usa imagem de fundo."}
        >
          <div className={cn(!usaCapa && "opacity-40 pointer-events-none")}>
            {coverUrl ? (
              <div className="relative rounded-xl overflow-hidden border border-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element -- data URL local */}
                <img
                  src={coverUrl}
                  alt=""
                  className="w-full h-32 object-cover"
                  style={{ objectPosition: `${coverPosX}% ${coverPosY}%` }}
                />
                <button
                  onClick={() => setCoverUrl(null)}
                  className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-white/70 hover:text-white"
                  title="Remover imagem"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => arquivoRef.current?.click()}
                className="flex flex-col items-center justify-center gap-2 w-full h-32 rounded-xl border border-dashed border-white/15 hover:border-white/30 transition-all"
              >
                <ImagePlus className="w-5 h-5 text-white/30" />
                <span className="text-xs text-white/35">Escolher imagem</span>
              </button>
            )}
            <input
              ref={arquivoRef}
              type="file"
              accept="image/*"
              onChange={escolherImagem}
              className="hidden"
            />

            {coverUrl && (
              <div className="mt-4 space-y-3">
                {/* Enquadramento. Foto vertical de celular é sempre cortada em
                    algum lugar; o que muda é ONDE, e é isso que estes dois
                    controles decidem. */}
                <Deslizante
                  rotulo="Posição horizontal"
                  valor={coverPosX}
                  onChange={setCoverPosX}
                  sufixo="%"
                />
                <Deslizante
                  rotulo="Posição vertical"
                  valor={coverPosY}
                  onChange={setCoverPosY}
                  sufixo="%"
                />
                <Deslizante
                  rotulo="Escurecer"
                  valor={coverOverlay}
                  onChange={setCoverOverlay}
                  sufixo="%"
                  nota="Sem escurecer, texto claro some sobre foto clara."
                />
              </div>
            )}
          </div>
        </Secao>

        <Secao titulo="Cores">
          <div className="flex flex-wrap gap-2 mb-4">
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setThemeId(t.id);
                  // Trocar de preset limpa as exceções: senão a criadora escolhe
                  // outro tema, nada muda na tela, e ela conclui que quebrou.
                  setBgColor(null);
                  setAccentColor(null);
                }}
                title={t.label}
                className={cn(
                  "w-9 h-9 rounded-lg border-2 transition-all",
                  themeId === t.id && !bgColor && !accentColor
                    ? "border-white scale-105"
                    : "border-white/10 hover:border-white/30",
                )}
                style={{ background: `linear-gradient(135deg, ${t.bg}, ${t.accent})` }}
              />
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <SeletorDeCor
              rotulo="Fundo"
              valor={visual.bg}
              personalizada={Boolean(bgColor)}
              onChange={setBgColor}
              onLimpar={() => setBgColor(null)}
            />
            <SeletorDeCor
              rotulo="Destaque"
              valor={visual.accent}
              personalizada={Boolean(accentColor)}
              onChange={setAccentColor}
              onLimpar={() => setAccentColor(null)}
            />
          </div>
        </Secao>

        <Secao titulo="Tipografia e botões">
          <div className="grid grid-cols-3 gap-2 mb-4">
            {FONTES.map((f) => (
              <button
                key={f.id}
                onClick={() => setFontId(f.id)}
                className={cn(
                  f.classe,
                  "py-2.5 rounded-xl border text-sm transition-all",
                  (fontId ?? visual.fontePadrao) === f.id
                    ? "border-bee-pink bg-bee-pink/[0.07] text-white"
                    : "border-white/10 text-white/50 hover:border-white/25",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {ESTILOS_DE_BOTAO.map((e) => (
              <button
                key={e.id}
                onClick={() => setButtonStyle(e.id)}
                className={cn(
                  "px-3 py-2 rounded-xl border text-xs transition-all",
                  buttonStyle === e.id
                    ? "border-bee-pink bg-bee-pink/[0.07] text-white"
                    : "border-white/10 text-white/50 hover:border-white/25",
                )}
              >
                {e.label}
              </button>
            ))}
          </div>
        </Secao>

        <Secao titulo="Textos">
          <label className="block text-xs text-white/40 mb-1.5">Nome</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={60}
            className="w-full px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white focus:outline-none focus:border-bee-pink/40"
          />
          <label className="block text-xs text-white/40 mb-1.5 mt-4">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={500}
            rows={3}
            className="w-full px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white resize-none focus:outline-none focus:border-bee-pink/40"
          />
        </Secao>

        <Secao titulo="Publicação">
          <label className="flex items-start gap-3 p-3 rounded-xl border border-white/10 cursor-pointer hover:border-white/20 transition-all">
            <input
              type="checkbox"
              checked={noAr}
              onChange={(e) => setNoAr(e.target.checked)}
              className="mt-0.5 accent-bee-pink"
            />
            <span>
              <span className="block text-sm font-medium text-white">
                {noAr ? "No ar" : "Fora do ar"}
              </span>
              <span className="block text-[11px] text-white/35 leading-relaxed mt-0.5">
                Fora do ar, o endereço responde como se a página não existisse. Seus
                links, códigos e o relatório ficam preservados — e voltar é uma tecla.
                Os links já divulgados (<code>/r/…</code>) continuam levando ao destino.
              </span>
            </span>
          </label>
        </Secao>

        <Secao
          titulo="Botões da página"
          nota="Para mudar destino, ícone ou cor de um botão, use a tela de Links."
        >
          <div className="space-y-2 mb-4">
            {links.map((l) => (
              <div
                key={l.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-white/10"
              >
                <span className="flex-1 text-sm text-white/80 truncate">{l.title}</span>
                {!l.isActive && (
                  <span className="text-[10px] uppercase tracking-wide text-white/25">oculto</span>
                )}
                {/* Ocultar vem antes de apagar, e é o gesto que resolve quase
                    sempre: o link sai da página e o código curto continua
                    valendo — prints e bios que já circulam não quebram. */}
                <button
                  onClick={() => alternarLink(l.id, l.isActive)}
                  className="p-1.5 rounded-lg text-white/30 hover:text-white transition-colors"
                  title={l.isActive ? "Tirar do ar" : "Colocar no ar"}
                >
                  {l.isActive ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => apagarLink(l.id)}
                  className="p-1.5 rounded-lg text-white/30 hover:text-red-400 transition-colors"
                  title="Apagar para sempre"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {links.length === 0 && (
              <p className="text-xs text-white/25">Nenhum botão ainda.</p>
            )}
          </div>

          <div className="grid grid-cols-[1fr_1fr_auto] gap-2 mb-8">
            <input
              value={novoTitulo}
              onChange={(e) => setNovoTitulo(e.target.value)}
              placeholder="Nome do botão"
              className="px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-bee-pink/40"
            />
            <input
              value={novoDestino}
              onChange={(e) => setNovoDestino(e.target.value)}
              placeholder="https://…"
              className="px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-bee-pink/40"
            />
            <button
              onClick={criarLink}
              disabled={criandoLink}
              className="px-4 rounded-xl bg-white/[0.06] border border-white/10 text-white/70 hover:text-white hover:border-white/25 transition-all disabled:opacity-40"
              title="Adicionar botão"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </Secao>

        {/* Apagar fica por último, separado, e pede o endereço digitado. É a
            única ação desta tela que não tem volta. */}
        <section className="rounded-xl border border-red-500/20 bg-red-500/[0.04] p-4">
          <div className="flex items-start gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-red-400/80 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-red-200/90">Apagar esta página</h3>
              <p className="text-[11px] text-white/40 leading-relaxed mt-1">
                Some com a página, os links e <span className="text-white/70">todo o histórico
                de cliques</span> dela. Não dá para desfazer, e não há backup automático. Se a
                intenção é só sumir do ar, use a chave de publicação acima.
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <input
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              placeholder={`Digite ${inicial.slug} para confirmar`}
              className="flex-1 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-red-500/40"
            />
            <button
              onClick={apagarPagina}
              disabled={apagando || confirmacao.trim() !== inicial.slug}
              className="px-4 rounded-xl bg-red-500/15 border border-red-500/30 text-sm font-medium text-red-300 hover:bg-red-500/25 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {apagando ? "Apagando…" : "Apagar"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function Secao({
  titulo,
  nota,
  children,
}: {
  titulo: string;
  nota?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="text-[11px] uppercase tracking-wider text-white/30 font-medium mb-3">
        {titulo}
      </h3>
      {children}
      {nota && <p className="text-[11px] text-white/25 mt-2">{nota}</p>}
    </section>
  );
}

function Deslizante({
  rotulo,
  valor,
  onChange,
  sufixo = "",
  nota,
}: {
  rotulo: string;
  valor: number;
  onChange: (v: number) => void;
  sufixo?: string;
  nota?: string;
}) {
  return (
    <div>
      <div className="flex justify-between text-xs text-white/40 mb-1">
        <span>{rotulo}</span>
        <span className="tabular-nums text-white/60">
          {valor}
          {sufixo}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={valor}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-bee-pink"
      />
      {nota && <p className="text-[11px] text-white/25 mt-1">{nota}</p>}
    </div>
  );
}

function SeletorDeCor({
  rotulo,
  valor,
  personalizada,
  onChange,
  onLimpar,
}: {
  rotulo: string;
  valor: string;
  personalizada: boolean;
  onChange: (v: string) => void;
  onLimpar: () => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-white/40">{rotulo}</span>
        {personalizada && (
          <button
            onClick={onLimpar}
            className="flex items-center gap-1 text-[10px] text-white/30 hover:text-white/60 transition-colors"
            title="Voltar à cor do tema"
          >
            <RotateCcw className="w-3 h-3" />
            tema
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          className="w-10 h-10 rounded-lg bg-transparent border border-white/10 cursor-pointer"
        />
        <code className="text-xs text-white/50 font-mono uppercase">{valor}</code>
      </div>
    </div>
  );
}
