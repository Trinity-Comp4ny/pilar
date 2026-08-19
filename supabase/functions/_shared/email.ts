/**
 * Resend email helper — único ponto de saída de todos os emails transacionais.
 * Requer RESEND_API_KEY e RESEND_FROM configurados como secrets da edge function.
 *
 * Design: light theme premium (estilo Linear/Vercel/Notion).
 * - Fundo off-white #F5F5F5, card branco com border sutil
 * - Brand bar verde no topo do card como acento
 * - Logo: quadrado preto com "P" verde brand
 * - Botão preto sólido (texto branco) — alto contraste, anti dark-mode-invert
 * - Verde brand #A4EC86 usado apenas como acento em palavras-chave
 */

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM = Deno.env.get("RESEND_FROM") ?? "Pilar <no-reply@pilarsoft.com.br>";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;

export interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
  attachments?: { filename: string; content: string }[];
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  if (!RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY not configured — email not sent");
    return;
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(RESEND_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: RESEND_FROM,
          to: Array.isArray(payload.to) ? payload.to : [payload.to],
          subject: payload.subject,
          html: payload.html,
          ...(payload.replyTo && { reply_to: payload.replyTo }),
          ...(payload.attachments?.length && { attachments: payload.attachments }),
        }),
      });

      if (res.ok) return;

      const body = await res.text();
      const retryable = res.status >= 500 || res.status === 429;
      lastError = new Error(`Resend ${res.status}: ${body}`);

      if (!retryable || attempt === MAX_RETRIES - 1) throw lastError;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt === MAX_RETRIES - 1) throw lastError;
    }

    await sleep(BASE_DELAY_MS * 2 ** attempt);
  }

  if (lastError) throw lastError;
}

// ---------------------------------------------------------------------------
// Design tokens — light theme premium
// ---------------------------------------------------------------------------
const T = {
  bg: "#F5F5F5", // off-white de fundo
  card: "#FFFFFF", // card principal
  surface: "#FAFAFA", // surfaces sutis (footer, callouts)
  border: "#E5E5E5", // border padrão
  borderSoft: "#F0F0F0", // border ainda mais sutil
  ink: "#0A0A0A", // texto principal / botão preto
  text: "#404040", // texto corpo
  textSoft: "#737373", // texto auxiliar
  textMuted: "#A3A3A3", // texto desabilitado / footer
  brand: "#A4EC86", // verde brand (acento)
  brandDark: "#5BA838", // verde para texto/borders quando precisar contraste em branco
  red: "#DC2626",
  font: "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif",
};

// ---------------------------------------------------------------------------
// Base layout
// ---------------------------------------------------------------------------
function baseHtml(opts: { preview?: string; content: string; footerNote?: string }): string {
  const { preview, content, footerNote } = opts;
  const note = footerNote ?? "Você recebeu este email por estar associado a um projeto no Pilar.";

  const previewHtml = preview
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${preview}&nbsp;&#8203;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta http-equiv="X-UA-Compatible" content="IE=edge"/>
<meta name="color-scheme" content="light only"/>
<meta name="supported-color-schemes" content="light"/>
<title>Pilar</title>
<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch><o:AllowPNG/></o:OfficeDocumentSettings></xml><![endif]-->
<style>
  :root { color-scheme: light only; supported-color-schemes: light; }
  body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: collapse !important; }
  img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; display: block; }
  a { text-decoration: none; }
  /* Mobile */
  @media only screen and (max-width: 600px) {
    .container { width: 100% !important; max-width: 100% !important; }
    .px-40 { padding-left: 28px !important; padding-right: 28px !important; }
    .py-48 { padding-top: 36px !important; padding-bottom: 32px !important; }
    .h1 { font-size: 28px !important; line-height: 1.2 !important; }
  }
</style>
</head>
<body bgcolor="${T.bg}" style="margin:0;padding:0;background-color:${T.bg};font-family:${T.font};color:${T.ink}">
${previewHtml}

