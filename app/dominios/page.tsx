"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy, Globe, Loader2, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { toast, Toaster } from "sonner";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { SeloPro, avisarPro } from "@/components/shared/SeloPro";
import { api, ApiError } from "@/lib/api/client";
import { usePlano } from "@/lib/api/use-session";
import type { ApiCustomDomain, ApiDnsCheck } from "@/lib/api/types";
import { cn } from "@/lib/utils";

/** Quantas vagas desenhar para quem é Free: as do Pro, travadas. */
const VAGAS_DO_PRO = 3;

/**
 * Domínio próprio: as vagas da conta e como conectar um domínio.
 *
 * O fluxo tem uma etapa humana, e a tela diz isso com todas as letras: a
 * criadora cadastra e aponta o DNS, o painel confere, e a equipe configura o
 * certificado e ativa (`npm run dominio:ativar`). Ativo, o domínio aparece no
 * seletor "Domínio" do editor de cada página.
 */
export default function DominiosPage() {
  const router = useRouter();
  const { ehPro } = usePlano();
  const [dominios, setDominios] = useState<ApiCustomDomain[] | null>(null);
  const [vagas, setVagas] = useState(0);
  const [ip, setIp] = useState<string | null>(null);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [adicionando, setAdicionando] = useState(false);
  const [removendo, setRemovendo] = useState<ApiCustomDomain | null>(null);

  const carregar = useCallback(() => {
    api
      .customDomains()
      .then((r) => {
        setDominios(r.domains);
        setVagas(r.vagas);
        setIp(r.serverIp);
      })
      .catch((caught) => {
        if (caught instanceof ApiError && caught.isUnauthorized) {
          router.replace("/login?de=/dominios");
          return;
        }
        toast.error("Não foi possível carregar seus domínios.");
        setDominios([]);
      });
  }, [router]);

  useEffect(carregar, [carregar]);

  const totalDeVagas = ehPro ? vagas : VAGAS_DO_PRO;
  const livres = Math.max(0, vagas - (dominios?.length ?? 0));
  const atual = dominios?.find((d) => d.id === selecionado) ?? null;

  const abrirAdicionar = () => {
    if (!ehPro) return avisarPro("Domínio próprio");
    if (livres === 0) return toast.info("Suas vagas estão ocupadas. Remova um domínio para adicionar outro.");
    setAdicionando(true);
  };

  return (
    <div className="px-4 sm:px-8 py-10 max-w-3xl mx-auto">
      <Toaster position="top-center" richColors />

      <div className="flex items-center gap-2">
        <h1 className="text-xl font-semibold text-white">Vagas de domínio próprio</h1>
        {!ehPro && <SeloPro />}
      </div>
      <p className="text-sm text-bee-muted mt-1">Cada vaga serve um domínio seu nas suas páginas.</p>

      {/* Vagas */}
      <div className="mt-5 grid gap-3 grid-cols-1 sm:grid-cols-3">
        {Array.from({ length: totalDeVagas }, (_, i) => {
          const dominio = dominios?.[i];
          if (dominios === null) {
            return <div key={i} className="h-[62px] rounded-xl bg-bee-surface animate-pulse" />;
          }
          if (!dominio) {
            return (
              <button
                key={i}
                onClick={abrirAdicionar}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed text-left transition-colors",
                  ehPro ? "border-white/15 hover:border-white/30" : "border-white/10 opacity-60",
                )}
              >
                <Plus className="w-4 h-4 text-white/50" />
                <span>
                  <span className="block text-sm text-white">Vaga livre</span>
                  <span className="block text-xs text-bee-muted">Adicionar domínio</span>
                </span>
              </button>
            );
          }
          return (
            <button
              key={dominio.id}
              onClick={() => setSelecionado(dominio.id === selecionado ? null : dominio.id)}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors min-w-0",
                dominio.id === selecionado
                  ? "border-bee-pink/50 bg-bee-pink/[0.05]"
                  : "border-white/10 bg-bee-surface hover:border-white/25",
              )}
            >
              <Globe className="w-4 h-4 text-white/60 flex-shrink-0" />
              <span className="min-w-0">
                <span className="block text-sm text-white truncate font-mono">{dominio.host}</span>
                <Status status={dominio.status} />
              </span>
            </button>
          );
        })}
      </div>

      {/* Detalhe do domínio escolhido, ou o convite para conectar um */}
      {atual ? (
        <Detalhe
          dominio={atual}
          ip={ip}
          onFechar={() => setSelecionado(null)}
          onRemover={() => setRemovendo(atual)}
        />
      ) : (
        <div className="mt-6 rounded-2xl border border-white/10 bg-bee-surface/60 px-6 py-10 text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-white/[0.05] flex items-center justify-center">
            <Globe className="w-6 h-6 text-white/80" />
          </div>
          <h2 className="mt-5 text-xl font-semibold text-white">Tenha seu próprio domínio</h2>
          <p className="mt-2 text-sm text-white/65 max-w-md mx-auto">
            Conecte um domínio que você já tem. A gente cuida do certificado e da configuração.
          </p>
          <p className="mt-3 text-xs text-bee-muted">
            {ehPro
              ? `Você tem ${livres} ${livres === 1 ? "vaga livre" : "vagas livres"} de ${vagas}.`
              : `No plano Pro você conecta até ${VAGAS_DO_PRO} domínios.`}
          </p>
          <button
            onClick={abrirAdicionar}
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-bee-pink hover:bg-bee-pink-hot text-white text-sm font-semibold transition-colors"
          >
            Conectar meu domínio
            {!ehPro && <SeloPro className="bg-white/20 text-white border-white/30" />}
          </button>
          <p className="mt-4 text-xs text-bee-muted">
            Ainda não tem um? Compre em qualquer registrador, como o Registro.br, e volte aqui.
          </p>
        </div>
      )}

      <Adicionar
        aberto={adicionando}
        onFechar={() => setAdicionando(false)}
        onAdicionado={(novo) => {
          setDominios((atual) => [...(atual ?? []), novo]);
          setSelecionado(novo.id);
          setAdicionando(false);
        }}
      />
      <Remover
        dominio={removendo}
        onFechar={() => setRemovendo(null)}
        onRemovido={(id) => {
          setDominios((atual) => atual?.filter((d) => d.id !== id) ?? null);
          setSelecionado(null);
        }}
      />
    </div>
  );
}

