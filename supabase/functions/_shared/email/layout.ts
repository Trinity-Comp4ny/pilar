/**
 * Design system do e-mail: shell + componentes. É a landing traduzida para
 * tabela HTML: fonte Geist, título grande com itálico de destaque, paisagem de
 * morros verdes fechando o cabeçalho, botão em pílula verde com tinta escura.
 *
 * Anatomia do shell, de cima para baixo:
 *   1. Cabeçalho branco: símbolo + "Pilar" (peso 500, como na landing).
 *   2. Cabeçalho editorial: céu claro, título e uma frase de apoio.
 *   3. Faixa de morros: imagem decorativa, sem texto por cima. Some no tema
 *      escuro (ver abaixo); cliente que bloqueia imagem mostra só o céu, e
 *      nada quebra.
 *   4. Corpo: cards, listas, botão.
 *   5. Rodapé: nota, links e o domínio como link.
 *
 * Tema escuro: o Outlook novo e o Windows Mail reescrevem e-mail em dark mode
 * por conta própria, ignorando `color-scheme: light`, e o resultado dessa
 * reescrita automática é um cinza sem cara nenhuma. Em vez de brigar por
 * "claro sempre" (perdida nesses dois clientes), todo componente que carrega
 * cor ganha uma classe (`pe-*`), e `shell()` declara as duas paletas via
 * `@media (prefers-color-scheme: dark)`: no Gmail e no Apple Mail mostra o
 * claro (comportamento padrão deles), no Outlook novo e Windows Mail mostra O
 * NOSSO escuro, desenhado, não o deles. A técnica funciona porque `!important`
 * numa regra de `<style>` bate um `style=""` inline sem `!important`: cada
 * componente mantém a cor clara inline (fallback pra cliente que não lê
 * `<style>`, e é o que o MSO/Outlook desktop clássico sempre vê) e a classe
 * só entra em ação quando o `@media` bate.
 *
 * Regras:
 * - Template não escreve HTML cru: compõe estes componentes. Se falta um, cria aqui.
 * - Todo componente escapa o que recebe (`render`). Só `raw()` passa HTML, e só o layout usa.
 * - Verde é fundo, nunca texto (regra da marca). Para verde em texto, `C.brandStrong`.
 * - Cor nova num componente = par claro (`C`) e escuro (`CD`) em `brand.ts`, mais a classe aqui.
 */

import { BRAND, C, CD, FONT, FONT_FACE_CSS, MONO } from "./brand.ts";
import { Html, html, raw, render, type Renderable } from "./html.ts";

export type Tone = "neutral" | "brand" | "info" | "warning" | "negative" | "positive";
export type Modulo = "gestao" | "projetos" | "obra" | "neutro";

export interface ShellOptions {
  /** Texto do preheader: aparece na lista de e-mails, escondido no corpo. */
  preview?: string;
  /** Cabeçalho editorial. `titulo` aceita `em()` para o itálico de destaque. */
  hero: { titulo: Html | string; lead?: Html | string };
  content?: Html | Html[];
  footerNote?: string;
  footerLinks?: Array<{ label: string; href: string }>;
}

type Palette = Record<keyof typeof C, string>;

function toneMap(p: Palette): Record<Tone, { fg: string; bg: string; bar: string }> {
  return {
    neutral: { fg: p.inkSoft, bg: p.muted, bar: p.border },
    brand: { fg: p.brandStrong, bg: p.brandSoft, bar: p.brand },
    info: { fg: p.info, bg: p.infoSoft, bar: p.info },
    warning: { fg: p.warning, bg: p.warningSoft, bar: p.warning },
    negative: { fg: p.negative, bg: p.negativeSoft, bar: p.negative },
    positive: { fg: p.positive, bg: p.positiveSoft, bar: p.positive },
  };
}

function moduloMap(p: Palette): Record<Modulo, { fg: string; bg: string }> {
  return {
    gestao: { fg: p.moduloGestaoStrong, bg: p.moduloGestao },
    projetos: { fg: p.moduloProjetosStrong, bg: p.moduloProjetos },
    obra: { fg: p.moduloObraStrong, bg: p.moduloObra },
    neutro: { fg: p.inkSoft, bg: p.muted },
  };
}

