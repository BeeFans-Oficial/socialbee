"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { api, ApiError } from "@/lib/api/client";
import type { ReportParams, ReportResponse } from "@/lib/api/types";

/**
 * O relatório do Analytics: busca, guarda e sabe buscar de novo.
 *
 * Busca sozinho quando os parâmetros mudam (um filtro, a janela) e de novo
 * quando alguém chama `recarregar` — o botão da tela, sem recarregar a página.
 * Enquanto a busca nova não chega, os números antigos continuam em `data`: a
 * tela apaga um pouco em vez de piscar o esqueleto.
 *
 * Duas buscas podem se cruzar (trocar o filtro e recarregar em seguida). Só a
 * última pedida grava o resultado; a resposta atrasada da anterior é
 * descartada, senão o relatório mostraria um recorte que já não é o da tela.
 *
 * @param params `null` enquanto a janela não é válida (datas pela metade).
 * @param ativo  `false` quando já se sabe que a conta não tem relatório.
 */
export function useRelatorio(params: ReportParams | null, ativo: boolean) {
  const router = useRouter();
  const [data, setData] = useState<ReportResponse | null>(null);
  /** Título por id de link, para as tabelas não mostrarem UUID cru. */
  const [linkTitles, setLinkTitles] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** A API recusou por plano: a página abriu antes de a sessão dizer que é Free. */
  const [recusadoPeloPlano, setRecusadoPeloPlano] = useState(false);
  /** Quando os dados da tela chegaram. */
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);
  const pedido = useRef(0);

  const buscar = useCallback(
    async (p: ReportParams) => {
      const meu = ++pedido.current;
      setLoading(true);
      setError(null);
      try {
        // Relatório e títulos juntos: são duas leituras independentes e a
        // tabela precisa das duas para significar algo.
        const [report, links] = await Promise.all([api.report(p), api.links()]);
        if (meu !== pedido.current) return;
        setData(report);
        setLinkTitles(new Map(links.map((link) => [link.id, link.title])));
        setAtualizadoEm(new Date());
      } catch (caught) {
        if (meu !== pedido.current) return;
        if (caught instanceof ApiError && caught.isUnauthorized) {
          router.replace("/login?de=/analytics");
          return;
        }
        if (caught instanceof ApiError && caught.code === "plano_pro_necessario") {
          setRecusadoPeloPlano(true);
          return;
        }
        setError(caught instanceof ApiError ? caught.message : "falha desconhecida");
      } finally {
        if (meu === pedido.current) setLoading(false);
      }
    },
    [router],
  );

  useEffect(() => {
    if (!ativo || recusadoPeloPlano || !params) return;
    void buscar(params);
  }, [params, buscar, ativo, recusadoPeloPlano]);

  const recarregar = useCallback(() => {
    if (ativo && params) void buscar(params);
  }, [ativo, params, buscar]);

  return { data, linkTitles, loading, error, recusadoPeloPlano, atualizadoEm, recarregar };
}
