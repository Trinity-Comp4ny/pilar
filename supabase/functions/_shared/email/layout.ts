/**
 * Design system do e-mail: shell + componentes. Tema claro (Paper + Ink), verde da
 * marca como acento. Tudo em string HTML com tabelas (à prova de Outlook/Gmail).
 *
 * Regras:
 * - Template não escreve HTML cru: compõe estes componentes. Se falta um, cria aqui.
 * - Todo componente escapa o que recebe (`render`). Só `raw()` passa HTML, e só o layout usa.
 * - Layout pode variar entre e-mails (com card, sem card, lista), o design não.
 */

import { BRAND, C, FONT, MONO } from "./brand.ts";
import { Html, html, raw, render, type Renderable } from "./html.ts";

export type Tone = "neutral" | "brand" | "info" | "warning" | "negative" | "positive";
export type Modulo = "gestao" | "projetos" | "obra" | "neutro";

export type Header = { tipo: "plataforma" } | { tipo: "escritorio"; nome: string; logoUrl?: string | null };

export interface ShellOptions {
  /** Texto do preheader (aparece na lista de e-mails, escondido no corpo). */
  preview?: string;
  header?: Header;
  content: Html | Html[];
  footerNote?: string;
  footerLinks?: Array<{ label: string; href: string }>;
}

const TONE: Record<Tone, { fg: string; bg: string; bar: string }> = {
  neutral: { fg: C.inkSoft, bg: C.muted, bar: C.borderSubtle },
  brand: { fg: C.brandStrong, bg: C.brandSoft, bar: C.brand },
  info: { fg: C.info, bg: C.infoSoft, bar: C.info },
  warning: { fg: C.warning, bg: C.warningSoft, bar: C.warning },
  negative: { fg: C.negative, bg: C.negativeSoft, bar: C.negative },
  positive: { fg: C.positive, bg: C.positiveSoft, bar: C.positive },
};

const MODULO: Record<Modulo, { fg: string; bg: string }> = {
  gestao: { fg: C.moduloGestaoStrong, bg: C.moduloGestao },
  projetos: { fg: C.moduloProjetosStrong, bg: C.moduloProjetos },
  obra: { fg: C.moduloObraStrong, bg: C.moduloObra },
  neutro: { fg: C.inkSoft, bg: C.muted },
};

// ---------------------------------------------------------------------------
// Tipografia
// ---------------------------------------------------------------------------

/** Título principal. Um por e-mail. */
export function title(text: Renderable): Html {
  return html`<p
    class="h1"
    style="margin:0;font-size:26px;font-weight:600;color:${C.ink};letter-spacing:-0.02em;line-height:1.2;font-family:${FONT}"
  >
    ${text}
  </p>`;
}

/** Primeiro parágrafo, logo abaixo do título. */
export function lead(text: Renderable): Html {
  return html`<p style="margin:16px 0 0;font-size:16px;line-height:1.6;color:${C.inkSoft};font-family:${FONT}">
    ${text}
  </p>`;
}

export function paragraph(text: Renderable, opts: { mt?: number } = {}): Html {
  return html`<p
    style="margin:${opts.mt ?? 12}px 0 0;font-size:15px;line-height:1.6;color:${C.inkSoft};font-family:${FONT}"
  >
    ${text}
  </p>`;
}

/** Texto auxiliar pequeno (avisos de expiração, "se não foi você, ignore"). */
export function small(text: Renderable, opts: { mt?: number } = {}): Html {
  return html`<p
    style="margin:${opts.mt ?? 24}px 0 0;font-size:13px;line-height:1.6;color:${C.textMuted};font-family:${FONT}"
  >
    ${text}
  </p>`;
}

/** Rótulo em caixa alta (acima de um valor). */
export function label(text: Renderable): Html {
  return html`<p
    style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:${C.textMuted};font-family:${FONT}"
  >
    ${text}
  </p>`;
}

export function strong(text: Renderable): Html {
  return html`<strong style="color:${C.ink};font-weight:600">${text}</strong>`;
}

