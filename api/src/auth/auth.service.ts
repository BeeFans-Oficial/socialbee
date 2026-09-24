import { randomUUID } from "node:crypto";

import { ConflictException, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import { compare, hash, hashSync } from "bcryptjs";
import { DataSource, Repository } from "typeorm";

import { loadEnv } from "../config/env";
import { ipPrefix } from "../tracking/attribution";
import { Profile } from "../profiles/entities/profile.entity";
import { ProfilesService, toOwnProfileView, type OwnProfileView } from "../profiles/profiles.service";
import { Session } from "./entities/session.entity";
import { User } from "./entities/user.entity";
import type { LoginDto } from "./dto/login.dto";
import type { RegisterDto } from "./dto/register.dto";

/** Metadados da requisição que abriu a sessão. Só para a pessoa reconhecer a
 *  própria sessão depois — nunca para autorizar nada. */
export interface SessionMeta {
  userAgent?: string;
  ip?: string;
}

export interface AuthenticatedUserView {
  id: string;
  email: string;
  isAdultConfirmed: boolean;
  createdAt: string;
}

export interface AuthResult {
  user: AuthenticatedUserView;
  profile: OwnProfileView;
  accessToken: string;
  expiresAt: Date;
}

export interface ResolvedSession {
  userId: string;
  profileId: string;
  sessionId: string;
  email: string;
}

/**
 * Hash de descarte, usado quando o email não existe.
 *
 * Sem ele o login responde na hora para email inexistente e em ~200 ms para
 * email real — a diferença é medível e transforma o endpoint num verificador de
 * "esta criadora tem conta aqui?". Comparar contra um hash real (de uma senha
 * que ninguém tem) paga o mesmo custo nos dois caminhos.
 *
 * É gerado na primeira necessidade, com o MESMO custo configurado: um literal
 * chumbado aqui ficaria com o custo de quando foi escrito e a equivalência de
 * tempo se perderia no dia em que `BCRYPT_ROUNDS` mudasse.
 */
let dummyHash: string | null = null;

function throwawayHash(rounds: number): string {
  if (!dummyHash) {
    dummyHash = hashSync("senha-que-nao-e-de-ninguem", rounds);
  }
  return dummyHash;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Session) private readonly sessions: Repository<Session>,
    private readonly profilesService: ProfilesService,
    private readonly jwt: JwtService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Cadastro.
   *
   * Conta e perfil nascem na MESMA transação. Se o perfil falhasse depois de o
   * usuário ser criado, a pessoa ficaria com login válido e nenhum perfil — um
   * estado que nenhuma tela sabe mostrar e que só se conserta no banco.
   */
  async register(dto: RegisterDto, meta: SessionMeta): Promise<AuthResult> {
    if (!dto.ageConfirmed) {
      throw new UnauthorizedException({
        code: "age_not_confirmed",
        message: "É preciso confirmar que você tem 18 anos ou mais.",
      });
    }

    await this.profilesService.assertSlugAvailable(dto.slug);

    const env = loadEnv();
    const passwordHash = await hash(dto.password, env.bcryptRounds);

    const { user, profile } = await this.dataSource.transaction(async (manager) => {
      const existing = await manager.getRepository(User).exists({ where: { email: dto.email } });
      if (existing) {
        throw new ConflictException({
          code: "email_taken",
          message: "Já existe uma conta com esse email.",
        });
      }

      const created = await manager.getRepository(User).save(
        manager.getRepository(User).create({
          email: dto.email,
          passwordHash,
          ageConfirmedAt: new Date(),
        }),
      );

      const createdProfile = await manager.getRepository(Profile).save(
        manager.getRepository(Profile).create({
          userId: created.id,
          slug: dto.slug,
          displayName: dto.displayName,
          isAdult: dto.isAdult ?? false,
        }),
      );

      return { user: created, profile: createdProfile };
    });

    this.logger.log(`conta criada: ${user.id} (perfil ${profile.slug})`);
    return this.issue(user, profile, meta);
  }

  async login(dto: LoginDto, meta: SessionMeta): Promise<AuthResult> {
    const user = await this.users.findOne({ where: { email: dto.email } });

    // Compara sempre — com o hash real ou com o de descarte — para o tempo de
    // resposta não revelar se o email existe.
    const matches = await compare(
      dto.password,
      user?.passwordHash ?? throwawayHash(loadEnv().bcryptRounds),
    );

    if (!user || !matches) {
      // Uma mensagem só para email errado e senha errada: dizer qual dos dois
      // falhou é entregar metade da credencial.
      throw new UnauthorizedException({
        code: "invalid_credentials",
        message: "Email ou senha incorretos.",
      });
    }

    const profile = await this.profilesService.findByUserId(user.id);

    user.lastLoginAt = new Date();
    await this.users.save(user);

    return this.issue(user, profile, meta);
  }

  /** Revoga a sessão. Idempotente: sair duas vezes não é erro. */
  async logout(sessionId: string): Promise<void> {
    await this.sessions.update({ id: sessionId }, { revokedAt: new Date() });
  }

  /**
   * Quem está logado e QUAL PÁGINA está editando.
   *
   * O perfil devolvido é o da requisição (`auth.profileId`), não "o perfil da
   * conta". Com várias páginas por conta, buscar por `userId` devolvia sempre a
   * primeira — e o painel mostrava o nome e o endereço de uma página enquanto o
   * editor trabalhava em outra. Quem resolve qual é a página é o
   * `JwtAuthGuard`, que já conferiu a posse.
   */
  async me(profileId: string): Promise<{ user: AuthenticatedUserView; profile: OwnProfileView }> {
    const profile = await this.profilesService.findById(profileId);
    const user = await this.users.findOne({ where: { id: profile.userId } });
    if (!user) throw new UnauthorizedException("Sessão inválida.");
    return { user: toUserView(user), profile: toOwnProfileView(profile) };
  }

  /**
   * Valida o token e devolve o contexto da requisição.
   *
   * Duas verificações, e a segunda é a que importa: a assinatura do JWT diz que
   * o token é nosso, e a linha em `sessions` diz que ele **ainda vale**. Sem a
   * segunda, logout não revoga nada e um token copiado dura até expirar.
   */
  async resolveSession(token: string): Promise<ResolvedSession> {
    let payload: { sub?: string; sid?: string; pid?: string; email?: string };
    try {
      payload = await this.jwt.verifyAsync(token);
    } catch {
      throw new UnauthorizedException({ code: "invalid_token", message: "Sessão expirada." });
    }

    if (!payload.sub || !payload.sid || !payload.pid) {
      throw new UnauthorizedException({ code: "invalid_token", message: "Sessão inválida." });
    }

    const session = await this.sessions.findOne({ where: { id: payload.sid } });
    if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException({ code: "session_revoked", message: "Sessão encerrada." });
    }
    if (session.userId !== payload.sub) {
      // Token assinado por nós mas apontando para outra conta: só acontece com
      // manipulação. Trata como sessão inválida e registra.
      this.logger.warn(`token com sub divergente da sessão ${session.id}`);
      throw new UnauthorizedException({ code: "invalid_token", message: "Sessão inválida." });
    }

    return {
      userId: payload.sub,
      profileId: payload.pid,
      sessionId: session.id,
      email: payload.email ?? "",
    };
  }

  private async issue(user: User, profile: Profile, meta: SessionMeta): Promise<AuthResult> {
    const env = loadEnv();
    const expiresAt = new Date(Date.now() + ttlToMs(env.jwtTtl));

    const session = await this.sessions.save(
      this.sessions.create({
        // O `jti` é gerado aqui, e não pelo `DEFAULT gen_random_uuid()` da
        // tabela: com o default, o id só existe no banco e o objeto que o ORM
        // devolve vem sem ele — o token saía sem `sid` e toda requisição
        // seguinte era recusada com "sessão inválida". O default fica na tabela
        // como rede de segurança para escrita por fora da API.
        id: randomUUID(),
        userId: user.id,
        expiresAt,
        userAgent: meta.userAgent?.slice(0, 400) ?? null,
        ipPrefix: ipPrefix(meta.ip) ?? null,
        revokedAt: null,
      }),
    );

    const accessToken = await this.jwt.signAsync(
      { sub: user.id, sid: session.id, pid: profile.id, email: user.email },
      // Em segundos, derivado do mesmo cálculo que gerou `expiresAt`: token e
      // linha de sessão expirando em momentos diferentes é a receita para um
      // 401 que o log não explica.
      { expiresIn: Math.floor(ttlToMs(env.jwtTtl) / 1000) },
    );

    return { user: toUserView(user), profile: toOwnProfileView(profile), accessToken, expiresAt };
  }
}

export function toUserView(user: User): AuthenticatedUserView {
  return {
    id: user.id,
    email: user.email,
    isAdultConfirmed: Boolean(user.ageConfirmedAt),
    createdAt: user.createdAt.toISOString(),
  };
}

/** "7d", "12h", "30m", "3600s" ou segundos crus → milissegundos. */
export function ttlToMs(ttl: string): number {
  const match = /^(\d+)\s*([smhd])?$/.exec(ttl.trim());
  if (!match) return 7 * 86_400_000;
  const value = Number(match[1]);
  const unit = match[2] ?? "s";
  const factor = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit] ?? 1_000;
  return value * factor;
}
