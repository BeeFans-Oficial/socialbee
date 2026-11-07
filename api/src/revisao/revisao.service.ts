import { createHash } from "node:crypto";

import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";

import { EmailService } from "../common/email/email.service";
import { revisaoPiorou } from "../common/email/modelos/revisao-piorou";
import { loadEnv } from "../config/env";
import { classificarHost, NOME_DA_CLASSE, TERMOS_PROIBIDOS_NA_HOME, type ClasseDeHost } from "./hosts-conhecidos";

/**
 * Simulador da revisão da Meta.
 *
 * Quando um link entra na bio, a Meta abre a página com várias identidades
 * no mesmo segundo, compara o que cada uma recebeu, clica nos botões com um
 * navegador de verdade e vai até o destino final (`docs/incidente-meta-
 * 2026-10-15.md`). Este serviço faz o mesmo percurso, do nosso lado, antes
 * de a criadora colar o link — e compara o que vê com o que derrubou e com o
 * que poupou contas naquele dia.
 *
 * Quatro verificações, nessa ordem de evidência:
 *
 *   1. **Consistência.** O mesmo documento para todas as identidades e o
 *      mesmo salto no `/r/`. É o cloaking das duas primeiras quedas; hoje o
 *      código garante igualdade, e isto é o alarme para o dia em que alguém
 *      quebrar isso sem perceber.
 *   2. **Destinos.** Para onde cada botão leva depois de todos os saltos.
 *      Checkout adulto no fim foi o que derrubou as quedas 3 e 4, com HTML
 *      idêntico.
 *   3. **Barreira 18+.** Na única página que sobreviveu, a Meta viu a
 *      confirmação de idade e não clicou. É a única regra com evidência
 *      direta de "ficou no ar".
 *   4. **Domínio.** HTTPS responde, a página existe, a home não voltou a
 *      dizer o que foi tirado em 15/10, e o tráfego de dentro do Instagram
 *      por esse host não secou (o único sinal, indireto, de domínio marcado).
 *
 * Verde não é "a Meta aprovou": é "a página está no estado da que
 * sobreviveu, sem nenhuma condição das que caíram". O serviço não executa
 * JavaScript como o Safari da Meta nem consulta a Meta — não há API para
 * isso — e diz as duas coisas no relatório.
 *
 * `buscar` é uma propriedade, não um import: o teste de ponta a ponta troca
 * por um servidor de mentira e exercita cada veredito sem rede.
 */

export type Estado = "verde" | "amarelo" | "vermelho" | "neutro";
export type Veredito = "verde" | "amarelo" | "vermelho";
export type Gatilho = "manual" | "cron";

export interface ItemDaRevisao {
  chave: "consistencia" | "destinos" | "barreira" | "dominio";
  estado: Estado;
  titulo: string;
  detalhe: string;
  /** O que a criadora faz para resolver. Vazio quando está tudo certo. */
  acao?: string;
  /** Evidência por link, por identidade etc., para a tela detalhar. */
  dados?: Record<string, unknown>;
}

export interface Revisao {
  id: string;
  profileId: string;
  veredito: Veredito;
  trigger: Gatilho;
  itens: ItemDaRevisao[];
  ranAt: string;
  /** O que o simulador não cobre, repetido em toda rodada. */
  limites: string[];
}

/** A checagem instantânea de um link só, na tela de Links. Sem histórico. */
export interface VerificacaoDeLink {
  estado: Exclude<Estado, "neutro">;
  titulo: string;
  detalhe: string;
  acao?: string;
  cadeia: { saltos: string[]; destino: string; classe: ClasseDeHost; erro: string | null; observacao: string | null };
  paginaAdulta: boolean;
}

export interface RevisaoPendente {
  profileId: string;
  slug: string;
  host: string;
  veredito: Veredito;
  ranAt: string;
  userId: string;
  email: string;
}

type Buscar = (url: string, init?: RequestInit) => Promise<Response>;

interface PaginaParaRevisar {
  id: string;
  userId: string;
  slug: string;
  host: string;
  isAdult: boolean;
  published: boolean;
  links: { id: string; title: string; shortCode: string; destinationUrl: string }[];
  /** Domínio do pool em que ela está, se houver linha; nulo no host padrão. */
  dominio: { active: boolean; status: string; proprio: boolean } | null;
}