/** Palavra-chave com fundo verde da marca. Uma por título, no máximo. */
export function accent(text: Renderable): Html {
  return html`<span
    style="color:${C.ink};font-weight:600;background-color:${C.brand};padding:1px 8px;border-radius:4px;white-space:nowrap"
    >${text}</span
  >`;
}

/** Palavra-chave em tom semântico (ex.: "em atraso" em vermelho). */
export function emphasis(text: Renderable, tone: Tone): Html {
  return html`<span style="color:${TONE[tone].fg};font-weight:600">${text}</span>`;
}

export function link(text: Renderable, href: string): Html {
  return html`<a href="${href}" target="_blank" style="color:${C.ink};text-decoration:underline;font-weight:500"
    >${text}</a
  >`;
}

// ---------------------------------------------------------------------------
// Blocos
// ---------------------------------------------------------------------------

/** Botão. Primário = pílula preta. Secundário = borda, fundo branco. */
export function button(
  labelText: Renderable,
  href: string,
  opts: { variant?: "primary" | "secondary"; mt?: number } = {}
): Html {
  const primary = (opts.variant ?? "primary") === "primary";
  const bg = primary ? C.button : C.card;
  const fg = primary ? C.buttonText : C.ink;
  const border = primary ? C.button : C.borderSubtle;
  const mt = opts.mt ?? 28;
  return raw(`
<!--[if mso]>
<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin-top:${mt}px"><tr><td>
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${render(href)}" style="height:46px;v-text-anchor:middle;width:260px;" arcsize="100%" strokecolor="${border}" fillcolor="${bg}">
  <w:anchorlock/>
  <center style="color:${fg};font-family:${FONT};font-size:13px;font-weight:600;letter-spacing:0.06em;">${render(labelText)}</center>
</v:roundrect>
</td></tr></table>
<![endif]-->
<!--[if !mso]><!-- -->
<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin-top:${mt}px;border-collapse:separate">
  <tr>
    <td align="center" valign="middle" bgcolor="${bg}" style="background-color:${bg};border:1px solid ${border};border-radius:100px;padding:13px 28px;mso-padding-alt:13px 28px">
      <a href="${render(href)}" target="_blank" style="color:${fg};font-weight:600;font-size:13px;letter-spacing:0.06em;text-decoration:none;font-family:${FONT};display:inline-block;line-height:18px">${render(labelText)}</a>
    </td>
  </tr>
</table>
<!--<![endif]-->`);
}

/** Linha divisória. */
export function divider(opts: { my?: number } = {}): Html {
  const my = opts.my ?? 28;
  return raw(
    `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:${my}px 0;border-collapse:collapse"><tr><td style="border-top:1px solid ${C.border};font-size:1px;line-height:1px">&nbsp;</td></tr></table>`
  );
}

export function spacer(px: number): Html {
  return raw(
    `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse"><tr><td style="height:${px}px;font-size:1px;line-height:1px">&nbsp;</td></tr></table>`
  );
}

/**
 * Card: caixa em `surface` com borda. `accent` pinta uma barra vertical à esquerda
 * (estado: vencida = negative, ok = brand...). Conteúdo é uma lista de componentes.
 */
export function card(children: Html[], opts: { accent?: Tone; mt?: number; padding?: number } = {}): Html {
  const pad = opts.padding ?? 22;
  const inner = children.map((c) => c.value).join("");
  const bar = opts.accent
    ? `<td bgcolor="${TONE[opts.accent].bar}" width="4" style="background-color:${TONE[opts.accent].bar};width:4px;border-top-left-radius:12px;border-bottom-left-radius:12px;font-size:1px;line-height:1px">&nbsp;</td>`
    : "";
  return raw(`
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.surface}" style="background-color:${C.surface};border:1px solid ${C.border};border-radius:12px;margin-top:${opts.mt ?? 24}px;border-collapse:separate">
  <tr>${bar}<td style="padding:${pad}px ${pad + 2}px">${inner}</td></tr>
</table>`);
}

