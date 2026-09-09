import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "beesocial:isPublic";

/**
 * Abre uma rota.
 *
 * O guard de sessão é **global**: rota nova nasce fechada e só abre com este
 * decorator. É o inverso do padrão comum (guard por controller), e a diferença
 * aparece no dia em que alguém adiciona um endpoint e esquece de protegê-lo —
 * aqui o esquecimento resulta em 401, não em vazamento.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
