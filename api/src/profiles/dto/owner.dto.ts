import { Transform } from "class-transformer";
import { IsString, IsUUID, MaxLength, MinLength, ValidateIf } from "class-validator";

/** Criar e renomear um dono pedem a mesma coisa: o nome. */
export class OwnerDto {
  @IsString()
  @MinLength(1, { message: "Dê um nome ao dono." })
  @MaxLength(60)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  name: string;
}

/** De quem é a página. `null` tira o dono ("Sem dono"). */
export class SetOwnerDto {
  // `null` é um valor válido e explícito; campo AUSENTE não é — senão um
  // corpo vazio tiraria o dono da página sem ninguém ter pedido.
  @ValidateIf((dto: SetOwnerDto) => dto.ownerId !== null)
  @IsUUID()
  ownerId: string | null;
}