/** Par rótulo + valor, para dentro de um card. */
export function kv(
  labelText: Renderable,
  value: Renderable,
  opts: { mono?: boolean; tone?: Tone; size?: "md" | "lg" | "xl"; mt?: number } = {}
): Html {
  const size = opts.size === "xl" ? 30 : opts.size === "lg" ? 20 : 15;
  const color = opts.tone ? TONE[opts.tone].fg : C.ink;
  const font = opts.mono ? MONO : FONT;
  const tracking = opts.size === "xl" ? "-0.02em" : opts.mono ? "0.04em" : "0";
  return html`<table
    role="presentation"
    width="100%"
    cellpadding="0"
    cellspacing="0"
    border="0"
    style="border-collapse:collapse;margin-top:${opts.mt ?? 0}px"
  >
    <tr>
      <td>
        ${label(labelText)}
        <p
          style="margin:0;font-size:${size}px;font-weight:600;color:${color};font-family:${font};line-height:1.3;letter-spacing:${tracking};word-break:break-word"
        >
          ${value}
        </p>
      </td>
    </tr>
  </table>`;
}

/** Separador fino dentro do card, entre `kv`. */
export function kvDivider(): Html {
  return raw(
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:14px 0"><tr><td style="border-top:1px solid ${C.border};font-size:1px;line-height:1px">&nbsp;</td></tr></table>`
  );
}

/** Caixa de destaque com tom semântico (aviso, prazo, informação). */
export function callout(text: Renderable, tone: Tone = "info", opts: { mt?: number } = {}): Html {
  const t = TONE[tone];
  return html`<table
    role="presentation"
    width="100%"
    cellpadding="0"
    cellspacing="0"
    border="0"
    bgcolor="${t.bg}"
    style="background-color:${t.bg};border-radius:10px;margin-top:${opts.mt ?? 24}px;border-collapse:separate"
  >
    <tr>
      <td style="padding:14px 18px">
        <p style="margin:0;font-size:14px;line-height:1.55;color:${t.fg};font-family:${FONT}">${text}</p>
      </td>
    </tr>
  </table>`;
}

/** Bloco monoespaçado para senha, chave Pix, código. */
export function codeBox(text: Renderable, opts: { mt?: number } = {}): Html {
  return html`<table
    role="presentation"
    width="100%"
    cellpadding="0"
    cellspacing="0"
    border="0"
    bgcolor="${C.muted}"
    style="background-color:${C.muted};border-radius:8px;margin-top:${opts.mt ?? 8}px;border-collapse:separate"
  >
    <tr>
      <td style="padding:12px 16px">
        <span style="font-family:${MONO};font-size:15px;color:${C.ink};letter-spacing:0.04em;word-break:break-all"
          >${text}</span
        >
      </td>
    </tr>
  </table>`;
}

/** Chip pequeno (categoria, severidade). Inline. */
export function badge(text: Renderable, opts: { tone?: Tone; modulo?: Modulo } = {}): Html {
  const c = opts.modulo ? MODULO[opts.modulo] : TONE[opts.tone ?? "neutral"];
  return html`<span
    style="display:inline-block;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${c.fg};background-color:${c.bg};padding:3px 8px;border-radius:999px;font-family:${FONT};line-height:1.3"
    >${text}</span
  >`;
}

/** Cabeçalho de seção dentro do corpo (ex.: "Financeiro" numa lista de notificações). */
export function sectionHeading(text: Renderable, opts: { modulo?: Modulo; count?: number; mt?: number } = {}): Html {
  const chip = badge(text, { modulo: opts.modulo ?? "neutro" });
  const count =
    opts.count !== undefined
      ? html`<span style="font-size:12px;color:${C.textMuted};font-family:${FONT};margin-left:8px">${opts.count}</span>`
      : raw("");
  return html`<table
    role="presentation"
    width="100%"
    cellpadding="0"
    cellspacing="0"
    border="0"
    style="border-collapse:collapse;margin-top:${opts.mt ?? 28}px"
  >
    <tr>
      <td style="padding-bottom:6px;border-bottom:1px solid ${C.border}">${chip}${count}</td>
    </tr>
  </table>`;
}

