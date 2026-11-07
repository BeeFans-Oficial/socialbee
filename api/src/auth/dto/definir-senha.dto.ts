import { IsString, MaxLength, MinLength } from "class-validator";

/** O link do convite (e, no futuro, do "esqueci a senha") mais a senha nova,
 *  com os mesmos limites do cadastro. */
export class DefinirSenhaDto {
  @IsString()
  @MaxLength(128)
  token: string;

  @IsString()
  @MinLength(6, { message: "A senha precisa ter ao menos 6 caracteres." })
  @MaxLength(72, { message: "A senha pode ter no máximo 72 caracteres." })
  password: string;
}
