/**
 * Marca do e-mail: ÚNICO lugar onde nome, logo, fonte, cor, domínio e remetente
 * aparecem (ADR 0039). Rebrand = mexer aqui e trocar os PNGs em public/email/.
 *
 * O e-mail usa a mesma identidade da landing: fonte Geist, paisagem de morros
 * verdes da hero, botão em pílula verde com tinta escura. Cores são o espelho em
 * hex de `src/styles/tokens.css` (e-mail não lê CSS var); o comentário ao lado de
 * cada uma diz qual token ela espelha.
 */

const appUrl = (Deno.env.get("APP_URL") ?? "https://app.pilarsoft.com.br").replace(/\/$/, "");
// Site público: landing, portal do cliente (/cliente) e os assets de e-mail.
const siteUrl = (Deno.env.get("PUBLIC_SITE_URL") ?? "https://www.pilarsoft.com.br").replace(/\/$/, "");

export const BRAND = {
  nome: "Pilar",
  dominio: "pilarsoft.com.br",
  appUrl,
  siteUrl,
  /** Remetente padrão. Formato "Nome <endereco>". */
  from: Deno.env.get("RESEND_FROM") ?? "Pilar <no-reply@pilarsoft.com.br>",
  /** Caixa que recebe resposta dos e-mails de plataforma. Vazio = sem reply-to. */
  replyTo: Deno.env.get("RESEND_REPLY_TO") ?? "",
  /**
   * Símbolo em PNG 3x (apps/marketing/public/email/logo-v1.png, 96px). SVG não entra em <img> de
   * e-mail (Gmail bloqueia). Versionar o nome ao trocar de logo.
   */
  logoUrl: Deno.env.get("EMAIL_LOGO_URL") ?? `${siteUrl}/email/logo-v1.png`,
  /** Faixa de morros da hero, 1200x225 (apps/marketing/public/email/wave-v1.png), servida a 600px. */
  waveUrl: Deno.env.get("EMAIL_WAVE_URL") ?? `${siteUrl}/email/wave-v1.png`,
} as const;

/** Paleta do e-mail. Hex espelhando tokens.css (Paper + Ink, verde como acento). */
export const C = {
  // Superfícies
  bg: "#F2F2F2", // fundo fora do card (um passo abaixo de --c-paper-100)
  card: "#FFFFFF", // --c-paper-0
  surface: "#FAFAFA", // --c-paper-50, rodapé e cards internos
  muted: "#F0F0F0", // --c-paper-200, bloco de código
  // Céu da hero: topo da faixa de ondas. A imagem começa nesta cor exata.
  sky: "#EFF9FB", // hsl(190 60% 96%), o stop de 62% do gradiente da hero
  // Bordas
  border: "#E5E7EB", // --border-default
  borderSubtle: "#EDEDED",
  // Texto
  ink: "#1A1A1A", // --text-ink
  inkSoft: "#3D3D3D", // --text-ink-soft
  textMuted: "#6B7280", // --text-muted
  textDisabled: "#9CA3AF", // --text-disabled
  // Marca
  brand: "#A6EC88", // --brand-accent (#A4EC86 arredondado no HSL do token)
  brandHover: "#93E370",
  brandSoft: "#E2F6DA", // --brand-accent-soft
  brandStrong: "#366B1F", // --modulo-gestao-strong, verde que passa AA como texto
  // Semânticas
  negative: "#DE2121", // --c-red-600
  negativeSoft: "#FDECEC",
  warning: "#B35309", // --c-amber-700
  warningSoft: "#FFF8EB",
  info: "#1D4FD8", // --c-blue-700
  infoSoft: "#EEF4FF",
  positive: "#157F3C", // --c-green-700
  positiveSoft: "#F1FCF4", // --c-green-50
  // Módulos (chips de categoria na landing)
  moduloGestao: "#E2F6DA",
  moduloGestaoStrong: "#366B1F",
  moduloProjetos: "#D0E3F6",
  moduloProjetosStrong: "#295485",
  moduloObra: "#F7DDBF",
  moduloObraStrong: "#884E1C",
} as const;

/**
 * Geist, a mesma da landing, autohospedada no site (sem fonts.googleapis.com,
 * regra da SPEC 043). Apple Mail, iOS Mail e Outlook macOS renderizam a Geist;
 * Gmail e Outlook Windows ignoram @font-face e caem no fallback do sistema, que
 * é uma grotesca neutra do mesmo desenho. EMAIL_FONT_CSS troca isto no preview
 * (lá a fonte entra embutida, para a revisão visual ser fiel).
 */
export const FONT_FACE_CSS =
  Deno.env.get("EMAIL_FONT_CSS") ??
  `@font-face{font-family:'Geist';font-style:normal;font-weight:100 900;font-display:swap;src:url('${BRAND.siteUrl}/fonts/geist-variable.woff2') format('woff2');}
@font-face{font-family:'Geist';font-style:italic;font-weight:100 900;font-display:swap;src:url('${BRAND.siteUrl}/fonts/geist-variable-italic.woff2') format('woff2');}`;

export const FONT = "'Geist','Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
export const MONO = "'Geist Mono','SFMono-Regular',Menlo,Consolas,'Courier New',monospace";