/**
 * Item de lista (notificação, pendência). Barra de severidade à esquerda,
 * título clicável, mensagem, meta à direita.
 */
export function listItem(item: {
  titulo: Renderable;
  mensagem?: Renderable;
  href?: string;
  tone?: Tone;
  meta?: Renderable;
}): Html {
  const tone = item.tone ?? "neutral";
  const bar = TONE[tone].bar;
  const tituloHtml = item.href
    ? html`<a
        href="${item.href}"
        target="_blank"
        style="color:${C.ink};text-decoration:none;font-weight:600;font-size:15px;line-height:1.4;font-family:${FONT}"
        >${item.titulo}</a
      >`
    : html`<span style="color:${C.ink};font-weight:600;font-size:15px;line-height:1.4;font-family:${FONT}"
        >${item.titulo}</span
      >`;
  const msg = item.mensagem
    ? html`<p style="margin:3px 0 0;font-size:13px;line-height:1.5;color:${C.textMuted};font-family:${FONT}">
        ${item.mensagem}
      </p>`
    : raw("");
  const meta = item.meta
    ? html`<td align="right" valign="top" style="padding:12px 0 12px 12px;white-space:nowrap">
        <span style="font-size:12px;color:${C.textDisabled};font-family:${FONT}">${item.meta}</span>
      </td>`
    : raw("");
  return html`<table
    role="presentation"
    width="100%"
    cellpadding="0"
    cellspacing="0"
    border="0"
    style="border-collapse:collapse;border-bottom:1px solid ${C.border}"
  >
    <tr>
      <td width="3" bgcolor="${bar}" style="background-color:${bar};width:3px;font-size:1px;line-height:1px">&nbsp;</td>
      <td style="padding:12px 0 12px 14px">${tituloHtml}${msg}</td>
      ${meta}
    </tr>
  </table>`;
}

// ---------------------------------------------------------------------------
// Header e footer
// ---------------------------------------------------------------------------

