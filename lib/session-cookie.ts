/**
 * Nome do cookie de sessão, num lugar só.
 *
 * O `proxy.ts` já lê isto para barrar as rotas do painel, e a rota de perfil
 * precisa do mesmo valor para saber se quem pede tem sessão — critério da
 * prévia de robô (ver `app/[slug]/page.tsx`). Repetir a string nos dois
 * arquivos é como um `COOKIE_NAME` customizado passa a valer só em metade do
 * app.
 */
export const SESSION_COOKIE = process.env.COOKIE_NAME || "beesocial_session";
