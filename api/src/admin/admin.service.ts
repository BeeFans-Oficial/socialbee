import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { hash } from "bcryptjs";
import { DataSource } from "typeorm";

import { toPlanView, type PlanView } from "../auth/auth.service";
import { loadEnv } from "../config/env";
import { User } from "../auth/entities/user.entity";
import { FORMATO_DE_HOST, normalizarHost } from "../profiles/custom-domains.service";
import type { ApagarContaDto } from "./dto/apagar-conta.dto";
import type { CriarContaDto } from "./dto/criar-conta.dto";
import type { EditarContaDto } from "./dto/editar-conta.dto";
import type { AdicionarDominioDto } from "./dto/adicionar-dominio.dto";
import type { EditarDominioDto } from "./dto/editar-dominio.dto";
import type { Papel } from "./entities/admin-action.entity";

/**
 * O que o painel admin faz.
 *
 * SQL escrito à mão, como nos scripts que este serviço substitui
 * (`liberar-pro.ts`, `ativar-dominio.ts`): são consultas de operação —
 * contagens, junções entre conta, páginas e concessões — que o ORM só
 * deixaria mais longas. O `search_path` da conexão já aponta para o schema
 * (ver `data-source.ts`), então os nomes vão sem qualificar.
 *
 * Toda escrita passa por `registrar()`: a ação só existe se o registro em
 * `admin_actions` existir junto, na mesma transação. Motivo é obrigatório
 * em todas.
 */

export interface VisaoGeral {
  contas: { total: number; novas7d: number; novas30d: number; pro: number; admins: number };
  paginas: { total: number; noAr: number };
  links: { total: number; ativos: number };
  dominios: { pool: number; propriosPendentes: number; propriosAtivos: number };
  hoje: { visitas: number; cliques: number };
}

export interface ContaResumo {
  id: string;
  email: string;
  role: Papel;
  plan: PlanView;
  createdAt: string;
  lastLoginAt: string | null;
  paginas: number;
  /** Slug da primeira página, para a lista ter um nome. */
  slug: string | null;
  displayName: string | null;
}

export interface ContaDetalhe extends ContaResumo {
  isAdultConfirmed: boolean;
  paginasLista: {
    id: string;
    slug: string;
    displayName: string;
    host: string | null;
    published: boolean;
    links: number;
    createdAt: string;
  }[];
  concessoes: {
    id: string;
    source: string;
    startsAt: string;
    endsAt: string;
    reason: string | null;
    createdAt: string;
  }[];
  sessoesAtivas: number;
  dominiosProprios: { id: string; host: string; status: string }[];
  acoes: AcaoDeAdmin[];
}

export interface AcaoDeAdmin {
  id: string;
  action: string;
  reason: string;
  details: Record<string, unknown>;
  createdAt: string;
  admin: { id: string | null; email: string | null };
  alvo: { id: string | null; email: string | null };
}

/** Um domínio da plataforma, com o quanto ele carrega hoje. */
export interface DominioDoPool {
  id: string;
  host: string;
  label: string | null;
  /** `false` = pausado: sai do sorteio e do seletor, sem derrubar quem já está nele. */
  active: boolean;
  position: number;
  paginas: number;
  paginasNoAr: number;
  /** Visitas humanas que chegaram por este host nos últimos 7 dias. É o
   *  termômetro: um domínio bloqueado pelo Instagram esfria de um dia para o outro. */
  visitas7d: number;
  createdAt: string;
}

export interface Pagina<T> {
  itens: T[];
  total: number;
  pagina: number;
  porPagina: number;
}

const POR_PAGINA = 25;

