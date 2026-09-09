import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

/**
 * Cadastro.
 *
 * Os limites espelham o que o formulário do MVP já valida
 * (`app/(auth)/cadastro/page.tsx`): senha de 6 caracteres, slug de 3 a 30 em
 * `[a-z0-9-]`. Manter o mesmo mínimo é decisão consciente — endurecer só aqui
 * criaria um estado em que o botão "Criar conta" acende e a API recusa, que é a
 * pior forma de exigir senha forte. O medidor de força na tela continua sendo o
 * incentivo.
 */
export class RegisterDto {
  @IsEmail({}, { message: "Email inválido." })
  @MaxLength(254)
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  email: string;

  @IsString()
  @MinLength(6, { message: "A senha precisa ter ao menos 6 caracteres." })
  // O teto existe porque bcrypt ignora o que passa de 72 bytes: aceitar uma
  // senha de 500 caracteres e truncar em silêncio engana quem a escolheu.
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

  /** Declaração de maioridade de quem se cadastra. Obrigatória: é registro de
   *  consentimento, e sem ela o cadastro não acontece. */
  @IsBoolean()
  ageConfirmed: boolean;

  /** Liga a barreira de idade no perfil público. É sobre o CONTEÚDO, não sobre
   *  a pessoa — por isso é separado de `ageConfirmed`. */
  @IsOptional()
  @IsBoolean()
  isAdult?: boolean;
}
