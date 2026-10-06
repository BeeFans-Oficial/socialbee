import { resolve4 } from "node:dns/promises";

import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { loadEnv } from "../config/env";
import { PLANOS, exigirPro, type PlanoId } from "../plans/plans";
import { Domain } from "./entities/domain.entity";
import { Profile } from "./entities/profile.entity";
import { hostPadrao } from "./profiles.service";

export interface CustomDomainView {
  id: string;
  host: string;
  status: "pending" | "active";
  /** Quantas páginas da conta estão servidas por ele. */
  paginas: number;
  createdAt: string;
}

export interface DnsCheckView {
  /** O domínio já aponta para a VPS? */
  ok: boolean;
  /** IPs que o DNS devolveu agora — para a criadora comparar com a instrução. */
  encontrados: string[];
  esperado: string | null;
}

/** O mesmo formato que o `CHECK` da tabela `domains` exige. */
const FORMATO_DE_HOST = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

/**
 * Domínio próprio: a criadora traz um domínio dela.
 *
 * Fluxo: ela cadastra (`pending`), cria o registro `A` apontando para a VPS,
 * confere aqui que o DNS já responde certo, e a equipe configura nginx e
 * certificado e roda `npm run dominio:ativar`. Ativo, o domínio entra no
 * seletor de domínio das páginas DELA — e de mais ninguém.
 *
 * A ativação não é automática de propósito, nesta versão: emitir certificado
 * sozinho exige mudar o deploy de produção (TLS sob demanda), e oferecer um
 * domínio que responde com erro de TLS é pior do que esperar a equipe.
 */
@Injectable()
export class CustomDomainsService {
  constructor(
    @InjectRepository(Domain) private readonly domains: Repository<Domain>,
  ) {}

  async list(userId: string): Promise<CustomDomainView[]> {
    // Uma consulta: a contagem de páginas vem junto, por agregação no banco.
    const linhas = await this.domains
      .createQueryBuilder("d")
      .leftJoin(Profile, "p", "p.domain_id = d.id AND p.user_id = :userId", { userId })
      .select(["d.id AS id", "d.host AS host", "d.status AS status", "d.created_at AS created_at"])
      .addSelect("count(p.id)::int", "paginas")
      .where("d.owner_user_id = :userId", { userId })
      .groupBy("d.id")
      .orderBy("d.created_at", "ASC")
      .getRawMany<{ id: string; host: string; status: "pending" | "active"; created_at: Date; paginas: number }>();

    return linhas.map((l) => ({
      id: l.id,
      host: l.host,
      status: l.status,
      paginas: l.paginas,
      createdAt: new Date(l.created_at).toISOString(),
    }));
  }

  async create(userId: string, plano: PlanoId, bruto: string): Promise<CustomDomainView> {
    const vagas = PLANOS[plano].dominiosProprios;
    if (vagas === 0) exigirPro(plano, "dominioProprio");

    const host = normalizarHost(bruto);
    if (!FORMATO_DE_HOST.test(host) || host.length > 253) {
      throw new BadRequestException({
        code: "dominio_invalido",
        message: "Digite só o domínio, como seunome.com ou links.seunome.com.",
      });
    }
    if (host === hostPadrao()) {
      throw new ConflictException({ code: "dominio_em_uso", message: "Esse domínio já está em uso." });
    }

    const usadas = await this.domains.count({ where: { ownerUserId: userId } });
    if (usadas >= vagas) {
      throw new ConflictException({
        code: "vagas_esgotadas",
        message: `Suas ${vagas} vagas de domínio próprio estão ocupadas. Remova um para adicionar outro.`,
      });
    }

    // `uq_domains_host` é quem garante a unicidade (inclusive contra o pool);
    // a consulta antes só existe para a mensagem ser clara.
    if (await this.domains.exists({ where: { host } })) {
      throw new ConflictException({ code: "dominio_em_uso", message: "Esse domínio já está em uso." });
    }

    const criado = await this.domains.save(
      this.domains.create({ host, label: null, ownerUserId: userId, status: "pending", active: true }),
    );
    return {
      id: criado.id,
      host: criado.host,
      status: criado.status,
      paginas: 0,
      createdAt: criado.createdAt.toISOString(),
    };
  }

  /** Apaga. As páginas que o usavam voltam ao domínio padrão — a FK é
   *  `ON DELETE SET NULL` — e o link antigo, no domínio dela, para de abrir. */
  async remove(userId: string, id: string): Promise<void> {
    const resultado = await this.domains.delete({ id, ownerUserId: userId });
    if (!resultado.affected) throw new NotFoundException("Domínio não encontrado.");
  }

  /**
   * Confere o DNS agora.
   *
   * Pergunta o registro `A` (o `resolve4` segue CNAME) e compara com o IP da
   * VPS. Não grava nada: é uma foto do momento, para a criadora saber se já
   * pode avisar a equipe ou se o DNS ainda não propagou.
   */
  async checkDns(userId: string, id: string): Promise<DnsCheckView> {
    const dominio = await this.domains.findOne({ where: { id, ownerUserId: userId } });
    if (!dominio) throw new NotFoundException("Domínio não encontrado.");

    const esperado = loadEnv().serverPublicIp;
    let encontrados: string[] = [];
    try {
      encontrados = await resolve4(dominio.host);
    } catch {
      // NXDOMAIN, sem registro A, DNS fora: para a criadora é tudo "ainda não
      // aponta". O detalhe técnico não a ajuda a corrigir.
      encontrados = [];
    }
    return { ok: Boolean(esperado) && encontrados.includes(esperado!), encontrados, esperado };
  }
}

/** "https://www.Marca.com/ana" → "www.marca.com". */
export function normalizarHost(bruto: string): string {
  return bruto
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .replace(/[/?#].*$/, "")
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
}