function initials(nome: string): string {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function headerHtml(header: Header): string {
  if (header.tipo === "plataforma") {
    return `
<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
  <tr>
    <td valign="middle" style="vertical-align:middle;padding-right:10px">
      <img src="${render(BRAND.logoUrl)}" width="28" height="28" alt="${render(BRAND.nome)}" style="display:block;width:28px;height:28px;border:0"/>
    </td>
    <td valign="middle" style="vertical-align:middle">
      <span style="font-size:18px;font-weight:700;color:${C.ink};letter-spacing:-0.02em;font-family:${FONT};line-height:1">${render(BRAND.nome)}</span>
    </td>
  </tr>
</table>`;
  }

  const logo = header.logoUrl
    ? `<img src="${render(header.logoUrl)}" width="36" height="36" alt="${render(header.nome)}" style="display:block;width:36px;height:36px;border-radius:8px;border:1px solid ${C.border};object-fit:contain;background:${C.card}"/>`
    : `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="border-collapse:separate"><tr><td width="36" height="36" align="center" valign="middle" bgcolor="${C.muted}" style="background-color:${C.muted};width:36px;height:36px;border-radius:8px;text-align:center;vertical-align:middle"><span style="font-size:13px;font-weight:700;color:${C.ink};font-family:${FONT};letter-spacing:0.02em;line-height:36px">${render(initials(header.nome))}</span></td></tr></table>`;

  return `
<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
  <tr>
    <td valign="middle" style="vertical-align:middle;padding-right:12px;width:36px">${logo}</td>
    <td valign="middle" style="vertical-align:middle">
      <span style="font-size:16px;font-weight:600;color:${C.ink};letter-spacing:-0.01em;font-family:${FONT};line-height:1.2">${render(header.nome)}</span>
    </td>
    <td valign="middle" align="right" style="vertical-align:middle;text-align:right;white-space:nowrap">
      <span style="font-size:11px;color:${C.textDisabled};font-family:${FONT};letter-spacing:0.02em">via ${render(BRAND.nome)}</span>
    </td>
  </tr>
</table>`;
}

function footerHtml(note: string, links: Array<{ label: string; href: string }>): string {
  const linksHtml = links.length
    ? `<p style="margin:8px 0 0;font-size:12px;line-height:1.6;font-family:${FONT}">${links
        .map(
          (l) =>
            `<a href="${render(l.href)}" target="_blank" style="color:${C.inkSoft};text-decoration:underline">${render(l.label)}</a>`
        )
        .join(`<span style="color:${C.textDisabled};padding:0 8px">·</span>`)}</p>`
    : "";
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">
  <tr><td><p style="margin:0;font-size:12px;line-height:1.6;color:${C.textMuted};font-family:${FONT}">${render(note)}</p>${linksHtml}</td></tr>
  <tr><td style="padding-top:12px"><span style="font-size:11px;color:${C.textDisabled};letter-spacing:0.12em;font-family:${FONT};text-transform:uppercase;font-weight:600">${render(BRAND.dominio)}</span></td></tr>
</table>`;
}

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

export function shell(opts: ShellOptions): string {
  const header = opts.header ?? { tipo: "plataforma" };
  const contentHtml = (Array.isArray(opts.content) ? opts.content : [opts.content]).map((c) => c.value).join("\n");
  const note =
    opts.footerNote ??
    (header.tipo === "escritorio"
      ? `Enviado por ${header.nome} via ${BRAND.nome}.`
      : `Você recebeu este e-mail porque tem uma conta no ${BRAND.nome}.`);
  const previewHtml = opts.preview
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${render(opts.preview)}&nbsp;&#8203;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta http-equiv="X-UA-Compatible" content="IE=edge"/>
<meta name="color-scheme" content="light only"/>
<meta name="supported-color-schemes" content="light"/>
<title>${render(BRAND.nome)}</title>
<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch><o:AllowPNG/></o:OfficeDocumentSettings></xml><![endif]-->
<style>
  :root { color-scheme: light only; supported-color-schemes: light; }
  body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
  a { text-decoration: none; }
  @media only screen and (max-width: 600px) {
    .container { width: 100% !important; max-width: 100% !important; border-radius: 0 !important; }
    .px { padding-left: 24px !important; padding-right: 24px !important; }
    .py { padding-top: 32px !important; padding-bottom: 32px !important; }
    .h1 { font-size: 23px !important; }
    .outer { padding: 0 !important; }
  }
</style>
</head>
<body bgcolor="${C.bg}" style="margin:0;padding:0;background-color:${C.bg};font-family:${FONT};color:${C.ink}">
${previewHtml}
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="${C.bg}" style="background-color:${C.bg};border-collapse:collapse">
<tr>
<td class="outer" align="center" style="padding:40px 16px 56px">
  <table role="presentation" class="container" border="0" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;border-collapse:separate;background-color:${C.card};border:1px solid ${C.border};border-radius:16px;overflow:hidden">
    <tr><td bgcolor="${C.brand}" style="background-color:${C.brand};height:4px;line-height:1px;font-size:1px;border-radius:16px 16px 0 0">&nbsp;</td></tr>
    <tr><td class="px" style="padding:26px 40px 22px;border-bottom:1px solid ${C.border}">${headerHtml(header)}</td></tr>
    <tr><td class="px py" style="padding:40px 40px 40px">${contentHtml}</td></tr>
    <tr><td class="px" bgcolor="${C.surface}" style="background-color:${C.surface};padding:20px 40px 22px;border-top:1px solid ${C.border};border-radius:0 0 16px 16px">${footerHtml(note, opts.footerLinks ?? [])}</td></tr>
  </table>
</td>
</tr>
</table>
</body>
</html>`;
}
