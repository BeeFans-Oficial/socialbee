import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { PageOwner } from "./entities/page-owner.entity";
import { Profile } from "./entities/profile.entity";

export interface OwnerView {
  id: string;
  name: string;
  /** Quantas páginas da conta são deste dono. */
  paginas: number;
}

/**
 * Donos de página: o agrupamento dentro da conta.
 *
 * Tudo aqui é escopado por `userId`: um dono de outra conta não existe para
 * quem pede (404, nunca 403), como no resto da API.
 */
@Injectable()
export class OwnersService {
  constructor(
    @InjectRepository(PageOwner) private readonly owners: Repository<PageOwner>,
    @InjectRepository(Profile) private readonly profiles: Repository<Profile>,
  ) {}

  /**
   * Os donos da conta, com a contagem de páginas de cada um.
   *
   * Uma consulta só: a contagem vem do `LEFT JOIN` agregado, e não de uma
   * consulta por dono. Em ordem alfabética, que é como a lista é lida.
   */
  async list(userId: string): Promise<OwnerView[]> {
    const linhas = await this.owners
      .createQueryBuilder("o")
      .leftJoin(Profile, "p", "p.owner_id = o.id")
      .select("o.id", "id")
      .addSelect("o.name", "name")
      .addSelect("COUNT(p.id)", "paginas")
      .where("o.user_id = :userId", { userId })
      .groupBy("o.id")
      .orderBy("lower(o.name)", "ASC")
      .getRawMany<{ id: string; name: string; paginas: string }>();
    return linhas.map((l) => ({ id: l.id, name: l.name, paginas: Number(l.paginas) }));
  }

  async create(userId: string, name: string): Promise<OwnerView> {
    await this.exigirNomeLivre(userId, name);
    const criado = await this.owners.save(this.owners.create({ userId, name }));
    return { id: criado.id, name: criado.name, paginas: 0 };
  }

  async rename(userId: string, ownerId: string, name: string): Promise<OwnerView> {
    const dono = await this.doUsuario(userId, ownerId);
    if (name !== dono.name) {
      await this.exigirNomeLivre(userId, name, ownerId);
      dono.name = name;
      await this.owners.save(dono);
    }
    const paginas = await this.profiles.count({ where: { userId, ownerId } });
    return { id: dono.id, name: dono.name, paginas };
  }

  /** Apaga o dono. As páginas dele ficam, sem dono (`ON DELETE SET NULL`). */
  async remove(userId: string, ownerId: string): Promise<void> {
    const dono = await this.doUsuario(userId, ownerId);
    await this.owners.delete({ id: dono.id, userId });
  }

  /** O dono existe E é desta conta? É o que impede atribuir uma página ao
   *  dono de outra pessoa trocando um id. */
  async exigirDaConta(userId: string, ownerId: string): Promise<void> {
    await this.doUsuario(userId, ownerId);
  }

  private async doUsuario(userId: string, ownerId: string): Promise<PageOwner> {
    const dono = await this.owners.findOne({ where: { id: ownerId, userId } });
    if (!dono) throw new NotFoundException("Dono não encontrado.");
    return dono;
  }

  /**
   * Nome repetido na conta vira um 409 legível, em vez de o índice único
   * estourar como erro interno. A corrida entre dois pedidos iguais ainda
   * para no índice; é rara e manual, e o pior caso é um erro genérico.
   */
  private async exigirNomeLivre(userId: string, name: string, excetoId?: string): Promise<void> {
    const repetido = await this.owners
      .createQueryBuilder("o")
      .where("o.user_id = :userId", { userId })
      .andWhere("lower(o.name) = lower(:name)", { name })
      .andWhere(excetoId ? "o.id <> :excetoId" : "TRUE", { excetoId })
      .getExists();
    if (repetido) {
      throw new ConflictException({
        code: "dono_repetido",
        message: "Já existe um dono com esse nome.",
      });
    }
  }
}
