/**
 * Marca do e-mail: ÚNICO lugar onde nome, logo, domínio, remetente e cores
 * do Pilar aparecem nos e-mails (ADR 0039). Rebrand = mexer aqui + trocar o PNG.
 *
 * Cores são o espelho em hex de `src/styles/tokens.css` (e-mail não lê CSS var).
 * Comentário ao lado de cada uma diz qual token ela espelha. Mudou o token, muda aqui.
 */

const appUrl = (Deno.env.get("APP_URL") ?? "https://app.pilarsoft.com.br").replace(/\/$/, "");
// Site público (landing + portal do cliente em /cliente). Não é o app.
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
   * PNG 3x do símbolo (public/email/logo-v1.png, 96x96, servido pelo app).
   * SVG não entra em <img> de e-mail (Gmail bloqueia). Versionar o nome ao trocar.
   * EMAIL_LOGO_URL permite apontar pra outro host (preview local, staging).
   */
  logoUrl: Deno.env.get("EMAIL_LOGO_URL") ?? `${appUrl}/email/logo-v1.png`,
} as const;

/** Paleta do e-mail. Hex espelhando tokens.css (Paper + Ink, verde como acento). */
export const C = {
  // Superfícies (escala Paper)
  bg: "#F7F7F7", // --c-paper-100
  card: "#FFFFFF", // --c-paper-0
  surface: "#FCFCFC", // --c-paper-50
  muted: "#EDEDED", // --c-paper-200
  // Bordas
  border: "#E5E7EB", // --border-default (gray-200)
  borderSubtle: "#D9D9D9", // --border-subtle (paper-300)
  // Texto (escala Ink)
  ink: "#1A1A1A", // --text-ink
  inkSoft: "#3D3D3D", // --text-ink-soft
  textMuted: "#6B7280", // --text-muted (gray-500)
  textDisabled: "#9CA3AF", // --text-disabled (gray-400)
  // Marca
  brand: "#A4EC86", // --brand-accent
  brandSoft: "#E2F6DA", // --brand-accent-soft
  brandStrong: "#366B1F", // --modulo-gestao-strong (verde que passa AA como texto)
  // Semânticas (texto forte + fundo lavado)
  negative: "#DE2121", // --c-red-600
  negativeSoft: "#FEE2E2", // --c-red-50
  warning: "#B35309", // --c-amber-700
  warningSoft: "#FFFBEB", // --c-amber-50
  info: "#1D4FD8", // --c-blue-700
  infoSoft: "#EFF6FF", // --c-blue-50
  positive: "#157F3C", // --c-green-700
  positiveSoft: "#F2FDF5", // --c-green-50
  // Módulos (chips de categoria)
  moduloGestao: "#E2F6DA", // --modulo-gestao (fill) = brandSoft
  moduloGestaoStrong: "#366B1F", // --modulo-gestao-strong
  moduloProjetos: "#D0E3F6", // --modulo-projetos
  moduloProjetosStrong: "#295485", // --modulo-projetos-strong
  moduloObra: "#F7DDBF", // --modulo-obra
  moduloObraStrong: "#884E1C", // --modulo-obra-strong
  // Botão primário
  button: "#1A1A1A",
  buttonText: "#FFFFFF",
} as const;

export const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
export const MONO = "'SFMono-Regular',Menlo,Consolas,'Courier New',monospace";