/** As identidades vistas nos logs de 15/10, uma de cada grupo. */
export const IDENTIDADES: { nome: string; userAgent: string; humano: boolean }[] = [
  { nome: "Crawler da Meta", userAgent: "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)", humano: false },
  { nome: "Agente da Meta", userAgent: "meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)", humano: false },
  {
    nome: "Safari de iPhone",
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    humano: true,
  },
  {
    nome: "Chrome no Windows",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    humano: true,
  },
  {
    nome: "App do Instagram",
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0.0.0 (iPhone14,5; iOS 17_5; pt_BR; pt-BR; scale=3.00; 1170x2532; 500000000)",
    humano: true,
  },
];

const CABECALHOS_HUMANOS = {
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "pt-BR,pt;q=0.9,en;q=0.8",
};

export const LIMITES_DO_SIMULADOR = [
  "Não executa JavaScript como o Safari da Meta; compara o documento que o servidor entrega.",
  "Não consulta a Meta: não existe API que diga se um domínio está marcado. O sinal de domínio é indireto, pelo tráfego.",
  "Não enxerga aparelho nem rede: contas coladas do mesmo celular caem em cadeia, e isso não aparece aqui.",
];

const TEMPO_LIMITE_MS = 8_000;
const SALTOS_MAXIMOS = 6;

@Injectable()
export class RevisaoService {
  private readonly logger = new Logger(RevisaoService.name);

