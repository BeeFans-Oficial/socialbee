import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from "class-validator";

import { AppearanceDto } from "./appearance.dto";
import { SafePageDto } from "./safe-page.dto";

/**
 * Edição de link.
 *
 * Tudo opcional: o modal salva em pedaços (um blur de campo, uma troca de cor),
 * então exigir o objeto completo faria cada tecla reenviar a miniatura em
 * base64.
 *
 * Escrito à mão em vez de `PartialType(CreateLinkDto)` por dois motivos: a
 * dependência (`@nestjs/mapped-types`) é ESM e não carrega no Jest, e ter o DTO
 * explícito deixa visível o que dá para editar — `title` aqui é opcional, mas
 * quando vem NÃO pode ser vazio, e essa é a regra que um `PartialType`
 * genérico não expressa.
 */
export class UpdateLinkDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: "O título não pode ficar vazio." })
  @MaxLength(80)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  title?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(120)
  subtitle?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(2_000_000, { message: "Imagem muito grande. Use um arquivo menor." })
  thumbnailUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  platform?: string;

  /** A validação real (esquema http(s), host não interno) acontece em
   *  `checkDestination`, no serviço — ver `create-link.dto.ts`. */
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  destinationUrl?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  cloakEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => AppearanceDto)
  appearance?: AppearanceDto;

  /** `null` remove a página segura do link. Ausente não mexe nela — a
   *  diferença importa: o modal manda `appearance` sozinho o tempo todo, e um
   *  DTO que tratasse ausência como `null` apagaria a safe page a cada troca
   *  de cor. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @ValidateNested()
  @Type(() => SafePageDto)
  safePage?: SafePageDto | null;
}
