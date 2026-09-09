import { IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength } from "class-validator";

const STYLES = ["soft", "filled", "outlined", "glass", "pill"] as const;

/** Cor em hexadecimal de 3 ou 6 dígitos. Validar aqui evita que uma string
 *  qualquer entre no `style` do botão na página pública — é `jsonb`, mas
 *  `jsonb` não é desculpa para aceitar qualquer coisa. */
const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export class AppearanceDto {
  @IsIn(STYLES, { message: "Estilo de botão desconhecido." })
  style: (typeof STYLES)[number];

  @Matches(HEX, { message: "Cor inválida." })
  color: string;

  @IsBoolean()
  useGradient: boolean;

  @Matches(HEX, { message: "Cor final do gradiente inválida." })
  gradientTo: string;

  @IsBoolean()
  glow: boolean;

  @IsBoolean()
  showIcon: boolean;

  @IsBoolean()
  showArrow: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  themePresetId?: string;
}
