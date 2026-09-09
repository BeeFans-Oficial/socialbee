import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
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