  /** Trocável no teste. Em produção é o `fetch` do Node. */
  buscar: Buscar = (url, init) => fetch(url, init);

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly emails: EmailService,
  ) {}

  /** A criadora pediu. A página precisa ser dela. */
  async revisar(userId: string, profileId: string, trigger: Gatilho = "manual"): Promise<Revisao> {
    const pagina = await this.carregar(profileId, userId);
    if (!pagina) throw new NotFoundException({ code: "pagina_nao_encontrada", message: "Página não encontrada." });
    return this.executarEGuardar(pagina, trigger);
  }

  async ultima(userId: string, profileId: string): Promise<Revisao | null> {
    const pagina = await this.carregar(profileId, userId);
    if (!pagina) throw new NotFoundException({ code: "pagina_nao_encontrada", message: "Página não encontrada." });
    return this.ultimaDe(profileId);
  }

  /** Todas as rodadas da página, da mais recente para a mais antiga. */
  async historico(userId: string, profileId: string, limite = 50): Promise<Revisao[]> {
    const pagina = await this.carregar(profileId, userId);
    if (!pagina) throw new NotFoundException({ code: "pagina_nao_encontrada", message: "Página não encontrada." });
    const linhas = await this.db.query<{ id: string; verdict: Veredito; trigger: Gatilho; items: ItemDaRevisao[]; ran_at: Date }[]>(
      `SELECT id, verdict, trigger, items, ran_at FROM page_reviews WHERE profile_id = $1 ORDER BY ran_at DESC LIMIT $2`,
      [profileId, Math.min(Math.max(limite, 1), 200)],
    );
    return linhas.map((r) => ({ id: r.id, profileId, veredito: r.verdict, trigger: r.trigger, itens: r.items, ranAt: new Date(r.ran_at).toISOString(), limites: LIMITES_DO_SIMULADOR }));
  }

  /** Para o admin: a última revisão de cada página que não está verde. */
  async pendentes(): Promise<RevisaoPendente[]> {
    const linhas = await this.db.query<
      { profile_id: string; slug: string; host: string | null; verdict: Veredito; ran_at: Date; user_id: string; email: string }[]
    >(`
      SELECT DISTINCT ON (r.profile_id) r.profile_id, p.slug, d.host, r.verdict, r.ran_at, p.user_id, u.email
        FROM page_reviews r
        JOIN profiles p ON p.id = r.profile_id
        JOIN users u ON u.id = p.user_id
        LEFT JOIN domains d ON d.id = p.domain_id
       ORDER BY r.profile_id, r.ran_at DESC
    `);
    return linhas
      .filter((l) => l.verdict !== "verde")
      .sort((a, b) => (a.verdict === "vermelho" ? -1 : 1) - (b.verdict === "vermelho" ? -1 : 1) || b.ran_at.getTime() - a.ran_at.getTime())
      .map((l) => ({
        profileId: l.profile_id,
        slug: l.slug,
        host: l.host ?? hostPadrao(),
        veredito: l.verdict,
        ranAt: new Date(l.ran_at).toISOString(),
        userId: l.user_id,
        email: l.email,
      }));
  }

  /**
   * A madrugada revisa toda página no ar. Quem estava verde ou amarelo e
   * ficou vermelha recebe o e-mail; a primeira rodada de uma página só
   * registra, sem avisar — ninguém precisa acordar com um alerta de algo
   * que já estava assim há semanas.
   */
  @Cron("0 5 * * *", { timeZone: "America/Sao_Paulo" })
  async rodarDeMadrugada(): Promise<void> {
    const ids = await this.db.query<{ id: string }[]>(`SELECT id FROM profiles WHERE published ORDER BY created_at`);
    this.logger.log(`revisão da madrugada: ${ids.length} página(s)`);
    const fila = [...ids];
    const trabalhar = async () => {
      for (let item = fila.shift(); item; item = fila.shift()) {
        try {
          const pagina = await this.carregar(item.id);
          if (!pagina) continue;
          const anterior = await this.ultimaDe(pagina.id);
          const atual = await this.executarEGuardar(pagina, "cron");
          if (anterior && anterior.veredito !== "vermelho" && atual.veredito === "vermelho") {
            await this.avisarQuePiorou(pagina, atual);
          }
        } catch (error) {
          this.logger.warn(`revisão de ${item.id} falhou: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    };
    await Promise.all([trabalhar(), trabalhar(), trabalhar()]);
  }

  /**
   * Um link só, como o navegador da Meta o seguiria. É o item "destinos" da
   * revisão, para um botão, na hora e sem gravar nada: a revisão da página
   * continua sendo o registro.
   */
  async verificarLink(userId: string, linkId: string): Promise<VerificacaoDeLink> {
    const [l] = await this.db.query<
      { id: string; title: string; short_code: string; destination_url: string; is_adult: boolean; host: string | null }[]
    >(
      `
      SELECT l.id, l.title, l.short_code, l.destination_url, p.is_adult, d.host
        FROM links l
        JOIN profiles p ON p.id = l.profile_id
        LEFT JOIN domains d ON d.id = p.domain_id
       WHERE l.id = $1 AND p.user_id = $2
      `,
      [linkId, userId],
    );
    if (!l) throw new NotFoundException({ code: "link_nao_encontrado", message: "Link não encontrado." });
    const host = l.host ?? hostPadrao();
    const cadeia = await this.seguirCadeia(
      `${esquemaDe(host)}://${host}/r/${l.short_code}`,
      { id: l.id, title: l.title, shortCode: l.short_code, destinationUrl: l.destination_url },
      await this.hostsDaPlataforma(),
    );
    const base = {
      cadeia: { saltos: cadeia.hosts, destino: cadeia.hostFinal, classe: cadeia.classe, erro: cadeia.erro ?? null, observacao: cadeia.observacao ?? null },
      paginaAdulta: l.is_adult,
    };
    const saltos = cadeia.hosts.length === 1 ? "1 salto" : `${cadeia.hosts.length} saltos`;
    if (cadeia.erro) {
      return { ...base, estado: "vermelho", titulo: "Não chega a lugar nenhum", detalhe: `A Meta seguiu e não achou: ${cadeia.erro}.`, acao: "Confira o endereço de destino." };
    }
    if (cadeia.classe === "checkout_adulto" && !l.is_adult) {
      return {
        ...base,
        estado: "vermelho",
        titulo: `Leva direto a ${cadeia.hostFinal} (checkout adulto)`,
        detalhe: `Sem a barreira 18+ na página, o navegador da Meta clica e chega lá. Foi isso que derrubou as contas em 15/10.`,
        acao: "Ligue a barreira 18+ na página, ou leve primeiro a um mensageiro.",
      };
    }
    if (cadeia.passaPelaPlataforma) {
      return {
        ...base,
        estado: "amarelo",
        titulo: "Passa por outro endereço do BeeSocial",
        detalhe: `${cadeia.hosts.join(" → ")}. Se um domínio da cadeia estiver marcado, o seu cai junto.`,
        acao: "Aponte direto para o destino final.",
      };
    }
    return {
      ...base,
      estado: "verde",
      titulo: `Chega em ${cadeia.hostFinal} (${NOME_DA_CLASSE[cadeia.classe]}) em ${saltos}`,
      detalhe:
        cadeia.classe === "checkout_adulto"
          ? "Destino adulto atrás da barreira 18+ da página: a Meta vê a confirmação e não clica."
          : (cadeia.observacao ?? "O destino respondeu."),
    };
  }

  // ------------------------------------------------------------------ miolo

  async executarEGuardar(pagina: PaginaParaRevisar, trigger: Gatilho): Promise<Revisao> {
    const itens = await this.executar(pagina);
    const veredito = vereditoDe(itens);
    const [linha] = await this.db.query<{ id: string; ran_at: Date }[]>(
      `INSERT INTO page_reviews (profile_id, verdict, trigger, items) VALUES ($1, $2, $3, $4::jsonb) RETURNING id, ran_at`,
      [pagina.id, veredito, trigger, JSON.stringify(itens)],
    );
    this.logger.log(`revisão ${trigger} de ${pagina.host}/${pagina.slug}: ${veredito}`);
    return { id: linha.id, profileId: pagina.id, veredito, trigger, itens, ranAt: new Date(linha.ran_at).toISOString(), limites: LIMITES_DO_SIMULADOR };
  }

  /** As quatro verificações. Toda requisição tem teto de tempo e nenhuma
   *  falha derruba a rodada: vira item vermelho com o motivo. */
  async executar(pagina: PaginaParaRevisar): Promise<ItemDaRevisao[]> {
    const base = `${esquemaDe(pagina.host)}://${pagina.host}`;
    const urlDaPagina = `${base}/${pagina.slug}`;
    const hostsDaPlataforma = await this.hostsDaPlataforma();

    // Página e redirecionadores, com todas as identidades, em paralelo.
    const respostas = await Promise.all(
      IDENTIDADES.map(async (identidade) => {
        const pagina_ = await this.pedir(urlDaPagina, identidade.userAgent, identidade.humano);
        const saltos = await Promise.all(
          pagina.links.map(async (link) => {
            const r = await this.pedir(`${base}/r/${link.shortCode}`, identidade.userAgent, identidade.humano);
            return { shortCode: link.shortCode, status: r.status, location: r.location };
          }),
        );
        return { identidade: identidade.nome, pagina: pagina_, saltos };
      }),
    );

    const itens: ItemDaRevisao[] = [];
    itens.push(this.itemDeConsistencia(respostas));

    const cadeias = await Promise.all(pagina.links.map((link) => this.seguirCadeia(`${base}/r/${link.shortCode}`, link, hostsDaPlataforma)));
    const destinos = this.itemDeDestinos(pagina, cadeias);
    itens.push(destinos);
    itens.push(this.itemDeBarreira(pagina, cadeias, respostas));
    itens.push(await this.itemDeDominio(pagina, base, respostas));
    return itens;
  }

  private itemDeConsistencia(respostas: { identidade: string; pagina: Resposta; saltos: { shortCode: string; status: number; location: string | null }[] }[]): ItemDaRevisao {
    const responderam = respostas.filter((r) => r.pagina.status > 0);
    if (responderam.length === 0) {
      return { chave: "consistencia", estado: "vermelho", titulo: "A página não respondeu", detalhe: "Nenhuma identidade conseguiu abrir a página.", acao: "Confira se a página está no ar e tente de novo." };
    }
    const assinaturas = new Map<string, string[]>();
    for (const r of responderam) {
      const chave = `${r.pagina.status}|${r.pagina.location ?? ""}|${hash(normalizarHtml(r.pagina.corpo))}|${r.saltos.map((s) => `${s.status}>${s.location ?? ""}`).join(",")}`;
      assinaturas.set(chave, [...(assinaturas.get(chave) ?? []), r.identidade]);
    }
    const dados = { identidades: responderam.map((r) => ({ nome: r.identidade, status: r.pagina.status, bytes: r.pagina.corpo.length })) };
    if (assinaturas.size === 1) {
      return {
        chave: "consistencia",
        estado: "verde",
        titulo: "Todas as identidades receberam a mesma página",
        detalhe: `${responderam.length} identidades (crawler, agente, Safari, Chrome e app do Instagram) receberam o mesmo documento e o mesmo salto em cada botão.`,
        dados,
      };
    }
    const grupos = [...assinaturas.values()].map((g) => g.join(", "));
    return {
      chave: "consistencia",
      estado: "vermelho",
      titulo: "Identidades diferentes receberam páginas diferentes",
      detalhe: `A Meta compara as versões, e isto é o que ela chama de cloaking. Grupos que receberam o mesmo documento: ${grupos.join(" · ")}.`,
      acao: "Isso é defeito do produto, não da sua página. Avise a equipe.",
      dados: { ...dados, grupos },
    };
  }

  private itemDeDestinos(pagina: PaginaParaRevisar, cadeias: Cadeia[]): ItemDaRevisao {
    if (cadeias.length === 0) {
      return { chave: "destinos", estado: "neutro", titulo: "Sem botões ainda", detalhe: "A página não tem links ativos para a Meta seguir.", dados: { links: [] } };
    }
    const adultos = cadeias.filter((c) => c.classe === "checkout_adulto");
    const pelaPlataforma = cadeias.filter((c) => c.passaPelaPlataforma);
    const quebrados = cadeias.filter((c) => c.erro);
    const dados = { links: cadeias.map((c) => ({ titulo: c.titulo, destino: c.hostFinal, classe: c.classe, saltos: c.hosts, erro: c.erro ?? null, observacao: c.observacao ?? null })) };

    if (quebrados.length > 0) {
      return {
        chave: "destinos",
        estado: "vermelho",
        titulo: `${quebrados.length === 1 ? "Um botão não chega" : `${quebrados.length} botões não chegam`} a lugar nenhum`,
        detalhe: `A Meta seguiu e não achou: ${quebrados.map((c) => `"${c.titulo}" (${c.erro})`).join("; ")}.`,
        acao: "Confira o destino desses links em Links.",
        dados,
      };
    }
    if (adultos.length > 0 && !pagina.isAdult) {
      return {
        chave: "destinos",
        estado: "vermelho",
        titulo: `${adultos.length === 1 ? "Um botão leva" : `${adultos.length} botões levam`} direto a um checkout adulto`,
        detalhe: `Sem a barreira 18+, o navegador da Meta clica e chega em ${adultos.map((c) => c.hostFinal).join(", ")}. Foi isso que derrubou as contas em 15/10.`,
        acao: "Ligue a barreira 18+ nesta página, ou leve primeiro a um mensageiro (Telegram, WhatsApp).",
        dados,
      };
    }
    if (pelaPlataforma.length > 0) {
      return {
        chave: "destinos",
        estado: "amarelo",
        titulo: "Um botão passa por outro endereço do BeeSocial",
        detalhe: `${pelaPlataforma.map((c) => `"${c.titulo}" → ${c.hosts.join(" → ")}`).join("; ")}. Se um domínio da cadeia estiver marcado, o seu cai junto: foi a cadeia da terceira queda.`,
        acao: "Aponte o botão direto para o destino final, sem passar por outra página do BeeSocial.",
        dados,
      };
    }
    const resumo = cadeias.map((c) => `"${c.titulo}" → ${c.hostFinal} (${NOME_DA_CLASSE[c.classe]})`).join("; ");
    return {
      chave: "destinos",
      estado: "verde",
      titulo: adultos.length > 0 ? "Destinos adultos atrás da barreira 18+" : "Nenhum botão leva a checkout adulto",
      detalhe: resumo,
      dados,
    };
  }

  private itemDeBarreira(pagina: PaginaParaRevisar, cadeias: Cadeia[], respostas: { identidade: string; pagina: Resposta }[]): ItemDaRevisao {
    const temAdulto = cadeias.some((c) => c.classe === "checkout_adulto");
    if (!pagina.isAdult) {
      return temAdulto
        ? {
            chave: "barreira",
            estado: "vermelho",
            titulo: "Barreira 18+ desligada com destino adulto",
            detalhe: "Com a confirmação de idade na frente, o navegador da Meta não clica em nada. As contas que caíram em 15/10 não tinham barreira; a que ficou no ar tinha.",
            acao: "Ligue a confirmação de 18+ em Proteção.",
            dados: { ligada: false, destinosAdultos: cadeias.filter((c) => c.classe === "checkout_adulto").map((c) => c.hostFinal), vazaram: [] },
          }
        : {
            chave: "barreira",
            estado: "neutro",
            titulo: "Barreira 18+ desligada",
            detalhe: "Sem destino adulto nos botões, a barreira é opcional.",
            dados: { ligada: false, destinosAdultos: [], vazaram: [] },
          };
    }
    // Ligada: os códigos dos botões não podem estar no documento antes da confirmação.
    const vazaram = new Set<string>();
    for (const r of respostas) {
      if (r.pagina.status <= 0) continue;
      for (const link of pagina.links) if (r.pagina.corpo.includes(`/r/${link.shortCode}`)) vazaram.add(link.title);
    }
    if (vazaram.size > 0) {
      return {
        chave: "barreira",
        estado: "vermelho",
        titulo: "A barreira está ligada, mas os botões estão no documento",
        detalhe: `Links visíveis antes da confirmação: ${[...vazaram].join(", ")}. A Meta não precisa clicar na barreira para achá-los.`,
        acao: "Isso é defeito do produto. Avise a equipe.",
        dados: { ligada: true, destinosAdultos: cadeias.filter((c) => c.classe === "checkout_adulto").map((c) => c.hostFinal), vazaram: [...vazaram] },
      };
    }
    return {
      chave: "barreira",
      estado: "verde",
      titulo: "Barreira 18+ ligada e botões fora do documento",
      detalhe: "Quem abre a página vê só a confirmação de idade; os botões só entram depois do toque. Foi a diferença entre a conta que ficou e as que caíram.",
      dados: { ligada: true, destinosAdultos: cadeias.filter((c) => c.classe === "checkout_adulto").map((c) => c.hostFinal), vazaram: [] },
    };
  }

  private async itemDeDominio(pagina: PaginaParaRevisar, base: string, respostas: { identidade: string; pagina: Resposta }[]): Promise<ItemDaRevisao> {
    const humano = respostas.find((r) => r.identidade === "Safari de iPhone")?.pagina;
    if (!humano || humano.status <= 0) {
      return { chave: "dominio", estado: "vermelho", titulo: `${pagina.host} não respondeu`, detalhe: humano?.erro ?? "Sem resposta.", acao: "Confira o domínio e o certificado. Se o endereço é do pool, avise a equipe.", dados: { host: pagina.host, status: 0 } };
    }
    if (humano.status >= 400) {
      return {
        chave: "dominio",
        estado: "vermelho",
        titulo: `A página respondeu ${humano.status}`,
        detalhe: humano.status === 404 ? "Link com erro serviu \"não encontrado\" para a Meta em 15/10 e virou suspeita." : "A Meta recebeu um erro no lugar da página.",
        acao: pagina.published ? "Confira o endereço da página." : "A página está fora do ar. Coloque no ar antes de colar o link.",
        dados: { host: pagina.host, status: humano.status },
      };
    }

    const avisos: string[] = [];
    const dados: Record<string, unknown> = { host: pagina.host, status: humano.status, dominioPausado: Boolean(pagina.dominio && !pagina.dominio.proprio && (!pagina.dominio.active || pagina.dominio.status !== "active")) };

    // Pool: domínio pausado sai do sorteio, mas a página continua nele.
    if (pagina.dominio && !pagina.dominio.proprio && (!pagina.dominio.active || pagina.dominio.status !== "active")) {
      avisos.push("este endereço foi pausado pela equipe; troque de domínio em Página");
    }

    // A home do domínio: o que foi tirado em 15/10 não pode voltar.
    const home = await this.pedir(`${base}/`, IDENTIDADES[0].userAgent, false);
    if (home.status > 0 && home.status < 400) {
      const texto = extrairTexto(home.corpo);
      const achados = TERMOS_PROIBIDOS_NA_HOME.filter((t) => texto.includes(t));
      if (achados.length > 0) {
        avisos.push(`a home de ${pagina.host} diz "${achados.join('", "')}", que a Meta lê como anúncio de cloaking`);
        dados.termosNaHome = achados;
      }
    }

    // Tráfego de dentro do Instagram por este host: a única pista de bloqueio.
    const [t] = await this.db.query<{ atual: string; anterior: string }[]>(
      `
      SELECT count(*) FILTER (WHERE occurred_at > now() - interval '7 days') AS atual,
             count(*) FILTER (WHERE occurred_at <= now() - interval '7 days' AND occurred_at > now() - interval '14 days') AS anterior
        FROM tracking_events
       WHERE arrival_host = $1 AND type = 'view' AND client->>'inAppBrowser' = 'instagram'
      `,
      [pagina.host],
    );
    const atual = Number(t?.atual ?? 0);
    const anterior = Number(t?.anterior ?? 0);
    dados.visitasDoInstagram = { ultimos7: atual, anteriores7: anterior };
    if (anterior >= 20 && atual < anterior * 0.2) {
      avisos.push(`as visitas vindas de dentro do Instagram por ${pagina.host} caíram de ${anterior} para ${atual} em uma semana — é como um domínio bloqueado aparece`);
    }

    if (avisos.length > 0) {
      return { chave: "dominio", estado: "amarelo", titulo: `${pagina.host} responde, mas com sinais de alerta`, detalhe: avisos.join(". ") + ".", acao: "Considere trocar o domínio da página em Página, e avise a equipe.", dados };
    }
    return {
      chave: "dominio",
      estado: "verde",
      titulo: `${pagina.host} responde em HTTPS e a home está limpa`,
      detalhe: anterior >= 20 ? `Visitas de dentro do Instagram por este endereço: ${atual} nos últimos 7 dias, ${anterior} nos 7 anteriores.` : "Ainda não há volume de visitas do Instagram por este endereço para medir tendência.",
      dados,
    };
  }

  /**
   * Segue o `/r/` como o Safari da Meta, sem JavaScript, até o host final.
   *
   * O que importa é ONDE a cadeia termina, não como o destino nos atende: a
   * Privacy responde 403 a um servidor que não é navegador, e nem por isso a
   * Meta deixa de chegar lá. Erro só conta quando é nosso (o `/r/` falha ou
   * não redireciona) ou quando o destino é desconhecido e não responde.
   */
  private async seguirCadeia(inicio: string, link: PaginaParaRevisar["links"][number], hostsDaPlataforma: string[]): Promise<Cadeia> {
    const hosts: string[] = [];
    let url = inicio;
    let erro: string | undefined;
    let observacao: string | undefined;
    for (let salto = 0; salto < SALTOS_MAXIMOS; salto += 1) {
      const hostAtual = new URL(url).host;
      const naPlataforma = salto === 0 || classificarHost(hostAtual, hostsDaPlataforma) === "plataforma";
      const r = await this.pedir(url, IDENTIDADES[2].userAgent, true);
      if (r.status <= 0) {
        if (naPlataforma) erro = r.erro ?? "não respondeu";
        else observacao = `${hostAtual} não respondeu ao nosso servidor (${r.erro ?? "sem resposta"})`;
        break;
      }
      if (r.status >= 300 && r.status < 400 && r.location) {
        try {
          url = new URL(r.location, url).toString();
        } catch {
          erro = "redirecionamento inválido";
          break;
        }
        hosts.push(new URL(url).host);
        continue;
      }
      if (r.status >= 400) {
        if (naPlataforma) erro = `respondeu ${r.status}`;
        else observacao = `${hostAtual} respondeu ${r.status} ao nosso servidor; a Meta chega com navegador de verdade`;
      }
      break;
    }
    if (hosts.length === 0 && !erro) erro = "não redirecionou";
    const hostFinal = hosts[hosts.length - 1] ?? "";
    const classe = hostFinal ? classificarHost(hostFinal, hostsDaPlataforma) : "desconhecido";
    // Destino desconhecido que não responde: a Meta também não chega. Vale aviso.
    if (!erro && classe === "desconhecido" && observacao?.includes("não respondeu")) erro = observacao;
    const passaPelaPlataforma = hosts.slice(0, -1).some((h) => classificarHost(h, hostsDaPlataforma) === "plataforma") || (classe === "plataforma" && hosts.length > 0);
    return { titulo: link.title, shortCode: link.shortCode, hosts, hostFinal, classe, passaPelaPlataforma, erro, observacao };
  }

  private async pedir(url: string, userAgent: string, humano: boolean): Promise<Resposta> {
    try {
      const r = await this.buscar(url, {
        method: "GET",
        redirect: "manual",
        headers: { "user-agent": userAgent, ...(humano ? CABECALHOS_HUMANOS : {}) },
        signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
      });
      const corpo = r.status >= 300 && r.status < 400 ? "" : await r.text();
      return { status: r.status, location: r.headers.get("location"), corpo };
    } catch (error) {
      return { status: 0, location: null, corpo: "", erro: error instanceof Error ? error.message : String(error) };
    }
  }

  private async hostsDaPlataforma(): Promise<string[]> {
    const linhas = await this.db.query<{ host: string }[]>(`SELECT host FROM domains WHERE owner_user_id IS NULL`);
    return [hostPadrao(), ...linhas.map((l) => l.host)];
  }

  private async carregar(profileId: string, userId?: string): Promise<PaginaParaRevisar | null> {
    const [p] = await this.db.query<
      { id: string; user_id: string; slug: string; is_adult: boolean; published: boolean; host: string | null; active: boolean | null; status: string | null; owner_user_id: string | null }[]
    >(
      `
      SELECT p.id, p.user_id, p.slug, p.is_adult, p.published, d.host, d.active, d.status, d.owner_user_id
        FROM profiles p
        LEFT JOIN domains d ON d.id = p.domain_id
       WHERE p.id = $1 ${userId ? "AND p.user_id = $2" : ""}
      `,
      userId ? [profileId, userId] : [profileId],
    );
    if (!p) return null;
    const links = await this.db.query<{ id: string; title: string; short_code: string; destination_url: string }[]>(
      `SELECT id, title, short_code, destination_url FROM links WHERE profile_id = $1 AND is_active ORDER BY position`,
      [profileId],
    );
    return {
      id: p.id,
      userId: p.user_id,
      slug: p.slug,
      host: p.host ?? hostPadrao(),
      isAdult: p.is_adult,
      published: p.published,
      links: links.map((l) => ({ id: l.id, title: l.title, shortCode: l.short_code, destinationUrl: l.destination_url })),
      dominio: p.host ? { active: Boolean(p.active), status: p.status ?? "active", proprio: p.owner_user_id !== null } : null,
    };
  }

  private async ultimaDe(profileId: string): Promise<Revisao | null> {
    const [r] = await this.db.query<{ id: string; verdict: Veredito; trigger: Gatilho; items: ItemDaRevisao[]; ran_at: Date }[]>(
      `SELECT id, verdict, trigger, items, ran_at FROM page_reviews WHERE profile_id = $1 ORDER BY ran_at DESC LIMIT 1`,
      [profileId],
    );
    if (!r) return null;
    return { id: r.id, profileId, veredito: r.verdict, trigger: r.trigger, itens: r.items, ranAt: new Date(r.ran_at).toISOString(), limites: LIMITES_DO_SIMULADOR };
  }

  private async avisarQuePiorou(pagina: PaginaParaRevisar, revisao: Revisao): Promise<void> {
    const [u] = await this.db.query<{ email: string; nome: string | null }[]>(
      `SELECT u.email, (SELECT display_name FROM profiles WHERE id = $2) AS nome FROM users u WHERE u.id = $1`,
      [pagina.userId, pagina.id],
    );
    if (!u) return;
    const env = loadEnv();
    await this.emails.enviar(
      revisaoPiorou({
        para: u.email,
        nome: u.nome,
        slug: pagina.slug,
        host: pagina.host,
        problemas: revisao.itens.filter((i) => i.estado === "vermelho").map((i) => ({ titulo: i.titulo, acao: i.acao ?? "" })),
        linkDoEditor: `${env.publicSiteUrl}/paginas/${pagina.id}`,
        siteUrl: env.publicSiteUrl,
      }),
    );
  }
}

interface Resposta {
  status: number;
  location: string | null;
  corpo: string;
  erro?: string;
}

interface Cadeia {
  titulo: string;
  shortCode: string;
  hosts: string[];
  hostFinal: string;
  classe: ClasseDeHost;
  passaPelaPlataforma: boolean;
  erro?: string;
  /** Algo que não é erro, mas vale registrar. */
  observacao?: string;
}

/** Vermelho manda; amarelo depois; o resto é verde. `neutro` não pesa. */
export function vereditoDe(itens: ItemDaRevisao[]): Veredito {
  if (itens.some((i) => i.estado === "vermelho")) return "vermelho";
  if (itens.some((i) => i.estado === "amarelo")) return "amarelo";
  return "verde";
}

/**
 * O documento sem o que muda entre duas requisições iguais: nonces de CSP,
 * scripts (o payload do React carrega ids de stream), comentários e espaço
 * em branco. O que sobra é o que a pessoa — e a Meta — veem.
 *
 * O Next decide pelo user-agent se os metadados vão em streaming (humano) ou
 * bloqueantes (robô da lista `htmlLimitedBots`), e no primeiro caso deixa um
 * `<div hidden><!--$--><!--/$--></div>` no topo do body. É estrutura do
 * framework, não conteúdo: o mesmo `<title>` e as mesmas `<meta>` chegam nos
 * dois casos, só em posições diferentes. Por isso comentários e `div`s
 * vazias escondidas saem antes da comparação.
 */
export function normalizarHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\snonce="[^"]*"/g, "")
    .replace(/<link\b[^>]*rel="preload"[^>]*>/gi, "")
    .replace(/<div hidden(?:="")?>\s*<\/div>/gi, "")
    .replace(/\s+/g, " ")
    .replace(/>\s+</g, "><")
    .trim();
}

/** Só o texto visível, minúsculo, para procurar termos na home. */
export function extrairTexto(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function hash(valor: string): string {
  return createHash("sha256").update(valor).digest("hex");
}

function esquemaDe(host: string): "http" | "https" {
  return /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(host) || /\.local(:\d+)?$/.test(host) ? "http" : "https";
}

function hostPadrao(): string {
  return loadEnv().publicSiteUrl.replace(/^https?:\/\//, "").replace(/\/+$/, "");
}