@Injectable()
export class AdminService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  async visaoGeral(): Promise<VisaoGeral> {
    const [c] = await this.db.query<
      {
        total: string;
        novas7d: string;
        novas30d: string;
        pro: string;
        admins: string;
        paginas: string;
        no_ar: string;
        links: string;
        ativos: string;
        pool: string;
        pendentes: string;
        proprios_ativos: string;
        visitas: string;
        cliques: string;
      }[]
    >(`
      SELECT
        (SELECT count(*) FROM users)                                                  AS total,
        (SELECT count(*) FROM users WHERE created_at > now() - interval '7 days')     AS novas7d,
        (SELECT count(*) FROM users WHERE created_at > now() - interval '30 days')    AS novas30d,
        (SELECT count(*) FROM users WHERE pro_until > now())                          AS pro,
        (SELECT count(*) FROM users WHERE role = 'admin')                             AS admins,
        (SELECT count(*) FROM profiles)                                               AS paginas,
        (SELECT count(*) FROM profiles WHERE published)                               AS no_ar,
        (SELECT count(*) FROM links)                                                  AS links,
        (SELECT count(*) FROM links WHERE is_active)                                  AS ativos,
        (SELECT count(*) FROM domains WHERE owner_user_id IS NULL AND active)         AS pool,
        (SELECT count(*) FROM domains WHERE owner_user_id IS NOT NULL AND status = 'pending') AS pendentes,
        (SELECT count(*) FROM domains WHERE owner_user_id IS NOT NULL AND status = 'active')  AS proprios_ativos,
        (SELECT count(*) FROM tracking_events
          WHERE type = 'view' AND occurred_at >= date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo') AS visitas,
        (SELECT count(*) FROM tracking_events
          WHERE type = 'click' AND occurred_at >= date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo') AS cliques
    `);
    const n = (v: string) => Number(v);
    return {
      contas: { total: n(c.total), novas7d: n(c.novas7d), novas30d: n(c.novas30d), pro: n(c.pro), admins: n(c.admins) },
      paginas: { total: n(c.paginas), noAr: n(c.no_ar) },
      links: { total: n(c.links), ativos: n(c.ativos) },
      dominios: { pool: n(c.pool), propriosPendentes: n(c.pendentes), propriosAtivos: n(c.proprios_ativos) },
      hoje: { visitas: n(c.visitas), cliques: n(c.cliques) },
    };
  }

  /** Busca por e-mail, nome ou endereço de página. Sem busca, as mais novas. */
  async contas(busca: string, pagina: number): Promise<Pagina<ContaResumo>> {
    const termo = `%${busca.trim()}%`;
    const filtro = busca.trim()
      ? `WHERE u.email ILIKE $1 OR EXISTS (
           SELECT 1 FROM profiles p WHERE p.user_id = u.id AND (p.slug ILIKE $1 OR p.display_name ILIKE $1))`
      : "";
    const params: unknown[] = busca.trim() ? [termo] : [];
    const [{ total }] = await this.db.query<{ total: string }[]>(
      `SELECT count(*) AS total FROM users u ${filtro}`,
      params,
    );
    const offset = (pagina - 1) * POR_PAGINA;
    const linhas = await this.db.query<
      {
        id: string;
        email: string;
        role: Papel;
        pro_until: Date | null;
        created_at: Date;
        last_login_at: Date | null;
        paginas: string;
        slug: string | null;
        display_name: string | null;
      }[]
    >(
      `
      SELECT u.id, u.email, u.role, u.pro_until, u.created_at, u.last_login_at,
             (SELECT count(*) FROM profiles p WHERE p.user_id = u.id) AS paginas,
             pp.slug, pp.display_name
        FROM users u
        LEFT JOIN LATERAL (
          SELECT slug, display_name FROM profiles p WHERE p.user_id = u.id ORDER BY created_at LIMIT 1
        ) pp ON true
        ${filtro}
       ORDER BY u.created_at DESC
       LIMIT ${POR_PAGINA} OFFSET ${offset}
      `,
      params,
    );
    return {
      itens: linhas.map((l) => ({
        id: l.id,
        email: l.email,
        role: l.role,
        plan: toPlanView(l.pro_until),
        createdAt: new Date(l.created_at).toISOString(),
        lastLoginAt: l.last_login_at ? new Date(l.last_login_at).toISOString() : null,
        paginas: Number(l.paginas),
        slug: l.slug,
        displayName: l.display_name,
      })),
      total: Number(total),
      pagina,
      porPagina: POR_PAGINA,
    };
  }

  async conta(id: string): Promise<ContaDetalhe> {
    const [u] = await this.db.query<
      {
        id: string;
        email: string;
        role: Papel;
        pro_until: Date | null;
        created_at: Date;
        last_login_at: Date | null;
        age_confirmed_at: Date | null;
      }[]
    >(`SELECT id, email, role, pro_until, created_at, last_login_at, age_confirmed_at FROM users WHERE id = $1`, [id]);
    if (!u) throw new NotFoundException({ code: "conta_nao_encontrada", message: "Conta não encontrada." });

    const paginas = await this.db.query<
      { id: string; slug: string; display_name: string; host: string | null; published: boolean; links: string; created_at: Date }[]
    >(
      `
      SELECT p.id, p.slug, p.display_name, d.host, p.published, p.created_at,
             (SELECT count(*) FROM links l WHERE l.profile_id = p.id) AS links
        FROM profiles p
        LEFT JOIN domains d ON d.id = p.domain_id
       WHERE p.user_id = $1
       ORDER BY p.created_at
      `,
      [id],
    );
    const concessoes = await this.db.query<
      { id: string; source: string; starts_at: Date; ends_at: Date; reason: string | null; created_at: Date }[]
    >(`SELECT id, source, starts_at, ends_at, reason, created_at FROM plan_grants WHERE user_id = $1 ORDER BY created_at DESC`, [id]);
    const [{ sessoes }] = await this.db.query<{ sessoes: string }[]>(
      `SELECT count(*) AS sessoes FROM sessions WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now()`,
      [id],
    );
    const dominios = await this.db.query<{ id: string; host: string; status: string }[]>(
      `SELECT id, host, status FROM domains WHERE owner_user_id = $1 ORDER BY created_at`,
      [id],
    );
    const acoes = await this.acoesDaConta(id);

    return {
      id: u.id,
      email: u.email,
      role: u.role,
      plan: toPlanView(u.pro_until),
      createdAt: new Date(u.created_at).toISOString(),
      lastLoginAt: u.last_login_at ? new Date(u.last_login_at).toISOString() : null,
      isAdultConfirmed: Boolean(u.age_confirmed_at),
      paginas: paginas.length,
      slug: paginas[0]?.slug ?? null,
      displayName: paginas[0]?.display_name ?? null,
      paginasLista: paginas.map((p) => ({
        id: p.id,
        slug: p.slug,
        displayName: p.display_name,
        host: p.host,
        published: p.published,
        links: Number(p.links),
        createdAt: new Date(p.created_at).toISOString(),
      })),
      concessoes: concessoes.map((c) => ({
        id: c.id,
        source: c.source,
        startsAt: new Date(c.starts_at).toISOString(),
        endsAt: new Date(c.ends_at).toISOString(),
        reason: c.reason,
        createdAt: new Date(c.created_at).toISOString(),
      })),
      sessoesAtivas: Number(sessoes),
      dominiosProprios: dominios,
      acoes,
    };
  }

  /**
   * Libera o Pro: `dias` SOMA ao que a conta já tem; `ate` é a data final,
   * até o fim do dia em Brasília. `pro_until` é sempre o maior fim entre as
   * concessões — liberar nunca encurta. Mesma regra do script `plano:liberar`.
   */
  async liberarPro(
    adminId: string,
    userId: string,
    input: { dias?: number; ate?: string; motivo: string },
  ): Promise<PlanView> {
    const motivo = exigirMotivo(input.motivo);
    if (!input.dias && !input.ate) {
      throw new BadRequestException({ code: "prazo_necessario", message: "Informe os dias ou a data final." });
    }
    if (input.dias !== undefined && (!Number.isInteger(input.dias) || input.dias < 1 || input.dias > 3650)) {
      throw new BadRequestException({ code: "dias_invalidos", message: "Dias: de 1 a 3650." });
    }
    if (input.ate !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(input.ate)) {
      throw new BadRequestException({ code: "data_invalida", message: "Data final no formato AAAA-MM-DD." });
    }
    const alvo = await this.alvo(userId);

    return this.db.transaction(async (tx) => {
      if (input.dias) {
        await tx.query(
          `
          INSERT INTO plan_grants (user_id, source, starts_at, ends_at, reason)
          SELECT $1, 'manual', inicio, inicio + make_interval(days => $2), $3
            FROM (SELECT greatest(now(), coalesce($4::timestamptz, now())) AS inicio) i
          `,
          [userId, input.dias, motivo, alvo.pro_until],
        );
      } else {
        await tx.query(
          `
          INSERT INTO plan_grants (user_id, source, starts_at, ends_at, reason)
          VALUES ($1, 'manual', now(), ($2::date + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo', $3)
          `,
          [userId, input.ate, motivo],
        );
      }
      // `UPDATE … RETURNING` no TypeORM devolve `[linhas, afetadas]`, não as
      // linhas; um SELECT depois do UPDATE não depende dessa forma.
      await tx.query(
        `UPDATE users SET pro_until = (SELECT max(ends_at) FROM plan_grants WHERE user_id = $1) WHERE id = $1`,
        [userId],
      );
      const [{ pro_until }] = await tx.query<{ pro_until: Date }[]>(`SELECT pro_until FROM users WHERE id = $1`, [userId]);
      await registrar(tx, adminId, "plano.liberar", userId, motivo, {
        email: alvo.email,
        dias: input.dias ?? null,
        ate: input.ate ?? null,
        proUntil: new Date(pro_until).toISOString(),
      });
      return toPlanView(pro_until);
    });
  }

  /** Volta ao Free na hora. As concessões ativas terminam agora e ganham o
   *  motivo anotado; nada é apagado. */
  async rebaixarPro(adminId: string, userId: string, motivoBruto: string): Promise<PlanView> {
    const motivo = exigirMotivo(motivoBruto);
    const alvo = await this.alvo(userId);
    return this.db.transaction(async (tx) => {
      await tx.query(
        `
        UPDATE plan_grants
           -- Concessão que ainda nem começou (liberada para depois do Pro
           -- atual) também termina agora; o CHECK exige fim > início, então
           -- o início recua um segundo.
           SET starts_at = least(starts_at, now() - interval '1 second'),
               ends_at   = now(),
               reason    = coalesce(reason, '') || ' — rebaixado: ' || $2
         WHERE user_id = $1 AND ends_at > now()
        `,
        [userId, motivo],
      );
      await tx.query(
        `UPDATE users SET pro_until = (SELECT max(ends_at) FROM plan_grants WHERE user_id = $1) WHERE id = $1`,
        [userId],
      );
      const [{ pro_until }] = await tx.query<{ pro_until: Date | null }[]>(`SELECT pro_until FROM users WHERE id = $1`, [userId]);
      await registrar(tx, adminId, "plano.rebaixar", userId, motivo, { email: alvo.email });
      return toPlanView(pro_until);
    });
  }

  /** Encerra toda sessão aberta da conta: o próximo pedido dela cai no login. */
  async revogarSessoes(adminId: string, userId: string, motivoBruto: string): Promise<{ revogadas: number }> {
    const motivo = exigirMotivo(motivoBruto);
    const alvo = await this.alvo(userId);
    return this.db.transaction(async (tx) => {
      const [{ abertas }] = await tx.query<{ abertas: string }[]>(
        `SELECT count(*) AS abertas FROM sessions WHERE user_id = $1 AND revoked_at IS NULL`,
        [userId],
      );
      await tx.query(`UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [userId]);
      const revogadas = Number(abertas);
      await registrar(tx, adminId, "sessoes.revogar", userId, motivo, { email: alvo.email, revogadas });
      return { revogadas };
    });
  }

  /** Promove ou rebaixa outro admin. Ninguém mexe no próprio papel: o último
   *  admin não pode se trancar para fora. */
  async definirPapel(adminId: string, userId: string, papel: Papel, motivoBruto: string): Promise<{ role: Papel }> {
    const motivo = exigirMotivo(motivoBruto);
    if (adminId === userId) {
      throw new BadRequestException({ code: "proprio_papel", message: "Você não pode mudar o seu próprio papel." });
    }
    const alvo = await this.alvo(userId);
    return this.db.transaction(async (tx) => {
      await tx.query(`UPDATE users SET role = $2 WHERE id = $1`, [userId, papel]);
      await registrar(tx, adminId, papel === "admin" ? "admin.promover" : "admin.rebaixar", userId, motivo, {
        email: alvo.email,
        de: alvo.role,
        para: papel,
      });
      return { role: papel };
    });
  }

  /**
   * Cria SÓ a conta, sem página. Diferente do cadastro (`AuthService.register`),
   * que cria as duas juntas: aqui a pessoa recebe a senha de quem criou, entra
   * e monta a própria página em "Páginas". Até lá o token vai sem página e só
   * as rotas `@SemPagina()` respondem.
   */
  async criarConta(adminId: string, dto: CriarContaDto): Promise<{ id: string }> {
    const motivo = exigirMotivo(dto.motivo);
    const passwordHash = await hash(dto.password, loadEnv().bcryptRounds);

    return this.db.transaction(async (tx) => {
      const users = tx.getRepository(User);
      if (await users.exists({ where: { email: dto.email } })) {
        throw new ConflictException({ code: "email_taken", message: "Já existe uma conta com esse email." });
      }
      const user = await users.save(users.create({ email: dto.email, passwordHash, ageConfirmedAt: null }));
      await registrar(tx, adminId, "conta.criar", user.id, motivo, { email: dto.email });
      return { id: user.id };
    });
  }

  /**
   * Troca e-mail e/ou senha. Senha nova derruba as sessões abertas: quem
   * estava logado com a senha antiga não continua logado com ela.
   */
  async editarConta(adminId: string, userId: string, dto: EditarContaDto): Promise<{ email: string }> {
    const motivo = exigirMotivo(dto.motivo);
    if (adminId === userId) {
      throw new BadRequestException({ code: "propria_conta", message: "A sua própria conta se edita nas configurações." });
    }
    const alvo = await this.alvo(userId);
    const novoEmail = dto.email && dto.email !== alvo.email ? dto.email : undefined;
    if (!novoEmail && !dto.novaSenha) {
      throw new BadRequestException({ code: "nada_a_editar", message: "Mude o e-mail ou a senha." });
    }

    const passwordHash = dto.novaSenha ? await hash(dto.novaSenha, loadEnv().bcryptRounds) : undefined;
    return this.db.transaction(async (tx) => {
      const detalhes: Record<string, unknown> = { email: alvo.email };
      if (novoEmail) {
        if (await tx.getRepository(User).exists({ where: { email: novoEmail } })) {
          throw new ConflictException({ code: "email_taken", message: "Já existe uma conta com esse email." });
        }
        await tx.query(`UPDATE users SET email = $2 WHERE id = $1`, [userId, novoEmail]);
        detalhes.novoEmail = novoEmail;
      }
      if (passwordHash) {
        await tx.query(`UPDATE users SET password_hash = $2 WHERE id = $1`, [userId, passwordHash]);
        const [{ abertas }] = await tx.query<{ abertas: string }[]>(
          `SELECT count(*) AS abertas FROM sessions WHERE user_id = $1 AND revoked_at IS NULL`,
          [userId],
        );
        await tx.query(`UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [userId]);
        detalhes.senha = true;
        detalhes.revogadas = Number(abertas);
      }
      await registrar(tx, adminId, "conta.editar", userId, motivo, detalhes);
      return { email: novoEmail ?? alvo.email };
    });
  }

  /**
   * Apaga a conta e tudo que pende dela (páginas, links, histórico, sessões,
   * concessões e domínios próprios vão por `ON DELETE CASCADE`). A linha de
   * auditoria fica: `target_user_id` vira nulo pelo `SET NULL`, e o e-mail
   * sobrevive em `details`. Admin não se apaga, e outro admin precisa ser
   * rebaixado antes: ninguém some da plataforma por um clique de um par.
   */
  async apagarConta(adminId: string, userId: string, dto: ApagarContaDto): Promise<{ apagada: true }> {
    const motivo = exigirMotivo(dto.motivo);
    if (adminId === userId) {
      throw new BadRequestException({ code: "propria_conta", message: "Você não pode apagar a sua própria conta por aqui." });
    }
    const alvo = await this.alvo(userId);
    if (alvo.role === "admin") {
      throw new BadRequestException({ code: "conta_admin", message: "Tire o papel de admin antes de apagar esta conta." });
    }
    if (dto.confirmacao !== alvo.email) {
      throw new BadRequestException({ code: "confirmacao_invalida", message: "Digite o e-mail da conta exatamente como está." });
    }

    return this.db.transaction(async (tx) => {
      const [{ paginas, links }] = await tx.query<{ paginas: string; links: string }[]>(
        `SELECT count(DISTINCT p.id) AS paginas, count(l.id) AS links
           FROM profiles p LEFT JOIN links l ON l.profile_id = p.id
          WHERE p.user_id = $1`,
        [userId],
      );
      await registrar(tx, adminId, "conta.apagar", userId, motivo, {
        email: alvo.email,
        paginas: Number(paginas),
        links: Number(links),
      });
      await tx.query(`DELETE FROM users WHERE id = $1`, [userId]);
      return { apagada: true };
    });
  }

  // ------------------------------------------------------------ pool de domínios

  /** Os domínios da plataforma (sem dono), com páginas e visitas recentes. */
  async dominios(): Promise<DominioDoPool[]> {
    const linhas = await this.db.query<
      {
        id: string;
        host: string;
        label: string | null;
        active: boolean;
        position: number;
        paginas: string;
        no_ar: string;
        visitas7d: string;
        created_at: Date;
      }[]
    >(`
      SELECT d.id, d.host, d.label, d.active, d.position, d.created_at,
             (SELECT count(*) FROM profiles p WHERE p.domain_id = d.id)                 AS paginas,
             (SELECT count(*) FROM profiles p WHERE p.domain_id = d.id AND p.published) AS no_ar,
             (SELECT count(*) FROM tracking_events e
               WHERE e.arrival_host = d.host AND e.type = 'view'
                 AND e.occurred_at > now() - interval '7 days')                         AS visitas7d
        FROM domains d
       WHERE d.owner_user_id IS NULL
       ORDER BY d.active DESC, d.position ASC, d.host ASC
    `);
    return linhas.map((l) => ({
      id: l.id,
      host: l.host,
      label: l.label,
      active: l.active,
      position: l.position,
      paginas: Number(l.paginas),
      paginasNoAr: Number(l.no_ar),
      visitas7d: Number(l.visitas7d),
      createdAt: new Date(l.created_at).toISOString(),
    }));
  }

  /**
   * Domínio novo, PAUSADO. A linha no banco é o último passo da entrada de um
   * domínio, não o primeiro (ver `Domain`): nasce fora do sorteio e do seletor,
   * e o admin ativa quando o endereço já responde em HTTPS.
   */
  async adicionarDominio(adminId: string, dto: AdicionarDominioDto): Promise<DominioDoPool> {
    const motivo = exigirMotivo(dto.motivo);
    const host = normalizarHost(dto.host ?? "");
    if (!FORMATO_DE_HOST.test(host) || host.length > 253) {
      throw new BadRequestException({
        code: "host_invalido",
        message: "Digite só o domínio, como vemaqui.site — sem https:// nem barra.",
      });
    }
    return this.db.transaction(async (tx) => {
      const [existe] = await tx.query<{ owner_user_id: string | null }[]>(`SELECT owner_user_id FROM domains WHERE host = $1`, [host]);
      if (existe) {
        throw new ConflictException({
          code: "dominio_em_uso",
          message: existe.owner_user_id ? "Esse domínio é domínio próprio de uma criadora." : "Esse domínio já está no pool.",
        });
      }
      const [criado] = await tx.query<{ id: string }[]>(
        `
        INSERT INTO domains (host, label, active, position, owner_user_id, status)
        SELECT $1, $2, false, coalesce(max(position), 0) + 1, NULL, 'active' FROM domains WHERE owner_user_id IS NULL
        RETURNING id
        `,
        [host, dto.label ?? null],
      );
      await registrar(tx, adminId, "dominio.adicionar", null, motivo, { host, dominioId: criado.id, label: dto.label ?? null });
      return this.dominio(criado.id, tx);
    });
  }

  /** Pausar tira do sorteio e do seletor. Quem já está nele continua no ar. */
  pausarDominio(adminId: string, id: string, motivo: string): Promise<DominioDoPool> {
    return this.mudarAtivo(adminId, id, false, motivo);
  }

  /** Só depois de o domínio abrir em HTTPS. */
  ativarDominio(adminId: string, id: string, motivo: string): Promise<DominioDoPool> {
    return this.mudarAtivo(adminId, id, true, motivo);
  }

  async editarDominio(adminId: string, id: string, dto: EditarDominioDto): Promise<DominioDoPool> {
    const motivo = exigirMotivo(dto.motivo);
    if (dto.label === undefined) {
      throw new BadRequestException({ code: "nada_a_mudar", message: "Nada para mudar." });
    }
    return this.db.transaction(async (tx) => {
      const atual = await this.dominio(id, tx);
      await tx.query(`UPDATE domains SET label = $2 WHERE id = $1`, [id, dto.label]);
      await registrar(tx, adminId, "dominio.editar", null, motivo, {
        host: atual.host,
        dominioId: id,
        labelAnterior: atual.label,
        label: dto.label,
      });
      return this.dominio(id, tx);
    });
  }

  private async mudarAtivo(adminId: string, id: string, ativo: boolean, motivoBruto: string): Promise<DominioDoPool> {
    const motivo = exigirMotivo(motivoBruto);
    return this.db.transaction(async (tx) => {
      const atual = await this.dominio(id, tx);
      if (atual.active === ativo) {
        throw new BadRequestException({
          code: ativo ? "ja_ativo" : "ja_pausado",
          message: ativo ? "Esse domínio já está ativo." : "Esse domínio já está pausado.",
        });
      }
      await tx.query(`UPDATE domains SET active = $2 WHERE id = $1`, [id, ativo]);
      await registrar(tx, adminId, ativo ? "dominio.ativar" : "dominio.pausar", null, motivo, {
        host: atual.host,
        dominioId: id,
        paginas: atual.paginas,
      });
      return this.dominio(id, tx);
    });
  }

  /** Um domínio do pool. 404 para id que não existe ou que é domínio próprio:
   *  domínio próprio se administra na conta da dona, não aqui. */
  private async dominio(id: string, tx: { query: DataSource["query"] }): Promise<DominioDoPool> {
    const [d] = await tx.query<
      { id: string; host: string; label: string | null; active: boolean; position: number; paginas: string; no_ar: string; visitas7d: string; created_at: Date }[]
    >(
      `
      SELECT d.id, d.host, d.label, d.active, d.position, d.created_at,
             (SELECT count(*) FROM profiles p WHERE p.domain_id = d.id)                 AS paginas,
             (SELECT count(*) FROM profiles p WHERE p.domain_id = d.id AND p.published) AS no_ar,
             (SELECT count(*) FROM tracking_events e
               WHERE e.arrival_host = d.host AND e.type = 'view'
                 AND e.occurred_at > now() - interval '7 days')                         AS visitas7d
        FROM domains d
       WHERE d.id = $1 AND d.owner_user_id IS NULL
      `,
      [id],
    );
    if (!d) throw new NotFoundException({ code: "dominio_nao_encontrado", message: "Domínio não encontrado no pool." });
    return {
      id: d.id,
      host: d.host,
      label: d.label,
      active: d.active,
      position: d.position,
      paginas: Number(d.paginas),
      paginasNoAr: Number(d.no_ar),
      visitas7d: Number(d.visitas7d),
      createdAt: new Date(d.created_at).toISOString(),
    };
  }

  async auditoria(pagina: number): Promise<Pagina<AcaoDeAdmin>> {
    const [{ total }] = await this.db.query<{ total: string }[]>(`SELECT count(*) AS total FROM admin_actions`);
    const itens = await this.listarAcoes("", [], pagina);
    return { itens, total: Number(total), pagina, porPagina: POR_PAGINA };
  }

  private acoesDaConta(userId: string): Promise<AcaoDeAdmin[]> {
    return this.listarAcoes("WHERE a.target_user_id = $1", [userId], 1);
  }

  private async listarAcoes(filtro: string, params: unknown[], pagina: number): Promise<AcaoDeAdmin[]> {
    const offset = (pagina - 1) * POR_PAGINA;
    const linhas = await this.db.query<
      {
        id: string;
        action: string;
        reason: string;
        details: Record<string, unknown>;
        created_at: Date;
        admin_id: string | null;
        admin_email: string | null;
        alvo_id: string | null;
        alvo_email: string | null;
      }[]
    >(
      `
      SELECT a.id, a.action, a.reason, a.details, a.created_at,
             adm.id AS admin_id, adm.email AS admin_email,
             alvo.id AS alvo_id, alvo.email AS alvo_email
        FROM admin_actions a
        LEFT JOIN users adm  ON adm.id  = a.admin_user_id
        LEFT JOIN users alvo ON alvo.id = a.target_user_id
        ${filtro}
       ORDER BY a.created_at DESC
       LIMIT ${POR_PAGINA} OFFSET ${offset}
      `,
      params,
    );
    return linhas.map((l) => ({
      id: l.id,
      action: l.action,
      reason: l.reason,
      details: l.details ?? {},
      createdAt: new Date(l.created_at).toISOString(),
      admin: { id: l.admin_id, email: l.admin_email },
      alvo: { id: l.alvo_id, email: l.alvo_email ?? (typeof l.details?.email === "string" ? l.details.email : null) },
    }));
  }

  private async alvo(userId: string): Promise<{ id: string; email: string; role: Papel; pro_until: Date | null }> {
    const [u] = await this.db.query<{ id: string; email: string; role: Papel; pro_until: Date | null }[]>(
      `SELECT id, email, role, pro_until FROM users WHERE id = $1`,
      [userId],
    );
    if (!u) throw new NotFoundException({ code: "conta_nao_encontrada", message: "Conta não encontrada." });
    return u;
  }
}

function exigirMotivo(motivo: string | undefined): string {
  const limpo = (motivo ?? "").trim();
  if (limpo.length < 3) {
    throw new BadRequestException({ code: "motivo_necessario", message: "Escreva o motivo (pelo menos 3 letras)." });
  }
  return limpo.slice(0, 500);
}

/** A linha de auditoria, na mesma transação da ação. */
async function registrar(
  tx: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
  adminId: string,
  action: string,
  targetUserId: string | null,
  reason: string,
  details: Record<string, unknown>,
): Promise<void> {
  await tx.query(
    `INSERT INTO admin_actions (admin_user_id, action, target_user_id, reason, details) VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [adminId, action, targetUserId, reason, JSON.stringify(details)],
  );
}
