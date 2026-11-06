import { Transform } from "class-transformer";
import { IsOptional, IsString, MaxLength } from "class-validator";

/** Só o nome curto muda. O host é identidade: trocar é outro domínio. */
export class EditarDominioDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() || null : value))
  label?: string | null;

  @IsString()
  motivo: string;
}
