import type { Mensagem } from "../email.service";

/**
 * O convite: a equipe criou a conta, a pessoa cria a própria senha. Clicar
 * no link prova que o e-mail é dela, então não há um segundo e-mail de
 * confirmação. Mesmas regras de HTML de `boas-vindas.ts`.
 */
export function convite(input: { para: string; linkParaCriarSenha: string; siteUrl: string; validadeEmDias: number }): Mensagem {
  const assunto = "Sua conta no BeeSocial está pronta — crie sua senha";

  const texto = [
    "Oi!",
    "",
    "A equipe do BeeSocial criou uma conta para você com este e-mail. Falta só você escolher a sua senha:",
    "",
    input.linkParaCriarSenha,
    "",
    `O link vale por ${input.validadeEmDias} dias. Se vencer, peça outro à equipe.`,
    "",
    "Com a senha criada, você entra no painel, monta a sua página (foto, nome, links) e copia o endereço para a bio.",
    "",
    "Se você não esperava este e-mail, ignore: sem o clique, nada acontece.",
    "",
    `BeeSocial · ${input.siteUrl}`,
  ].join("\n");

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width">
<title>${escapar(assunto)}</title>
</head>
<body style="margin:0;padding:0;background:#0d0d0d;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d0d;">
<tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#161616;border:1px solid #2a2a2a;border-radius:16px;">
    <tr><td style="padding:32px 28px 8px;font-family:Helvetica,Arial,sans-serif;">
      <div style="font-size:13px;letter-spacing:0.18em;text-transform:uppercase;color:#FF3C6E;font-weight:700;">BeeSocial</div>
    </td></tr>
    <tr><td style="padding:8px 28px 0;font-family:Helvetica,Arial,sans-serif;color:#ffffff;">
      <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;font-weight:700;">Oi!<br>Sua conta está pronta.</h1>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:#c9c9c9;">
        A equipe do BeeSocial criou uma conta para você com este e-mail. Falta só você escolher a sua senha.
      </p>
    </td></tr>
    <tr><td align="center" style="padding:4px 28px 24px;">
      <a href="${escapar(input.linkParaCriarSenha)}"
         style="display:inline-block;background:#FF3C6E;color:#ffffff;text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;padding:14px 28px;border-radius:10px;">
        Criar minha senha
      </a>
    </td></tr>
    <tr><td style="padding:0 28px 24px;font-family:Helvetica,Arial,sans-serif;color:#c9c9c9;font-size:14px;line-height:1.6;">
      <p style="margin:0 0 16px;">Com a senha criada, você entra no painel, monta a sua página (foto, nome, links) e copia o endereço para a bio.</p>
      <p style="margin:0;font-size:12px;color:#8a8a8a;">
        O link vale por ${input.validadeEmDias} dias. Se vencer, peça outro à equipe.
        Se você não esperava este e-mail, ignore: sem o clique, nada acontece.
      </p>
    </td></tr>
    <tr><td style="padding:16px 28px 24px;border-top:1px solid #2a2a2a;font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#6b6b6b;">
      Se o botão não abrir, copie este endereço no navegador:<br>
      <a href="${escapar(input.linkParaCriarSenha)}" style="color:#FF3C6E;word-break:break-all;">${escapar(input.linkParaCriarSenha)}</a>
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
