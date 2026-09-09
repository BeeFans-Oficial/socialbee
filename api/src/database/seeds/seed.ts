import { hashSync } from "bcryptjs";
import { Client } from "pg";

import { loadEnv } from "../../config/env";

/**
 * Seed do ambiente de desenvolvimento.
 *
 * Recria em Postgres exatamente o que `lib/mock-data.ts` tinha em memória: a
 * conta da Bella (o login que o README documenta) e os cinco links, **com os
 * mesmos códigos curtos**. Isso não é enfeite: qualquer `/r/xK9mP1` que já
 * exista num print, num teste ou no histórico do navegador de alguém continua
 * resolvendo depois da migração.
 *
 * É DML escrito à mão, com `ON CONFLICT DO NOTHING`, e por isso pode rodar em
 * toda subida do container sem duplicar nada nem sobrescrever o que a criadora
 * editou depois.
 *
 * Em produção não roda: `SEED_DEMO=false` (o default quando `NODE_ENV` é
 * production) evita que uma conta com senha conhecida apareça num banco real.
 */

const DEMO_EMAIL = "bella@beesocial.app";
const DEMO_PASSWORD = "123456";

interface SeedLink {
  title: string;
  platform: string;
  shortCode: string;
  destinationUrl: string;
  isActive: boolean;
  position: number;
  cloakEnabled: boolean;
}

/** Os mesmos cinco links de `MOCK_LINKS`, na mesma ordem. */
const DEMO_LINKS: SeedLink[] = [
  {
    title: "Meu OnlyFans 🔥",
    platform: "onlyfans",
    shortCode: "xK9mP1",
    destinationUrl: "https://onlyfans.com/bella",
    isActive: true,
    position: 0,
    cloakEnabled: true,
  },
  {
    title: "Telegram VIP 💎",
    platform: "telegram",
    shortCode: "aB3nQ2",
    destinationUrl: "https://t.me/bellavip",
    isActive: true,
    position: 1,
    cloakEnabled: true,
  },
  {
    title: "Instagram 📸",
    platform: "instagram",
    shortCode: "mZ7rL3",
    destinationUrl: "https://instagram.com/bella",
    isActive: true,
    position: 2,
    cloakEnabled: false,
  },
  {
    title: "WhatsApp Direto 💬",
    platform: "whatsapp",
    shortCode: "pR2wX4",
    destinationUrl: "https://wa.me/5511999999999",
    isActive: true,
    position: 3,
    cloakEnabled: true,
  },
  {
    title: "Pack Especial 👑",
    platform: "privacy",
    shortCode: "tY5nM5",
    destinationUrl: "https://privacy.com.br/bella",
    isActive: false,
    position: 4,
    cloakEnabled: true,
  },
];

/** Aparência padrão, igual a `DEFAULT_LINK_APPEARANCE` no front. */
const DEFAULT_APPEARANCE = {
  style: "soft",
  color: "#FF3C6E",
  useGradient: false,
  gradientTo: "#FF1F57",
  glow: false,
  showIcon: true,
  showArrow: true,
};

export async function seed(): Promise<void> {
  const env = loadEnv();

  const enabled = (process.env.SEED_DEMO ?? (env.isProduction ? "false" : "true")).toLowerCase();
  if (enabled !== "true" && enabled !== "1") {
    console.log("[seed] SEED_DEMO desligado — nada a fazer.");
    return;
  }

  const client = new Client({
    connectionString: env.databaseUrl,
    ssl: env.dbSsl ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();

  try {
    await client.query(`SET search_path TO "${env.dbSchema}", public`);
    await client.query("BEGIN");

    // O custo do hash aqui é o configurado: um hash de custo diferente do resto
    // do sistema é a única forma de a conta de demonstração se comportar
    // diferente no login, e isso confunde teste manual.
    const passwordHash = hashSync(DEMO_PASSWORD, env.bcryptRounds);

    const user = await client.query<{ id: string }>(
      `
      INSERT INTO users (email, password_hash, age_confirmed_at)
      VALUES ($1, $2, now())
      ON CONFLICT (email) DO NOTHING
      RETURNING id
      `,
      [DEMO_EMAIL, passwordHash],
    );

    // `ON CONFLICT DO NOTHING` não devolve linha quando já existia: busca o id.
    const userId =
      user.rows[0]?.id ??
      (
        await client.query<{ id: string }>(`SELECT id FROM users WHERE email = $1`, [DEMO_EMAIL])
      ).rows[0]?.id;

    if (!userId) throw new Error("não foi possível criar nem encontrar a conta de demonstração");

    const profile = await client.query<{ id: string }>(
      `
      INSERT INTO profiles (user_id, slug, display_name, bio, theme_id, button_style, is_adult)
      VALUES ($1, 'bella', 'Bella ✨',
              'Conteúdo exclusivo para quem quer mais 🔥 Entre nos meus links abaixo 👇',
              'neon-pink', 'soft', true)
      ON CONFLICT (slug) DO NOTHING
      RETURNING id
      `,
      [userId],
    );

    const profileId =
      profile.rows[0]?.id ??
      (
        await client.query<{ id: string }>(`SELECT id FROM profiles WHERE slug = 'bella'`)
      ).rows[0]?.id;

    if (!profileId) throw new Error("não foi possível criar nem encontrar o perfil de demonstração");

    for (const link of DEMO_LINKS) {
      await client.query(
        `
        INSERT INTO links
          (profile_id, title, platform, short_code, destination_url,
           is_active, position, cloak_enabled, appearance)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
        ON CONFLICT (short_code) DO NOTHING
        `,
        [
          profileId,
          link.title,
          link.platform,
          link.shortCode,
          link.destinationUrl,
          link.isActive,
          link.position,
          link.cloakEnabled,
          JSON.stringify(DEFAULT_APPEARANCE),
        ],
      );
    }

    await client.query("COMMIT");

    const counts = await client.query<{ links: string }>(
      `SELECT count(*)::text AS links FROM links WHERE profile_id = $1`,
      [profileId],
    );
    console.log(
      `[seed] conta ${DEMO_EMAIL} (senha ${DEMO_PASSWORD}), perfil /bella, ${counts.rows[0].links} link(s).`,
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("[seed] falhou:", error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