const TONE = toneMap(C);
const TONE_DARK = toneMap(CD);
const MODULO = moduloMap(C);
const MODULO_DARK = moduloMap(CD);

/** Classe do par claro/escuro de um tom, pra `bg`, `fg` ou `bar`. */
function toneClass(tone: Tone, slot: "bg" | "fg" | "bar"): string {
  return `pe-tone-${tone}-${slot}`;
}
function moduloClass(modulo: Modulo, slot: "bg" | "fg"): string {
  return `pe-modulo-${modulo}-${slot}`;
}

// ---------------------------------------------------------------------------
// Tipografia
// ---------------------------------------------------------------------------

/** Itálico de destaque no título. É a assinatura tipográfica da landing. */
export function em(text: Renderable): Html {
  return html`<em style="font-style:italic;font-weight:500">${text}</em>`;
}

export function paragraph(text: Renderable, opts: { mt?: number } = {}): Html {
  return html`<p
    class="pe-inksoft"
    style="margin:${opts.mt ?? 14}px 0 0;font-size:15px;line-height:1.65;color:${C.inkSoft};font-family:${FONT}"
  >
    ${text}
  </p>`;
}

/** Texto auxiliar (aviso de expiração, "se não foi você, ignore"). */
export function small(text: Renderable, opts: { mt?: number } = {}): Html {
  return html`<p
    class="pe-textmuted"
    style="margin:${opts.mt ?? 24}px 0 0;font-size:13px;line-height:1.6;color:${C.textMuted};font-family:${FONT}"
  >
    ${text}
  </p>`;
}

/** Rótulo em caixa alta, acima de um valor. */
export function label(text: Renderable): Html {
  return html`<p
    class="pe-textmuted"
    style="margin:0 0 5px;font-size:10.5px;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;color:${C.textMuted};font-family:${FONT}"
  >
    ${text}
  </p>`;
}

export function strong(text: Renderable): Html {
  return html`<strong class="pe-ink" style="color:${C.ink};font-weight:600">${text}</strong>`;
}

/** Palavra-chave em tom semântico (ex.: "em atraso" em vermelho). */
export function emphasis(text: Renderable, tone: Tone): Html {
  return html`<span class="${toneClass(tone, "fg")}" style="color:${TONE[tone].fg};font-weight:600">${text}</span>`;
}

export function link(text: Renderable, href: string): Html {
  return html`<a
    class="pe-ink"
    href="${href}"
    target="_blank"
    style="color:${C.ink};text-decoration:underline;text-underline-offset:2px;font-weight:500"
    >${text}</a
  >`;
}

// ---------------------------------------------------------------------------
// Blocos
// ---------------------------------------------------------------------------

/**
 * Botão da marca: pílula verde com tinta escura e seta à direita, igual ao da
 * landing. O verde não muda de tema (já funciona nos dois). `variant: "quiet"`
 * é o contorno claro, para ação secundária, e esse sim flipa no escuro.
 */
export function button(
  labelText: Renderable,
  href: string,
  opts: { variant?: "brand" | "quiet"; mt?: number } = {}
): Html {
  const quiet = opts.variant === "quiet";
  const bg = quiet ? C.card : C.brand;
  const border = quiet ? C.border : C.brand;
  const cls = quiet ? ' class="pe-card"' : "";
  const mt = opts.mt ?? 28;
  const texto = `${render(labelText)}&nbsp;&nbsp;&rarr;`;
  return raw(`
<!--[if mso]>
<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin-top:${mt}px"><tr><td>
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${render(href)}" style="height:46px;v-text-anchor:middle;width:230px;" arcsize="50%" strokecolor="${border}" fillcolor="${bg}">
  <w:anchorlock/>
  <center style="color:${C.ink};font-family:Arial,sans-serif;font-size:15px;font-weight:500;">${texto}</center>
</v:roundrect>
</td></tr></table>
<![endif]-->
<!--[if !mso]><!-- -->
<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin-top:${mt}px;border-collapse:separate">
  <tr>
    <td${cls} align="center" valign="middle" bgcolor="${bg}" style="background-color:${bg};border:1px solid ${border};border-radius:999px;padding:14px 26px;mso-padding-alt:14px 26px">
      <a class="pe-ink" href="${render(href)}" target="_blank" style="color:${C.ink};font-weight:500;font-size:15px;letter-spacing:-0.01em;text-decoration:none;font-family:${FONT};display:inline-block;line-height:20px">${texto}</a>
    </td>
  </tr>
</table>
<!--<![endif]-->`);
}

