import type { Mensagem } from "../email.service";

/**
 * Aviso de que a revisão da madrugada ficou vermelha para uma página que
 * não estava. Curto: o que está errado, o que fazer, o link do editor.
 */
export function revisaoPiorou(input: {
  para: string;
  nome: string | null;
  slug: string;
  host: string;
  problemas: { titulo: string; acao: string }[];
  linkDoEditor: string;
  siteUrl: string;
}): Mensagem {
  const nome = input.nome?.trim() || null;
  const assunto = `Sua página ${input.host}/${input.slug} precisa de atenção antes de ir na bio`;
  const lista = input.problemas.map((p) => `- ${p.titulo}: ${p.acao}`).join("\n");

  const texto = [
    nome ? `Oi, ${nome}!` : "Oi!",
    "",
    `A revisão automática da sua página ${input.host}/${input.slug} encontrou o que já derrubou contas do Instagram:`,
    "",
    lista,
    "",
    `Corrija no editor: ${input.linkDoEditor}`,
    "",
    "Depois de corrigir, rode a revisão de novo na tela da página. Enquanto estiver vermelha, evite colar o link numa bio nova.",
    "",
    `BeeSocial · ${input.siteUrl}`,
  ].join("\n");

  const itens = input.problemas
    .map((p) => `<li style="margin:0 0 8px;"><strong style="color:#fff;">${escapar(p.titulo)}</strong><br>${escapar(p.acao)}</li>`)
    .join("");

  const html = `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapar(assunto)}</title></head>
<body style="margin:0;padding:0;background:#0d0d0d;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d0d;">
<tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#161616;border:1px solid #2a2a2a;border-radius:16px;">
    <tr><td style="padding:32px 28px 8px;font-family:Helvetica,Arial,sans-serif;">
      <div style="font-size:13px;letter-spacing:0.18em;text-transform:uppercase;color:#FF3C6E;font-weight:700;">BeeSocial</div>
    </td></tr>
    <tr><td style="padding:8px 28px 0;font-family:Helvetica,Arial,sans-serif;color:#ffffff;">
      <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;font-weight:700;">${nome ? `Oi, ${escapar(nome)}. ` : ""}Sua página precisa de atenção.</h1>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#c9c9c9;">
        A revisão automática de <strong style="color:#fff;">${escapar(input.host)}/${escapar(input.slug)}</strong> encontrou o que já derrubou contas do Instagram:
      </p>
      <ul style="margin:0 0 20px;padding-left:20px;font-size:14px;line-height:1.5;color:#c9c9c9;">${itens}</ul>
    </td></tr>
    <tr><td align="center" style="padding:4px 28px 24px;">
      <a href="${escapar(input.linkDoEditor)}" style="display:inline-block;background:#FF3C6E;color:#ffffff;text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;padding:14px 28px;border-radius:10px;">Corrigir no editor</a>
    </td></tr>
    <tr><td style="padding:0 28px 28px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#8a8a8a;">
      Depois de corrigir, rode a revisão de novo na tela da página. Enquanto estiver vermelha, evite colar o link numa bio nova.
    </td></tr>
  </table>
  <p style="margin:16px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#6b6b6b;">BeeSocial · <a href="${escapar(input.siteUrl)}" style="color:#6b6b6b;">${escapar(input.siteUrl)}</a></p>
</td></tr>
</table>
</body>
</html>`;

  return { para: input.para, assunto, html, texto };
}

function escapar(valor: string): string {
  return valor.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
