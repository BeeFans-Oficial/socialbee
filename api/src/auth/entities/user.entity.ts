import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

import { Profile } from "../../profiles/entities/profile.entity";

/**
 * Identidade de acesso.
 *
 * Separada de `Profile` de propósito: aqui mora o que autentica (email, hash de
 * senha), lá mora o que o público vê. Nenhuma consulta de perfil público
 * precisa tocar esta tabela, o que torna difícil vazar email de criadora por
 * descuido num `SELECT *`.
 */
@Entity({ name: "users" })
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  /** Guardado sempre em minúsculas — a unicidade é do endereço, não da
   *  capitalização que a pessoa digitou. O `CHECK` no banco garante. */
  @Column({ name: "email", type: "text", unique: true })
  email: string;

  @Column({ name: "password_hash", type: "text" })
  passwordHash: string;

  /** Quando a pessoa declarou ter 18+. É registro de consentimento: a data
   *  importa, o booleano sozinho não prova nada. */
  @Column({ name: "age_confirmed_at", type: "timestamptz", nullable: true })
  ageConfirmedAt: Date | null;

  @Column({ name: "last_login_at", type: "timestamptz", nullable: true })
  lastLoginAt: Date | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt: Date;

  @OneToMany(() => Profile, (profile) => profile.user)
  profiles: Profile[];
}