export function divider(opts: { my?: number } = {}): Html {
  const my = opts.my ?? 28;
  return raw(
    `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:${my}px 0;border-collapse:collapse"><tr><td class="pe-divider" style="border-top:1px solid ${C.border};font-size:1px;line-height:1px">&nbsp;</td></tr></table>`
  );
}

export function spacer(px: number): Html {
  return raw(
    `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse"><tr><td style="height:${px}px;font-size:1px;line-height:1px">&nbsp;</td></tr></table>`
  );
}

/** Caixa em `surface` com borda. `accent` pinta a barra vertical de estado. */
export function card(children: Html[], opts: { accent?: Tone; mt?: number; padding?: number } = {}): Html {
  const pad = opts.padding ?? 22;
  const inner = children.map((c) => c.value).join("");
  const bar = opts.accent
    ? `<td class="${toneClass(opts.accent, "bar")}" bgcolor="${TONE[opts.accent].bar}" width="3" style="background-color:${TONE[opts.accent].bar};width:3px;border-top-left-radius:14px;border-bottom-left-radius:14px;font-size:1px;line-height:1px">&nbsp;</td>`
    : "";
  return raw(`
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.surface}" class="pe-surface" style="background-color:${C.surface};border:1px solid ${C.border};border-radius:14px;margin-top:${opts.mt ?? 26}px;border-collapse:separate">
  <tr>${bar}<td style="padding:${pad}px ${pad + 2}px">${inner}</td></tr>
</table>`);
}

