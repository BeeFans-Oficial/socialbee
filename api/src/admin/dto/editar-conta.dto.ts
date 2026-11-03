import { Transform } from "class-transformer";
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

/** O que o admin pode mudar numa conta: o e-mail e a senha. Ambos opcionais,
 *  mas ao menos um precisa vir. */
export class EditarContaDto {
  @IsOptional()
  @IsEmail({}, { message: "Email inválido." })
  @MaxLength(254)
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(6, { message: "A senha precisa ter ao menos 6 caracteres." })
  @MaxLength(72, { message: "A senha pode ter no máximo 72 caracteres." })
  novaSenha?: string;

  @IsString()
  motivo: string;
}
