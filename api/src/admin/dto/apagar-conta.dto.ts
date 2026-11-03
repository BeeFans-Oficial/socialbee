import { Transform } from "class-transformer";
import { IsString } from "class-validator";

/** Apagar exige digitar o e-mail da conta: é irreversível e leva junto
 *  páginas, links, histórico e domínios próprios. */
export class ApagarContaDto {
  @IsString()
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  confirmacao: string;

  @IsString()
  motivo: string;
}