/** Par rótulo + valor, para dentro de um card. */
export function kv(
  labelText: Renderable,
  value: Renderable,
  opts: { mono?: boolean; tone?: Tone; size?: "md" | "lg" | "xl"; mt?: number } = {}
): Html {
  const size = opts.size === "xl" ? 32 : opts.size === "lg" ? 20 : 15;
  const weight = opts.size === "xl" ? 500 : 600;
  const color = opts.tone ? TONE[opts.tone].fg : C.ink;
  const cls = opts.tone ? toneClass(opts.tone, "fg") : "pe-ink";
  const font = opts.mono ? MONO : FONT;
  const tracking = opts.size === "xl" ? "-0.03em" : opts.mono ? "0.03em" : "-0.01em";
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
          class="${cls}"
          style="margin:0;font-size:${size}px;font-weight:${weight};color:${color};font-family:${font};line-height:1.3;letter-spacing:${tracking};word-break:break-word"
        >
          ${value}
        </p>
      </td>
    </tr>
  </table>`;
}

/** Separador fino entre `kv` dentro do card. */
export function kvDivider(): Html {
  return raw(
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:15px 0"><tr><td class="pe-divider" style="border-top:1px solid ${C.border};font-size:1px;line-height:1px">&nbsp;</td></tr></table>`
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
    class="${toneClass(tone, "bg")}"
    style="background-color:${t.bg};border-radius:12px;margin-top:${opts.mt ?? 24}px;border-collapse:separate"
  >
    <tr>
      <td style="padding:14px 18px">
        <p
          class="${toneClass(tone, "fg")}"
          style="margin:0;font-size:14px;line-height:1.6;color:${t.fg};font-family:${FONT}"
        >
          ${text}
        </p>
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
    class="pe-muted"
    style="background-color:${C.muted};border-radius:10px;margin-top:${opts.mt ?? 8}px;border-collapse:separate"
  >
    <tr>
      <td style="padding:13px 16px">
        <span
          class="pe-ink"
          style="font-family:${MONO};font-size:15px;color:${C.ink};letter-spacing:0.03em;word-break:break-all"
          >${text}</span
        >
      </td>
    </tr>
  </table>`;
}

/** Chip pequeno (categoria, severidade). */
export function badge(text: Renderable, opts: { tone?: Tone; modulo?: Modulo } = {}): Html {
  const c = opts.modulo ? MODULO[opts.modulo] : TONE[opts.tone ?? "neutral"];
  const clsBg = opts.modulo ? moduloClass(opts.modulo, "bg") : toneClass(opts.tone ?? "neutral", "bg");
  const clsFg = opts.modulo ? moduloClass(opts.modulo, "fg") : toneClass(opts.tone ?? "neutral", "fg");
  return html`<span
    class="${clsBg} ${clsFg}"
    style="display:inline-block;font-size:10.5px;font-weight:500;letter-spacing:0.09em;text-transform:uppercase;color:${c.fg};background-color:${c.bg};padding:4px 9px;border-radius:999px;font-family:${FONT};line-height:1.3"
    >${text}</span
  >`;
}

/** Cabeçalho de seção no corpo (ex.: "Financeiro" numa lista de notificações). */
export function sectionHeading(text: Renderable, opts: { modulo?: Modulo; count?: number; mt?: number } = {}): Html {
  const chip = badge(text, { modulo: opts.modulo ?? "neutro" });
  const count =
    opts.count !== undefined
      ? html`<span
          class="pe-textdisabled"
          style="font-size:12px;color:${C.textDisabled};font-family:${FONT};margin-left:9px"
          >${opts.count}</span
        >`
      : raw("");
  return html`<table
    role="presentation"
    width="100%"
    cellpadding="0"
    cellspacing="0"
    border="0"
    style="border-collapse:collapse;margin-top:${opts.mt ?? 30}px"
  >
    <tr>
      <td class="pe-divider" style="padding-bottom:8px;border-bottom:1px solid ${C.border}">${chip}${count}</td>
    </tr>
  </table>`;
}

/** Item de lista (notificação, pendência): barra de severidade, título clicável, mensagem. */
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
        class="pe-ink"
        href="${item.href}"
        target="_blank"
        style="color:${C.ink};text-decoration:none;font-weight:500;font-size:15px;line-height:1.45;letter-spacing:-0.01em;font-family:${FONT}"
        >${item.titulo}</a
      >`
    : html`<span
        class="pe-ink"
        style="color:${C.ink};font-weight:500;font-size:15px;line-height:1.45;letter-spacing:-0.01em;font-family:${FONT}"
        >${item.titulo}</span
      >`;
  const msg = item.mensagem
    ? html`<p
        class="pe-textmuted"
        style="margin:4px 0 0;font-size:13px;line-height:1.55;color:${C.textMuted};font-family:${FONT}"
      >
        ${item.mensagem}
      </p>`
    : raw("");
  const meta = item.meta
    ? html`<td align="right" valign="top" style="padding:13px 0 13px 12px;white-space:nowrap">
        <span class="pe-textdisabled" style="font-size:12px;color:${C.textDisabled};font-family:${FONT}"
          >${item.meta}</span
        >
      </td>`
    : raw("");
  return html`<table
    role="presentation"
    width="100%"
    cellpadding="0"
    cellspacing="0"
    border="0"
    style="border-collapse:collapse;border-bottom:1px solid ${C.borderSubtle}"
    class="pe-divider-subtle"
  >
    <tr>
      <td
        width="2"
        bgcolor="${bar}"
        class="${toneClass(tone, "bar")}"
        style="background-color:${bar};width:2px;font-size:1px;line-height:1px"
      >
        &nbsp;
      </td>
      <td style="padding:13px 0 13px 14px">${tituloHtml}${msg}</td>
      ${meta}
    </tr>
  </table>`;
}

