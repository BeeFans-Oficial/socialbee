import { Transform } from "class-transformer";
import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";

/**
 * Conta criada pelo admin: só e-mail e senha, com os limites do cadastro
 * (`RegisterDto`). A página NÃO nasce aqui — a própria pessoa cria a primeira
 * em "Páginas" (ver `@SemPagina()`), com o nome e o endereço que quiser.
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
  @MinLength(6, { message: "A senha precisa ter ao menos 6 caracteres." })
  @MaxLength(72, { message: "A senha pode ter no máximo 72 caracteres." })
  password: string;

  @IsString()
  motivo: string;
}