function Status({ status }: { status: ApiCustomDomain["status"] }) {
  return status === "active" ? (
    <span className="flex items-center gap-1.5 text-xs text-emerald-400/90">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
      Ativo
    </span>
  ) : (
    <span className="flex items-center gap-1.5 text-xs text-amber-300/90">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-300" />
      Aguardando ativação
    </span>
  );
}

function Detalhe({
  dominio,
  ip,
  onFechar,
  onRemover,
}: {
  dominio: ApiCustomDomain;
  ip: string | null;
  onFechar: () => void;
  onRemover: () => void;
}) {
  const [checando, setChecando] = useState(false);
  const [dns, setDns] = useState<ApiDnsCheck | null>(null);

  useEffect(() => setDns(null), [dominio.id]);

  const conferir = async () => {
    setChecando(true);
    try {
      setDns(await api.checkCustomDomainDns(dominio.id));
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "Não foi possível conferir o DNS.");
    } finally {
      setChecando(false);
    }
  };

  return (
    <div className="mt-6 rounded-2xl border border-white/10 bg-bee-surface/60 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="font-mono text-[15px] text-white truncate">{dominio.host}</div>
          <div className="mt-1">
            <Status status={dominio.status} />
          </div>
        </div>
        <button onClick={onFechar} aria-label="Fechar" className="p-1 text-white/40 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>

      {dominio.status === "active" ? (
        <p className="mt-5 text-sm text-white/70 leading-relaxed">
          Pronto. Para usar, abra uma página em{" "}
          <Link href="/paginas" className="text-white underline underline-offset-2">
            Páginas
          </Link>{" "}
          e escolha este domínio em <span className="text-white">Domínio</span>.{" "}
          {dominio.paginas > 0 &&
            `Hoje ${dominio.paginas === 1 ? "1 página usa" : `${dominio.paginas} páginas usam`} este domínio.`}
        </p>
      ) : (
        <ol className="mt-5 space-y-5 text-sm">
          <Passo n={1} titulo="Aponte o domínio para a BeeSocial">
            {ip ? (
              <>
                <p className="text-white/65">
                  No painel onde você comprou o domínio, crie este registro DNS:
                </p>
                <div className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-lg border border-white/10 bg-bee-bg/60 px-4 py-3 font-mono text-[13px]">
                  <span className="text-bee-muted">Tipo</span>
                  <span className="text-white">A</span>
                  <span className="text-bee-muted">Nome</span>
                  <span className="text-white break-all">{dominio.host}</span>
                  <span className="text-bee-muted">Valor</span>
                  <span className="flex items-center gap-2 text-white">
                    {ip}
                    <button
                      onClick={async () => {
                        await navigator.clipboard.writeText(ip);
                        toast.success("IP copiado.");
                      }}
                      aria-label="Copiar IP"
                      className="text-white/40 hover:text-white"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </span>
                </div>
                <p className="mt-2 text-xs text-bee-muted">
                  Alguns painéis pedem no Nome só <span className="font-mono">@</span> (domínio
                  principal) ou só o começo (por exemplo, <span className="font-mono">links</span>).
                </p>
              </>
            ) : (
              <p className="text-white/65">
                Fale com a equipe para receber o endereço do registro DNS.
              </p>
            )}
          </Passo>

          <Passo n={2} titulo="Confira se já está apontando">
            <p className="text-white/65">A mudança no DNS pode levar algumas horas para valer.</p>
            <button
              onClick={conferir}
              disabled={checando || !ip}
              className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-white/15 text-sm text-white hover:border-white/30 transition-colors disabled:opacity-50"
            >
              {checando ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Conferir DNS
            </button>
            {dns &&
              (dns.ok ? (
                <p className="mt-3 flex items-center gap-2 text-emerald-400/90">
                  <Check className="w-4 h-4" />
                  Tudo certo: o domínio já aponta para a BeeSocial.
                </p>
              ) : (
                <p className="mt-3 text-amber-200/90">
                  Ainda não aponta.{" "}
                  {dns.encontrados.length > 0
                    ? `Hoje ele responde ${dns.encontrados.join(", ")}.`
                    : "Ainda não há registro A para ele."}
                </p>
              ))}
          </Passo>

          <Passo n={3} titulo="A equipe ativa">
            <p className="text-white/65">
              Com o DNS certo, a equipe instala o certificado e ativa o domínio. Depois disso ele
              aparece em Domínio, no editor de cada página.
            </p>
          </Passo>
        </ol>
      )}

      <div className="mt-6 pt-5 border-t border-white/[0.06]">
        <button
          onClick={onRemover}
          className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-red-400 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Remover domínio
        </button>
      </div>
    </div>
  );
}

