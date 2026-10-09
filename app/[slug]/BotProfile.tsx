import { CeuEstrelado } from "@/components/landing/CeuEstrelado";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { type User } from "@/lib/catalog";
import { resolverVisual } from "@/lib/templates";

/** Identidade e redes sociais das Safe Pages, sem destinos principais. */
export function BotProfile({ user, socialLinks = [] }: {
  user: User;
  socialLinks?: Array<{ platform: string; url: string; title: string }>;
}) {
  const seen = new Set<string>();
  const links = socialLinks.filter((link) => {
    try {
      const url = new URL(link.url);
      if (!["http:", "https:"].includes(url.protocol) || seen.has(url.href)) return false;
      seen.add(url.href);
      return true;
    } catch { return false; }
  });
  // Sem imagem de fundo e sem template: para o robô, o cabeçalho é identidade,
  // não vitrine. Passar a capa aqui mandaria uma imagem grande a quem só vai
  // ler texto, e o tamanho do documento é o que mais importa nesse caminho.
  const visual = resolverVisual({ themeId: user.themeId });

  return (
    <div
      className="relative min-h-screen text-bee-text overflow-hidden"
      style={{ backgroundColor: visual.bg }}
    >
      <CeuEstrelado brilho={false} />

      <div className="relative z-10 pb-20">
        <ProfileHeader user={user} visual={visual} activePlatforms={[]} />
        <ul className="mx-auto max-w-md px-6 space-y-3">
          {links.map((link) => (
            <li key={link.url}>
              <a href={link.url} rel="noopener noreferrer" className="block rounded-xl bg-white px-6 py-4 text-center text-black font-semibold">
                {link.title || link.platform}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
