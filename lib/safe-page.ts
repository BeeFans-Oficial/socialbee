export interface SafePageContent {
  displayName: string;
  socialLinks: Array<{ platform: string; url: string; title: string }>;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

/** Documento independente do layout Next, sem scripts nem destino principal. */
export function renderSafePage(page: SafePageContent): string {
  const links = page.socialLinks.flatMap((link) => {
    try {
      const url = new URL(link.url);
      if (url.protocol !== "https:" && url.protocol !== "http:") return [];
      return [`<li><a href="${escapeHtml(url.href)}" rel="noopener noreferrer">${escapeHtml(link.title || link.platform)}</a></li>`];
    } catch { return []; }
  }).join("");
  const name = escapeHtml(page.displayName);
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${name}</title></head><body><main><h1>${name}</h1><ul>${links}</ul></main></body></html>`;
}