<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="${T.bg}" style="background-color:${T.bg};border-collapse:collapse">
<tr>
<td align="center" style="padding:48px 16px 64px">

  <!-- Container 600px -->
  <table role="presentation" class="container" border="0" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;border-collapse:collapse;background-color:${T.card};border:1px solid ${T.border};border-radius:16px;overflow:hidden">

    <!-- Brand bar verde topo -->
    <tr>
      <td bgcolor="${T.brand}" style="background-color:${T.brand};height:5px;line-height:1px;font-size:1px">&nbsp;</td>
    </tr>

    <!-- Header: logo + wordmark -->
    <tr>
      <td class="px-40" style="padding:32px 40px 28px">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
          <tr>
            <!-- Logo: quadrado preto com "P" verde -->
            <td width="44" height="44" bgcolor="${T.ink}" align="center" valign="middle" style="background-color:${T.ink};width:44px;height:44px;border-radius:10px;text-align:center;vertical-align:middle">
              <span style="color:${T.brand};font-size:24px;font-weight:900;line-height:44px;font-family:${T.font};letter-spacing:-0.04em;display:inline-block;vertical-align:middle">P</span>
            </td>
            <td width="14" style="width:14px;font-size:1px;line-height:1px">&nbsp;</td>
            <td valign="middle" style="vertical-align:middle">
              <span style="font-size:20px;font-weight:700;color:${T.ink};letter-spacing:-0.025em;font-family:${T.font};line-height:1">Pilar</span>
              <span style="font-size:10px;font-weight:500;color:${T.textMuted};letter-spacing:0.18em;font-family:${T.font};margin-left:8px;text-transform:uppercase">SOFT</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Divider sutil -->
    <tr>
      <td class="px-40" style="padding:0 40px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">
          <tr><td style="border-top:1px solid ${T.borderSoft};font-size:1px;line-height:1px">&nbsp;</td></tr>
        </table>
      </td>
    </tr>

    <!-- Conteúdo -->
    <tr>
      <td class="px-40 py-48" style="padding:48px 40px 44px">
        ${content}
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td bgcolor="${T.surface}" class="px-40" style="background-color:${T.surface};padding:24px 40px;border-top:1px solid ${T.borderSoft}">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">
          <tr>
            <td valign="middle" style="vertical-align:middle">
              <p style="margin:0;font-size:12px;line-height:1.6;color:${T.textSoft};font-family:${T.font}">${note}</p>
            </td>
          </tr>
          <tr>
            <td valign="middle" style="vertical-align:middle;padding-top:6px">
              <span style="font-size:11px;color:${T.textMuted};letter-spacing:0.14em;font-family:${T.font};text-transform:uppercase;font-weight:600">pilarsoft.com.br</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>

  </table>

</td>
</tr>
</table>

</body>
</html>`;
}

// Botão preto premium — alto contraste, à prova de dark mode invert
function pillButton(label: string, href: string): string {
  return `
<!--[if mso]>
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:50px;v-text-anchor:middle;width:280px;" arcsize="100%" stroke="f" fillcolor="${T.ink}">
  <w:anchorlock/>
  <center style="color:#FFFFFF;font-family:${T.font};font-size:13px;font-weight:700;letter-spacing:0.1em;">${label}</center>
</v:roundrect>
<![endif]-->
<!--[if !mso]><!-- -->
<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin-top:32px;border-collapse:separate">
  <tr>
    <td align="center" valign="middle" bgcolor="${T.ink}" style="background-color:${T.ink};border-radius:100px;padding:16px 40px;mso-padding-alt:16px 40px">
      <a href="${href}" target="_blank" style="color:#FFFFFF;font-weight:700;font-size:13px;letter-spacing:0.1em;text-decoration:none;font-family:${T.font};text-transform:uppercase;display:inline-block;line-height:18px">${label}</a>
    </td>
  </tr>
</table>
<!--<![endif]-->`;
}

function hr(): string {
  return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:32px 0;border-collapse:collapse"><tr><td style="border-top:1px solid ${T.borderSoft};font-size:1px;line-height:1px">&nbsp;</td></tr></table>`;
}

function title(html: string): string {
  return `<p class="h1" style="margin:0;font-size:34px;font-weight:600;color:${T.ink};letter-spacing:-0.025em;line-height:1.15;font-family:${T.font}">${html}</p>`;
}

function body(html: string, mt = "20px"): string {
  return `<p style="margin:${mt} 0 0;font-size:16px;line-height:1.65;color:${T.text};font-family:${T.font}">${html}</p>`;
}

function hint(text: string): string {
  return `<p style="margin:0;font-size:13px;line-height:1.65;color:${T.textSoft};font-family:${T.font}">${text}</p>`;
}

function strong(text: string): string {
  return `<strong style="color:${T.ink};font-weight:600">${text}</strong>`;
}

// Acento verde com sublinhado para destacar palavras-chave (estilo Linear)
function accent(text: string): string {
  return `<span style="color:${T.ink};font-weight:600;background-color:${T.brand};padding:2px 8px;border-radius:4px">${text}</span>`;
}