// ---------------------------------------------------------------------------
// Cabeçalho, faixa de morros e rodapé
// ---------------------------------------------------------------------------

function headerHtml(): string {
  return `
<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
  <tr>
    <td valign="middle" style="vertical-align:middle;padding-right:11px">
      <img src="${render(BRAND.logoUrl)}" width="30" height="30" alt="${render(BRAND.nome)}" style="display:block;width:30px;height:30px;border:0"/>
    </td>
    <td valign="middle" style="vertical-align:middle">
      <span class="pe-ink" style="font-size:19px;font-weight:500;color:${C.ink};letter-spacing:-0.025em;font-family:${FONT};line-height:1">${render(BRAND.nome)}</span>
    </td>
  </tr>
</table>`;
}

/**
 * Cabeçalho editorial: céu claro, título grande, frase de apoio, faixa de
 * morros. A imagem da faixa é um ativo fixo (não tem versão escura): no tema
 * escuro ela some (`pe-wave`) e sobra só o céu escuro, um respiro sólido em
 * vez de uma janela clara destoando do resto do e-mail.
 */
function heroHtml(hero: ShellOptions["hero"]): string {
  const leadHtml = hero.lead
    ? `<p class="pe-inksoft" style="margin:14px 0 0;font-size:15.5px;line-height:1.6;color:${C.inkSoft};font-family:${FONT}">${render(hero.lead)}</p>`
    : "";
  return `
<tr>
  <td class="px pe-sky" bgcolor="${C.sky}" style="background-color:${C.sky};padding:36px 40px 32px">
    <h1 class="h1 pe-ink" style="margin:0;font-size:29px;font-weight:500;color:${C.ink};letter-spacing:-0.035em;line-height:1.15;font-family:${FONT}">${render(hero.titulo)}</h1>
    ${leadHtml}
  </td>
</tr>
<tr>
  <td class="pe-sky" bgcolor="${C.sky}" style="background-color:${C.sky};line-height:0;font-size:0">
    <img class="pe-wave" src="${render(BRAND.waveUrl)}" width="600" alt="" style="display:block;width:100%;max-width:600px;height:auto;border:0"/>
  </td>
</tr>`;
}

