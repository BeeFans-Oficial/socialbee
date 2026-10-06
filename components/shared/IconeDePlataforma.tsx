import {
  AtSign,
  Camera,
  Globe,
  Heart,
  Link2,
  Lock,
  MessageCircle,
  Music2,
  Play,
  Send,
  type LucideIcon,
} from "lucide-react";

/**
 * Ícone de linha, neutro, para cada plataforma — no painel.
 *
 * O catálogo (`lib/catalog.ts`) tem um emoji e uma cor por plataforma, e a
 * página pública da criadora continua usando os dois. No painel eles viravam
 * um arco-íris de etiquetas e figurinhas; aqui a plataforma se reconhece pela
 * forma, e a cor fica para o que é ação.
 */
const ICONES: Record<string, LucideIcon> = {
  onlyfans: Heart,
  privacy: Lock,
  telegram: Send,
  whatsapp: MessageCircle,
  instagram: Camera,
  tiktok: Music2,
  twitter: AtSign,
  youtube: Play,
  site: Globe,
};

export function IconeDePlataforma({ plataforma, className }: { plataforma: string; className?: string }) {
  const Icone = ICONES[plataforma] ?? Link2;
  return <Icone className={className} />;
}
