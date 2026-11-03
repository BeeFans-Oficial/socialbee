import { SetMetadata } from "@nestjs/common";

import type { Papel } from "../../admin/entities/admin-action.entity";

export const ROLES_KEY = "papeis";

/**
 * Exige um papel na conta para a rota (ou o controller inteiro).
 *
 *     @Roles("admin")
 *
 * Quem decide é o `RolesGuard`, registrado globalmente depois do
 * `JwtAuthGuard`: a sessão já foi resolvida e o papel veio do banco junto
 * com ela. Rota sem `@Roles()` não exige papel nenhum — o padrão continua
 * sendo "qualquer conta com sessão".
 */
export const Roles = (...papeis: Papel[]) => SetMetadata(ROLES_KEY, papeis);
