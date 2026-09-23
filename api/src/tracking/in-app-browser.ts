/**
 * Detector de NAVEGADOR EMBUTIDO (in-app browser, ou IAB).
 *
 * Vive ao lado de `bots.ts` e responde a outra pergunta. O filtro de robô
 * separa gente de máquina; este separa, DENTRO do tráfego humano, quem chegou
 * pelo navegador embutido de um aplicativo — o do Instagram, acima de todos.
 *
 * Por que isso é um problema de produto: o navegador embutido do Instagram não
 * tem barra de endereço, não compartilha sessão com o Chrome ou o Safari da
 * pessoa, e em muitos aparelhos recusa abrir esquemas de outros aplicativos. A
 * fã clica no link da bio, cai numa janela que não sabe sair dali, e o destino
 * da criadora nunca é alcançado. É a perda que o produto existe para evitar.
 *
 * **A distinção que custa caro errar** está registrada em `bots.ts`: o UA do
 * navegador embutido do Instagram traz `Instagram`, e ele é HUMANO. Por isso
 * `Instagram` está fora da lista de robôs de lá e é o primeiro sinal daqui. As
 * duas listas são complementares de propósito, não redundantes.
 *
 * Existe um detector parecido no front (`lib/cloak.ts`), e a duplicação é
 * deliberada: aquele roda no clique, sobre `navigator.userAgent`, para decidir
 * como escapar; este roda na chegada, sobre o cabeçalho da requisição, para
 * decidir o que renderizar. São processos diferentes, em pacotes diferentes, e
 * unificá-los exigiria um módulo compartilhado entre a API e o app — custo
 * maior que o de duas listas de quinze linhas.
 */

export type InAppSource = "instagram" | "facebook" | "tiktok" | "other";
export type DevicePlatform = "android" | "ios" | "other";

export interface InAppBrowserVerdict {
  isInApp: boolean;
  /** Qual aplicativo embutiu o navegador. `null` quando não é IAB. */
  source: InAppSource | null;
  /** Decide a técnica de escape: no Android é intent URL; no iOS, instrução. */
  platform: DevicePlatform;
}

/**
 * Sinais por aplicativo.
 *
 * `FBAN`/`FBAV`/`FB_IAB` e não a palavra "facebook": o gerador de prévia da
 * Meta se identifica como `facebookexternalhit` e é ROBÔ — casar pela palavra
 * solta mandaria o crawler para o ramo de humano.
 *
 * `\bTwitter\b` pelo mesmo motivo, ao contrário: a fronteira de palavra deixa
 * `Twitterbot` de fora, que é robô e está na lista de `bots.ts`.
 */
const SINAIS: ReadonlyArray<{ source: InAppSource; pattern: RegExp }> = [
  { source: "instagram", pattern: /Instagram/i },
  { source: "facebook", pattern: /FBAN|FBAV|FB_IAB/i },
  { source: "tiktok", pattern: /BytedanceWebview|musical_ly|TikTok/i },
  { source: "other", pattern: /\bLine\/|Snapchat|\bTwitter\b|KAKAOTALK|Pinterest/i },
];

export function detectInAppBrowser(userAgent: string): InAppBrowserVerdict {
  const ua = userAgent ?? "";
  const platform: DevicePlatform = /Android/i.test(ua)
    ? "android"
    : /iPhone|iPad|iPod/i.test(ua)
      ? "ios"
      : "other";

  for (const sinal of SINAIS) {
    if (sinal.pattern.test(ua)) {
      return { isInApp: true, source: sinal.source, platform };
    }
  }

  return { isInApp: false, source: null, platform };
}
