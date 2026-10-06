import { IsString, MaxLength } from "class-validator";

export class CreateCustomDomainDto {
  /** O domínio como a criadora digitou — com ou sem `https://`, com ou sem
   *  barra. O serviço normaliza antes de validar. */
  @IsString()
  @MaxLength(253)
  host: string;
}
