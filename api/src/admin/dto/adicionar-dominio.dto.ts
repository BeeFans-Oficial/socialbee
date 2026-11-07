import { Transform } from "class-transformer";
import { IsOptional, IsString, MaxLength } from "class-validator";

/**
 * Domínio novo no pool. Nasce PAUSADO: cadastrar aqui não faz o endereço
 * responder — antes vêm o registro A, o `server_name` no nginx e o
 * certificado. O admin ativa quando o domínio já abre em HTTPS; ativar antes
 * oferece à criadora um endereço com erro de TLS, e ela descobre pelas fãs.
 */
export class AdicionarDominioDto {
  @IsString()
  @MaxLength(260)
  host: string;

  /** Nome curto para a criadora escolher por aparência, não por técnica. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() || null : value))
  label?: string | null;

  @IsString()
  motivo: string;
}
