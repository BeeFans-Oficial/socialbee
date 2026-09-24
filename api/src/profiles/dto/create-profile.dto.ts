import { Transform } from "class-transformer";
import { IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

/**
 * Criação de uma PÁGINA nova para a conta.
 *
 * Só o essencial para a página existir e ter endereço: nome, slug e, se ela
 * quiser, o modelo já escolhido. Todo o resto — cores, imagem de fundo, bio,
 * links — se edita depois, no editor.
 *
 * Pedir o mínimo aqui é decisão de produto: criar uma página é um gesto que
 * acontece no meio de outra coisa ("quero uma página só para a campanha X"), e
 * um formulário longo nesse momento faz a pessoa desistir.
 */
export class CreateProfileDto {
  @IsString()
  @MinLength(1, { message: "Dê um nome à página." })
  @MaxLength(60)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  displayName: string;

  @IsString()
  @Matches(/^[a-z0-9-]{3,30}$/, {
    message: "O link pode ter de 3 a 30 caracteres, usando letras minúsculas, números e hífen.",
  })
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  slug: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  templateId?: string;

  /** Barreira de idade. Herda da página de origem quando não vem — é o caso
   *  comum: quem tem uma página adulta cria outra adulta. */
  @IsOptional()
  @IsBoolean()
  isAdult?: boolean;
}
