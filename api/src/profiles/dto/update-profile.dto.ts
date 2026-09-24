import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from "class-validator";

/** Estilos de botão que o front sabe renderizar (`LinkButtonStyle`). */
export const BUTTON_STYLES = ["soft", "filled", "outlined", "glass", "pill"] as const;

/**
 * Atualização de perfil.
 *
 * Todo campo é opcional — a tela de aparência salva um campo por vez, e um DTO
 * que exigisse o objeto inteiro faria cada troca de tema reenviar bio e avatar.
 *
 * `themeId` é texto livre validado só em tamanho: o catálogo de temas
 * (`THEMES`) é apresentação e vive no front. Se a API tivesse um enum, cada
 * tema novo seria um deploy da API. `buttonStyle`, ao contrário, é fechado: são
 * cinco formas que o componente sabe desenhar, e um valor fora da lista
 * renderiza botão sem estilo.
 */
export class UpdateProfileDto {
  // ------------------------------------------------- editor de template
  //
  // O layout da página e as exceções de cor que a criadora fez por cima do
  // tema. Cor vem validada por regex aqui e por `CHECK` no banco: o valor
  // entra num `style` inline da página pública, então lixo aqui é lixo
  // renderizado — e `#fff` (três dígitos) quebra o `color-mix` do CSS.

  @IsOptional()
  @IsString()
  @MaxLength(40)
  templateId?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: "Cor inválida. Use o formato #rrggbb." })
  bgColor?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: "Cor inválida. Use o formato #rrggbb." })
  accentColor?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(40)
  fontId?: string | null;

  // Enquadramento da imagem de fundo e o escurecimento por cima dela.
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  coverPosX?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  coverPosY?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  coverOverlay?: number;

  // ---------------------------------------------- página de chegada (IAB)
  //
  // Os quatro campos abaixo descrevem o que a fã vê quando chega pelo
  // navegador embutido de um aplicativo. Os limites de tamanho repetem os
  // `CHECK` da migration de propósito: o DTO devolve mensagem legível, o
  // `CHECK` protege o dado de qualquer outro caminho de escrita.

  /** Tira a página do ar (ou devolve). Reversível, e não apaga nada. */
  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @IsOptional()
  @IsBoolean()
  iabEnabled?: boolean;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(2_000_000, { message: "Imagem muito grande. Use um arquivo menor." })
  iabImageUrl?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(60, { message: "O título da página de chegada pode ter no máximo 60 caracteres." })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  iabHeadline?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(40, { message: "O texto do botão pode ter no máximo 40 caracteres." })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  iabButtonLabel?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: "O nome de exibição não pode ficar vazio." })
  @MaxLength(60)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  displayName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]{3,30}$/, {
    message: "O link pode ter de 3 a 30 caracteres, usando letras minúsculas, números e hífen.",
  })
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: "A bio pode ter no máximo 500 caracteres." })
  bio?: string;

  /** Aceita `null` para remover a imagem. Data URL é permitida porque o MVP
   *  ainda não tem upload: o `LinkModal` lê o arquivo e manda base64. O teto de
   *  tamanho é o que impede um PNG de 8 MB virar linha de tabela. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(2_000_000, { message: "Imagem muito grande. Use um arquivo menor." })
  avatarUrl?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(2_000_000, { message: "Imagem muito grande. Use um arquivo menor." })
  coverUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  themeId?: string;

  @IsOptional()
  @IsIn(BUTTON_STYLES, { message: "Estilo de botão desconhecido." })
  buttonStyle?: string;

  @IsOptional()
  @IsBoolean()
  isAdult?: boolean;
}
