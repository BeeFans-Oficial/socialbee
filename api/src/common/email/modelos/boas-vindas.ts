import type { Mensagem } from "../email.service";

/**
 * O e-mail de boas-vindas, que é também o de confirmação: um e-mail só no
 * cadastro, com o botão de confirmar dentro. Duas mensagens na mesma hora
 * é o que faz a segunda cair em "promoções".
 *
 * HTML de e-mail é 2005: tabela, estilo inline, nada de classe, nada de
 * imagem externa (bloqueada por padrão no Gmail e no Outlook). A paleta é
 * a da marca — fundo escuro, rosa no botão — e o texto plano vai junto para
 * quem lê sem HTML e para o filtro de spam, que desconfia de HTML sem texto.
 */
export function boasVindas(input: {
  para: string;
  nome: string | null;
  linkDeConfirmacao: string;
  siteUrl: string;
  validadeEmHoras: number;
}): Mensagem {
  const nome = input.nome?.trim() || null;
  const saudacao = nome ? `Oi, ${escapar(nome)}!` : "Oi!";
  const assunto = "Bem-vinda ao BeeSocial — confirme seu e-mail";

  const texto = [
    nome ? `Oi, ${nome}!` : "Oi!",
    "",
    "Sua conta no BeeSocial está criada. Falta só confirmar que este e-mail é seu:",
    "",
    input.linkDeConfirmacao,
    "",
    `O link vale por ${input.validadeEmHoras} horas. Se vencer, peça outro em Configurações, dentro do painel.`,
    "",
    "Enquanto isso, três passos para a sua página ficar pronta:",
    "1. Coloque foto e nome em Páginas.",
    "2. Adicione seus links em Links.",
    "3. Copie o endereço da página e cole na bio do Instagram.",
    "",
    "Se você não criou essa conta, ignore este e-mail: sem o clique, nada acontece.",
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
      <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;font-weight:700;">${saudacao}<br>Sua página está a um clique.</h1>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:#c9c9c9;">
        Sua conta no BeeSocial está criada. Falta só confirmar que este e-mail é seu.
      </p>
    </td></tr>
    <tr><td align="center" style="padding:4px 28px 24px;">
      <a href="${escapar(input.linkDeConfirmacao)}"
         style="display:inline-block;background:#FF3C6E;color:#ffffff;text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;padding:14px 28px;border-radius:10px;">
        Confirmar meu e-mail
      </a>
    </td></tr>
    <tr><td style="padding:0 28px 24px;font-family:Helvetica,Arial,sans-serif;color:#c9c9c9;font-size:14px;line-height:1.6;">
      <p style="margin:0 0 16px;">Enquanto isso, três passos para a sua página ficar pronta:</p>
      <ol style="margin:0 0 20px;padding-left:20px;">
        <li>Coloque foto e nome em <strong style="color:#fff;">Páginas</strong>.</li>
        <li>Adicione seus links em <strong style="color:#fff;">Links</strong>.</li>
        <li>Copie o endereço da página e cole na bio do Instagram.</li>
      </ol>
      <p style="margin:0;font-size:12px;color:#8a8a8a;">
        O link vale por ${input.validadeEmHoras} horas. Se vencer, peça outro em Configurações, dentro do painel.
        Se você não criou essa conta, ignore este e-mail: sem o clique, nada acontece.
      </p>
    </td></tr>
    <tr><td style="padding:16px 28px 24px;border-top:1px solid #2a2a2a;font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#6b6b6b;">
      Se o botão não abrir, copie este endereço no navegador:<br>
      <a href="${escapar(input.linkDeConfirmacao)}" style="color:#FF3C6E;word-break:break-all;">${escapar(input.linkDeConfirmacao)}</a>
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