function smallNote(text: string): string {
  return `<p style="margin:32px 0 0;font-size:14px;line-height:1.6;color:${T.textSoft};font-family:${T.font}">${text}</p>`;
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export function templateRecuperacaoSenha(link: string): string {
  return baseHtml({
    preview: "Redefina sua senha no Pilar",
    content: `
      ${title(`Redefinir ${accent("senha")}`)}
      ${body(`Clique no botão abaixo para criar uma nova senha. O link expira em ${strong("1 hora")}.`)}
      ${pillButton("REDEFINIR SENHA", link)}
      ${smallNote("Se você não solicitou a redefinição, ignore este email com segurança.")}
    `,
  });
}

export function templateConviteUsuario(link: string, nome?: string): string {
  const saudacao = nome ? `Olá, ${strong(nome)}!` : "Olá!";
  return baseHtml({
    preview: "Você foi convidado para o Pilar",
    content: `
      ${title(`Bem-vindo ao ${accent("Pilar")}`)}
      ${body(`${saudacao} Você foi convidado para acessar a plataforma Pilar.`)}
      ${pillButton("ACEITAR CONVITE", link)}
      ${smallNote("Este link de convite expira em 24 horas. Se você não esperava este convite, ignore este email.")}
    `,
  });
}

export function templateMagicLink(link: string): string {
  return baseHtml({
    preview: "Seu link de acesso — Pilar",
    content: `
      ${title(`Seu link de ${accent("acesso")}`)}
      ${body(`Clique no botão abaixo para entrar no Pilar. O link expira em ${strong("10 minutos")}.`)}
      ${pillButton("ENTRAR NO PILAR", link)}
      ${smallNote("Se você não solicitou este link, ignore este email com segurança.")}
    `,
  });
}

export function templateConfirmacaoCadastro(link: string): string {
  return baseHtml({
    preview: "Confirme seu email — Pilar",
    content: `
      ${title(`Confirme seu ${accent("email")}`)}
      ${body("Clique no botão abaixo para confirmar seu endereço de email e ativar sua conta.")}
      ${pillButton("CONFIRMAR EMAIL", link)}
      ${smallNote("Se você não criou uma conta no Pilar, ignore este email.")}
    `,
  });
}

export function templateMensagemManual(mensagem: string): string {
  return baseHtml({
    preview: "Mensagem do Pilar",
    content: `
      ${title(`Mensagem do ${accent("Pilar")}`)}
      ${body(mensagem.replace(/\n/g, "<br/>"))}
    `,
  });
}

export function templateCobrancaDireta(params: {
  clienteNome: string;
  empresaNome: string;
  descricao: string;
  valorFormatado: string;
  dataVencimento: string;
  vencida: boolean;
  pixChave?: string;
  pixInstrucoes?: string;
}): string {
  const { clienteNome, empresaNome, descricao, valorFormatado, dataVencimento, vencida, pixChave, pixInstrucoes } =
    params;
  const accentColor = vencida ? T.red : T.brandDark;

  const tituloHtml = vencida
    ? `Fatura <span style="color:${T.red};font-weight:700">em atraso</span>`
    : `${accent("Lembrete")} de pagamento`;

  const pixSection = pixChave
    ? `
      <p style="margin:28px 0 8px;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${T.textSoft};font-family:${T.font}">Chave Pix</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${T.surface}" style="background-color:${T.surface};border:1px solid ${T.border};border-radius:8px;border-collapse:separate">
        <tr>
          <td style="padding:14px 16px">
            <span style="font-family:'Courier New',Courier,monospace;font-size:14px;color:${T.ink};word-break:break-all">${pixChave}</span>
          </td>
        </tr>
      </table>
      ${pixInstrucoes ? `<p style="margin:10px 0 0;font-size:13px;line-height:1.6;color:${T.textSoft};font-family:${T.font}">${pixInstrucoes}</p>` : ""}
    `
    : "";

  return baseHtml({
    preview: vencida ? `Fatura em atraso — ${valorFormatado}` : `Lembrete de pagamento — ${valorFormatado}`,
    footerNote: `Você recebeu esta cobrança de ${empresaNome} via Pilar.`,
    content: `
      ${title(tituloHtml)}
      ${body(`Olá, ${strong(clienteNome)}. ${vencida ? "Identificamos que a fatura abaixo está vencida." : "Esta é uma cobrança referente ao serviço abaixo."}`)}

      <!-- card fatura -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${T.surface}" style="background-color:${T.surface};border:1px solid ${T.border};border-radius:12px;margin-top:28px;border-collapse:separate">
        <tr>
          <td bgcolor="${accentColor}" width="3" style="background-color:${accentColor};width:3px;border-top-left-radius:12px;border-bottom-left-radius:12px;font-size:1px;line-height:1px">&nbsp;</td>
          <td style="padding:22px 24px">
            <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${T.textSoft};font-family:${T.font}">Descrição</p>
            <p style="margin:0;font-size:16px;font-weight:600;color:${T.ink};font-family:${T.font};line-height:1.4">${descricao}</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:16px 0"><tr><td style="border-top:1px solid ${T.border};font-size:1px;line-height:1px">&nbsp;</td></tr></table>
            <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${T.textSoft};font-family:${T.font}">Valor</p>
            <p style="margin:0;font-size:32px;font-weight:700;color:${T.ink};letter-spacing:-0.025em;font-family:${T.font};line-height:1.1">${valorFormatado}</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:16px 0"><tr><td style="border-top:1px solid ${T.border};font-size:1px;line-height:1px">&nbsp;</td></tr></table>
            <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${T.textSoft};font-family:${T.font}">Vencimento</p>
            <p style="margin:0;font-size:16px;font-weight:600;color:${vencida ? T.red : T.ink};font-family:${T.font};line-height:1.4">${dataVencimento}</p>
          </td>
        </tr>
      </table>

      ${pixSection}
      ${hr()}
      <p style="margin:0;font-size:13px;line-height:1.6;color:${T.textSoft};font-family:${T.font}">Enviado por ${strong(empresaNome)} via Pilar. Em caso de dúvida, responda este email.</p>
    `,
  });
}

export function templateAcessoPortalCliente(params: {
  nomeCliente: string;
  email: string;
  senha: string;
  loginUrl: string;
  isReset?: boolean;
}): string {
  const { nomeCliente, email, senha, loginUrl, isReset = false } = params;
  const titulo = isReset ? `Sua senha foi ${accent("redefinida")}` : `Bem-vindo ao ${accent("Portal do Cliente")}`;
  const intro = isReset
    ? `Sua senha de acesso ao Portal do Cliente foi redefinida com sucesso. Use as credenciais abaixo.`
    : `Seu acesso ao Portal do Cliente foi criado. Use as credenciais abaixo para acompanhar seu projeto.`;

  return baseHtml({
    preview: isReset ? "Senha redefinida — Portal do Cliente" : "Acesso ao Portal do Cliente",
    content: `
      ${title(titulo)}
      ${body(`Olá, ${strong(nomeCliente)}. ${intro}`)}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${T.surface}" style="background-color:${T.surface};border:1px solid ${T.border};border-radius:12px;margin-top:24px;border-collapse:separate">
        <tr>
          <td style="padding:20px 24px">
            <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${T.textSoft};font-family:${T.font}">Email</p>
            <p style="margin:0 0 16px;font-size:15px;font-weight:600;color:${T.ink};font-family:${T.font}">${email}</p>
            <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${T.textSoft};font-family:${T.font}">Senha</p>
            <p style="margin:0;font-family:'Courier New',Courier,monospace;font-size:18px;font-weight:700;color:${T.ink};letter-spacing:0.05em">${senha}</p>
          </td>
        </tr>
      </table>
      ${pillButton("ACESSAR PORTAL", loginUrl)}
      ${hint("Recomendamos alterar sua senha após o primeiro acesso.")}
    `,
  });
}

export function templatePropostaEnvio(params: {
  nomeCliente: string;
  tituloProposta: string;
  empresaNome: string;
  mensagem?: string;
}): string {
  const { nomeCliente, tituloProposta, empresaNome, mensagem } = params;

  return baseHtml({
    preview: `${tituloProposta} — proposta enviada por ${empresaNome}`,
    content: `
      ${title(`Nova ${accent("Proposta")}`)}
      ${body(`Olá, ${strong(nomeCliente)}. ${empresaNome} enviou uma proposta para você. O documento está em anexo neste email.`)}

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${T.surface}" style="background-color:${T.surface};border:1px solid ${T.border};border-radius:12px;margin-top:24px;border-collapse:separate">
        <tr>
          <td style="padding:20px 24px">
            <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${T.textSoft};font-family:${T.font}">Proposta</p>
            <p style="margin:0;font-size:16px;font-weight:600;color:${T.ink};font-family:${T.font};line-height:1.4">${tituloProposta}</p>
          </td>
        </tr>
      </table>

      ${mensagem ? `<p style="margin:24px 0 0;font-size:14px;line-height:1.7;color:${T.text};font-family:${T.font};white-space:pre-line">${mensagem}</p>` : ""}

      ${hr()}
      <p style="margin:0;font-size:13px;line-height:1.6;color:${T.textSoft};font-family:${T.font}">Enviado por ${strong(empresaNome)} via Pilar. Dúvidas? Responda este email.</p>
    `,
    footerNote: `Você recebeu esta proposta de ${empresaNome}.`,
  });
}
