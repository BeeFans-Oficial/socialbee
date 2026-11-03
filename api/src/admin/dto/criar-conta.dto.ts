import { Transform } from "class-transformer";
import { IsEmail, IsString, Matches, MaxLength, MinLength } from "class-validator";

/**
 * Conta criada pelo admin. Os mesmos limites do cadastro (`RegisterDto`):
 * o que a tela de cadastro aceita, o admin também aceita, e nada além.
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
  @MinLength(1, { message: "Escolha um nome de exibição." })
  @MaxLength(60)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  displayName: string;

  @IsString()
  @Matches(/^[a-z0-9-]{3,30}$/, {
    message: "O link pode ter de 3 a 30 caracteres, usando letras minúsculas, números e hífen.",
  })
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  slug: string;

  @IsString()
  motivo: string;
}
