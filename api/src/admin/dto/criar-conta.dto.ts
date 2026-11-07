import { Transform } from "class-transformer";
import { IsEmail, IsString, MaxLength } from "class-validator";

/**
 * Conta criada pelo admin: só o e-mail. A senha é a pessoa quem cria, pelo
 * link do convite — senha definida pelo admin seria senha conhecida por
 * duas pessoas. A página também NÃO nasce aqui: a própria pessoa cria a
 * primeira em "Páginas" (ver `@SemPagina()`), com o nome e o endereço que
 * quiser.
 *
 * Não há `ageConfirmed`: a declaração de maioridade é da própria pessoa, e o
 * admin não pode assinar por ela. A conta nasce com `age_confirmed_at` nulo.
 */
export class CriarContaDto {
  @IsEmail({}, { message: "Email inválido." })
  @MaxLength(254)
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  email: string;

  @IsString()
  motivo: string;
}
