import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsString, IsUrl, MaxLength, ValidateNested } from "class-validator";

export class SafePageSocialLinkDto {
  @IsString()
  @MaxLength(30)
  platform: string;

  @IsUrl({ protocols: ["http", "https"], require_protocol: true }, { message: "URL inválida." })
  @MaxLength(2048)
  url: string;

  @IsString()
  @MaxLength(80)
  title: string;
}

/**
 * A página limpa do cloaking.
 *
 * O teto de 12 redes não é arbitrário: é o número de plataformas que o
 * `LinkModal` oferece com folga. Sem teto, o payload da safe page é uma lista
 * livre que qualquer cliente pode inflar.
 */
export class SafePageDto {
  @IsArray()
  @ArrayMaxSize(12, { message: "No máximo 12 redes na página segura." })
  @ValidateNested({ each: true })
  @Type(() => SafePageSocialLinkDto)
  socialLinks: SafePageSocialLinkDto[];
}