function footerHtml(note: string, links: Array<{ label: string; href: string }>): string {
  const linksHtml = links.length
    ? `<p style="margin:10px 0 0;font-size:12.5px;line-height:1.6;font-family:${FONT}">${links
        .map(
          (l) =>
            `<a class="pe-inksoft" href="${render(l.href)}" target="_blank" style="color:${C.inkSoft};text-decoration:underline;text-underline-offset:2px">${render(l.label)}</a>`
        )
        .join(`<span class="pe-textdisabled" style="color:${C.textDisabled};padding:0 8px">·</span>`)}</p>`
    : "";
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">
  <tr><td><p class="pe-textmuted" style="margin:0;font-size:12.5px;line-height:1.65;color:${C.textMuted};font-family:${FONT}">${render(note)}</p>${linksHtml}</td></tr>
  <tr><td style="padding-top:16px">
    <a class="pe-textmuted" href="${BRAND.siteUrl}" target="_blank" style="font-size:12.5px;color:${C.textMuted};font-family:${FONT};text-decoration:underline;text-underline-offset:2px">${render(BRAND.dominio)}</a>
  </td></tr>
</table>`;
}

/** Gera as regras `@media (prefers-color-scheme: dark)` a partir de CD, TONE_DARK, MODULO_DARK. */
function darkModeCss(): string {
  const rules: string[] = [
    `.pe-bg{background-color:${CD.bg} !important}`,
    `.pe-card{background-color:${CD.card} !important;border-color:${CD.border} !important}`,
    `.pe-surface{background-color:${CD.surface} !important;border-color:${CD.border} !important}`,
    `.pe-muted{background-color:${CD.muted} !important}`,
    `.pe-sky{background-color:${CD.sky} !important}`,
    `.pe-wave{display:none !important}`,
    `.pe-divider{border-color:${CD.border} !important}`,
    `.pe-divider-subtle{border-color:${CD.borderSubtle} !important}`,
    `.pe-ink{color:${CD.ink} !important}`,
    `.pe-inksoft{color:${CD.inkSoft} !important}`,
    `.pe-textmuted{color:${CD.textMuted} !important}`,
    `.pe-textdisabled{color:${CD.textDisabled} !important}`,
  ];
  for (const [tone, v] of Object.entries(TONE_DARK) as [Tone, { fg: string; bg: string; bar: string }][]) {
    rules.push(`.${toneClass(tone, "bg")}{background-color:${v.bg} !important}`);
    rules.push(`.${toneClass(tone, "fg")}{color:${v.fg} !important}`);
    rules.push(`.${toneClass(tone, "bar")}{background-color:${v.bar} !important}`);
  }
  for (const [modulo, v] of Object.entries(MODULO_DARK) as [Modulo, { fg: string; bg: string }][]) {
    rules.push(`.${moduloClass(modulo, "bg")}{background-color:${v.bg} !important}`);
    rules.push(`.${moduloClass(modulo, "fg")}{color:${v.fg} !important}`);
  }
  return `@media (prefers-color-scheme: dark) {\n  body{background-color:${CD.bg} !important}\n  ${rules.join("\n  ")}\n}`;
}

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

export function shell(opts: ShellOptions): string {
  const contentBlocks = opts.content ? (Array.isArray(opts.content) ? opts.content : [opts.content]) : [];
  const contentHtml = contentBlocks.length
    ? `<tr><td class="px py" style="padding:34px 40px 40px">${contentBlocks.map((c) => c.value).join("\n")}</td></tr>`
    : "";
  const note = opts.footerNote ?? `Você recebeu este e-mail porque tem uma conta na ${BRAND.nome}.`;
  const previewHtml = opts.preview
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${render(opts.preview)}&nbsp;&#8203;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta http-equiv="X-UA-Compatible" content="IE=edge"/>
<meta name="color-scheme" content="light dark"/>
<meta name="supported-color-schemes" content="light dark"/>
<title>${render(BRAND.nome)}</title>
<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch><o:AllowPNG/></o:OfficeDocumentSettings></xml><![endif]-->
<style>
${FONT_FACE_CSS}
  :root { color-scheme: light dark; supported-color-schemes: light dark; }
  body, table, td, a, p, h1 { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; -webkit-font-smoothing: antialiased; }
  table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
  a { text-decoration: none; }
  @media only screen and (max-width: 620px) {
    .container { width: 100% !important; max-width: 100% !important; border-radius: 0 !important; border-left: 0 !important; border-right: 0 !important; }
    .px { padding-left: 24px !important; padding-right: 24px !important; }
    .py { padding-bottom: 32px !important; }
    .h1 { font-size: 25px !important; }
    .outer { padding: 0 !important; }
  }
  ${darkModeCss()}
</style>
</head>
<body class="pe-bg" bgcolor="${C.bg}" style="margin:0;padding:0;background-color:${C.bg};font-family:${FONT};color:${C.ink}">
${previewHtml}
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="${C.bg}" class="pe-bg" style="background-color:${C.bg};border-collapse:collapse">
<tr>
<td class="outer" align="center" style="padding:40px 16px 56px">
  <table role="presentation" class="container pe-card" border="0" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;border-collapse:separate;background-color:${C.card};border:1px solid ${C.border};border-radius:18px;overflow:hidden">
    <tr><td class="px" style="padding:24px 40px 22px">${headerHtml()}</td></tr>
    ${heroHtml(opts.hero)}
    ${contentHtml}
    <tr><td class="px pe-surface" bgcolor="${C.surface}" style="background-color:${C.surface};padding:22px 40px 24px;border-top:1px solid ${C.border}">${footerHtml(note, opts.footerLinks ?? [])}</td></tr>
  </table>
</td>
</tr>
</table>
</body>
</html>`;
}
