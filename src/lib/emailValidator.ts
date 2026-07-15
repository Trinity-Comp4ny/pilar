/**
 * Distingue e-mail corporativo de e-mail pessoal (provedor gratuito).
 *
 * Usado no cadastro de leads para sinalizar contatos que informaram um
 * e-mail pessoal: em engenharia B2B, o e-mail no domínio da empresa costuma
 * indicar um contato mais qualificado.
 */
const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com",
  "yahoo.com", "yahoo.com.br", "yahoo.co.uk", "yahoo.fr", "yahoo.de", "yahoo.es", "yahoo.it",
  "hotmail.com", "hotmail.com.br", "hotmail.co.uk", "hotmail.fr", "hotmail.de",
  "outlook.com", "outlook.com.br", "outlook.co.uk", "outlook.fr",
  "live.com", "live.com.br", "live.co.uk", "live.fr",
  "icloud.com", "me.com", "mac.com",
  "aol.com", "aim.com",
  "protonmail.com", "proton.me",
  "yandex.com", "yandex.ru",
  "mail.com", "gmx.com", "gmx.net",
  "zoho.com", "zohomail.com",
  "fastmail.com",
  "msn.com",
  "rocketmail.com", "ymail.com",
  "qq.com", "163.com", "126.com",
  // Provedores brasileiros gratuitos
  "bol.com.br", "uol.com.br", "terra.com.br", "ig.com.br", "globo.com",
  "oi.com.br", "r7.com", "pop.com.br", "superig.com.br",
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Retorna o domínio (minúsculo) de um e-mail, ou null se malformado. */
function getDomain(email: string): string | null {
  const domain = email.trim().toLowerCase().split("@")[1];
  return domain && domain.length > 0 ? domain : null;
}

/** true se o e-mail tem formato válido. */
export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

/** true se o e-mail é de domínio corporativo (não é provedor gratuito). */
export function isBusinessEmail(email: string): boolean {
  const domain = getDomain(email);
  if (!domain) return false;
  return !FREE_EMAIL_DOMAINS.has(domain);
}

/** true se o e-mail é de provedor pessoal/gratuito (Gmail, Hotmail, etc.). */
export function isPersonalEmail(email: string): boolean {
  const domain = getDomain(email);
  if (!domain) return false;
  return FREE_EMAIL_DOMAINS.has(domain);
}

/**
 * Validador para uso no onBlur de um campo.
 * Retorna a mensagem de erro (formato inválido) ou null.
 * Não bloqueia e-mail pessoal: só valida o formato. Use isPersonalEmail
 * separadamente para exibir um aviso não-bloqueante.
 */
export function emailFormatValidator(value: string): string | null {
  if (!value.trim()) return null;
  if (!isValidEmail(value)) return "E-mail em formato inválido";
  return null;
}
