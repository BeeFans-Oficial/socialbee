import { Transform, Type } from "class-transformer";
import {
  Equals,
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
 * Criação de link.
 *
 * `destinationUrl` é `string` e não `@IsUrl`: a validação real acontece em
 * `checkDestination` (`common/url.ts`), que recusa esquema não-http e host de
 * rede interna e devolve mensagem específica para cada caso. `@IsUrl` diria
 * apenas "URL inválida" e deixaria passar `http://10.0.0.1`.
 *
 * `shortCode` não está aqui de propósito: quem escolhe o código é o servidor. Um
 * cliente que pudesse escolhê-lo poderia tentar sequestrar o código de outra
 * criadora por colisão, e o código é o endereço público do link.
 */
export class CreateLinkDto {
  @IsString()
  @MinLength(1, { message: "Dê um título ao link." })
  @MaxLength(80)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  title: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(120)
  subtitle?: string | null;

  /** Data URL da miniatura enquanto não existe upload de arquivo. */
  @IsOptional()
  @Equals(null, { message: "Imagem entra pela rota de upload; aqui só `null`, para remover." })
  thumbnailUrl?: string | null;

  /** Rótulo do canal ("onlyfans", "telegram"…). Aberto: o catálogo de
   *  plataformas é do front (`PLATFORMS`), e um canal novo não pode exigir
   *  deploy da API. */
  @IsOptional()
  @IsString()
  @MaxLength(30)
  platform?: string;

  @IsString()
  @MaxLength(2048)
  destinationUrl: string;

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

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @ValidateNested()
  @Type(() => SafePageDto)
  safePage?: SafePageDto | null;
}