function Passo({ n, titulo, children }: { n: number; titulo: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="w-6 h-6 rounded-full border border-white/15 flex items-center justify-center text-xs text-white/70 flex-shrink-0">
        {n}
      </span>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-white mb-1">{titulo}</div>
        {children}
      </div>
    </li>
  );
}

function Adicionar({
  aberto,
  onFechar,
  onAdicionado,
}: {
  aberto: boolean;
  onFechar: () => void;
  onAdicionado: (d: ApiCustomDomain) => void;
}) {
  const [host, setHost] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (aberto) setHost("");
  }, [aberto]);

  const adicionar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!host.trim()) return;
    setSalvando(true);
    try {
      onAdicionado(await api.addCustomDomain(host));
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "Não foi possível adicionar.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="bg-bee-surface border-white/10 max-w-md">
        <DialogTitle className="text-white">Conectar meu domínio</DialogTitle>
        <form onSubmit={adicionar} className="space-y-3 mt-1">
          <input
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="seunome.com ou links.seunome.com"
            autoFocus
            autoCapitalize="none"
            spellCheck={false}
            className="w-full h-11 px-3 rounded-lg bg-bee-bg border border-white/10 font-mono text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-bee-pink/50"
          />
          <p className="text-xs text-bee-muted">
            Só o domínio, sem <span className="font-mono">https://</span> e sem barra.
          </p>
          <button
            type="submit"
            disabled={salvando || !host.trim()}
            className="w-full h-11 rounded-lg bg-bee-pink hover:bg-bee-pink-hot text-white text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
            Adicionar
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Remover({
  dominio,
  onFechar,
  onRemovido,
}: {
  dominio: ApiCustomDomain | null;
  onFechar: () => void;
  onRemovido: (id: string) => void;
}) {
  const [removendo, setRemovendo] = useState(false);

  const remover = async () => {
    if (!dominio) return;
    setRemovendo(true);
    try {
      await api.removeCustomDomain(dominio.id);
      onRemovido(dominio.id);
      toast.success("Domínio removido.");
      onFechar();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "Não foi possível remover.");
    } finally {
      setRemovendo(false);
    }
  };

  return (
    <Dialog open={dominio !== null} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="bg-bee-surface border-white/10 max-w-md">
        <DialogTitle className="text-white">Remover {dominio?.host}?</DialogTitle>
        <p className="text-sm text-bee-muted">
          {dominio && dominio.paginas > 0
            ? `${dominio.paginas === 1 ? "A página que usa" : `As ${dominio.paginas} páginas que usam`} este domínio voltam ao domínio padrão, e os links com ${dominio.host} param de abrir.`
            : "A vaga fica livre para outro domínio."}
        </p>
        <button
          onClick={remover}
          disabled={removendo}
          className="w-full h-11 rounded-lg bg-red-500/90 hover:bg-red-500 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {removendo && <Loader2 className="w-4 h-4 animate-spin" />}
          Remover
        </button>
      </DialogContent>
    </Dialog>
  );
}
