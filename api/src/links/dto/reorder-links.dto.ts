import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from "class-validator";

/**
 * Nova ordem dos links.
 *
 * O cliente manda a lista de ids na ordem final, não pares `{id, position}`.
 * A razão é o drag-and-drop: `@dnd-kit` já produz o array reordenado
 * (`arrayMove`), e deixar o cliente calcular posição abre espaço para duas
 * linhas com a mesma posição — que é ordem indefinida na página pública.
 *
 * O servidor numera de 0 a n-1 dentro de uma transação.
 */
export class ReorderLinksDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200, { message: "Ordem com links demais." })
  @IsUUID("4", { each: true, message: "Id de link inválido." })
  ids: string[];
}
