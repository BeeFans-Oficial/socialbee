import { HexBackground } from "@/components/shared/HexBackground";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { type User } from "@/lib/catalog";
import { resolverVisual } from "@/lib/templates";

/**
 * O perfil como um cliente NÃO HUMANO o recebe.
 *
 * Entrega identidade — nome, bio, avatar, selo de idade — e **não entrega a
 * lista de links**. Isso é retenção de conteúdo de quem não é gente, no mesmo
 * espírito do `noindex` que o redirecionador já manda: um crawler de prévia não
 * precisa dos destinos, e o produto inteiro depende de o destino não estar no
 * documento (é o que mantém o link fora do alcance de quem varre HTML).
 *
 * Vale ser explícito sobre o que isto NÃO é: não há link fabricado aqui, nem
 * página falsa. É a mesma criadora, a mesma bio, o mesmo avatar — só sem os
 * botões. Quem executa JavaScript, inclusive um revisor humano com um navegador
 * de verdade, recebe `ProfileClient` e vê a página real.
 *
 * Antes desta bifurcação existir, o comportamento era o mesmo por acidente: a
 * página era um componente de cliente, então quem não roda JS recebia uma casca
 * sem NADA — nem o nome da criadora. Isso quebrava a prévia para as fãs também,
 * que é o que motivou a mudança.
 */
export function BotProfile({ user }: { user: User }) {
  // Sem imagem de fundo e sem template: para o robô, o cabeçalho é identidade,
  // não vitrine. Passar a capa aqui mandaria uma imagem grande a quem só vai
  // ler texto, e o tamanho do documento é o que mais importa nesse caminho.
  const visual = resolverVisual({ themeId: user.themeId });

  return (
    <div
      className="relative min-h-screen text-bee-text overflow-hidden"
      style={{ backgroundColor: visual.bg }}
    >
      <HexBackground density="medium" />

      <div className="relative z-10 pb-20">
        <ProfileHeader user={user} visual={visual} activePlatforms={[]} />
      </div>
    </div>
  );
}
