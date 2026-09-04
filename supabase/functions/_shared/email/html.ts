/**
 * Segurança do HTML de e-mail: tudo que entra num template é texto e é escapado.
 *
 * - `escapeHtml(s)`: escapa & < > " '.
 * - `Html`: marcador de "já é HTML seguro". Só sai de `raw()`, de `html\`...\`` ou de
 *   um componente do layout. Nunca construir com dado externo sem escapar.
 * - `html\`Olá, ${nome}\``: tagged template que escapa toda interpolação que não seja Html.
 * - `render(x)`: string → escapa; Html → passa. É o que os componentes usam.
 */

export class Html {
  constructor(readonly value: string) {}
  toString(): string {
    return this.value;
  }
}

export type Renderable = string | number | Html | null | undefined;

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Marca uma string como HTML já seguro. Uso restrito ao layout. */
export function raw(value: string): Html {
  return new Html(value);
}

export function render(x: Renderable): string {
  if (x === null || x === undefined) return "";
  if (x instanceof Html) return x.value;
  return escapeHtml(String(x));
}

/** Tagged template: interpolações são escapadas, salvo `Html`. */
export function html(strings: TemplateStringsArray, ...values: Array<Renderable | Renderable[]>): Html {
  let out = "";
  strings.forEach((chunk, i) => {
    out += chunk;
    if (i < values.length) {
      const v = values[i];
      out += Array.isArray(v) ? v.map(render).join("") : render(v);
    }
  });
  return new Html(out);
}

/** Texto livre com quebras de linha: escapa primeiro, depois troca \n por <br/>. */
export function multiline(text: string): Html {
  return new Html(escapeHtml(text).replace(/\r?\n/g, "<br/>"));
}

/**
 * Versão texto puro a partir do HTML final (para `text/plain`).
 * Suficiente pra leitor de tela, cliente antigo e score de spam. Não é um parser.
 */
export function htmlToText(htmlStr: string): string {
  return htmlStr
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--\[if[\s\S]*?<!\[endif\]-->/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<div[^>]*display:none[^>]*>[\s\S]*?<\/div>/gi, "")
    .replace(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href, label) => {
      const l = label.replace(/<[^>]+>/g, "").trim();
      return l ? `${l}: ${href}` : href;
    })
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|tr|h1|h2|h3|li|table)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#8203;|&zwnj;|\u200B|\u200C/g, "")
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l, i, arr) => l !== "" || (i > 0 && arr[i - 1] !== ""))
    .join("\n")
    .trim();
}
