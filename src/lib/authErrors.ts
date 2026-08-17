// Traduz erros do Supabase Auth para PT, sem vazar mensagem técnica ao usuário.
// Mapeia primeiro pelo `error_code` do GoTrue (estável) e só depois pela mensagem
// (que muda de versão para versão — foi assim que "at least 12" deixou de casar
// com o needle "at least 6" e caía no genérico).

const SENHA_FRACA =
  "Senha muito fraca. Use ao menos 12 caracteres com maiúscula, minúscula, número e símbolo.";
const EMAIL_EXISTE = "Este email já tem conta. Entre com sua senha ou continue com o Google.";

const CODE_MAP: Record<string, string> = {
  weak_password: SENHA_FRACA,
  user_already_exists: EMAIL_EXISTE,
  email_exists: EMAIL_EXISTE,
  email_address_invalid: "Email inválido.",
  validation_failed: "Confira os dados e tente novamente.",
  over_email_send_rate_limit: "Muitas tentativas seguidas. Aguarde um minuto e tente de novo.",
  over_request_rate_limit: "Muitas tentativas. Aguarde alguns minutos.",
  email_not_confirmed: "Confirme seu email antes de entrar.",
  invalid_credentials: "Email ou senha incorretos.",
  signup_disabled: "Cadastro desativado no momento.",
  user_not_found: "Usuário não encontrado.",
  same_password: "A nova senha deve ser diferente da anterior.",
};

const MESSAGE_MAP: Record<string, string> = {
  "Invalid login credentials": "Email ou senha incorretos.",
  "Email not confirmed": "Confirme seu email antes de entrar.",
  "User already registered": EMAIL_EXISTE,
  "User not found": "Usuário não encontrado.",
  "Password should be at least": SENHA_FRACA,
  "Password should contain": SENHA_FRACA,
  "Unable to validate email address": "Formato de email inválido.",
  "New password should be different from the old password": "A nova senha deve ser diferente da anterior.",
  "Signup requires a valid password": "Informe uma senha válida.",
  signup_disabled: "Cadastro desativado. Fale com o administrador.",
  "Email rate limit exceeded": "Muitas tentativas. Aguarde alguns minutos.",
  "For security purposes, you can only request this after": "Aguarde alguns segundos e tente de novo.",
  "Invalid TOTP code": "Código incorreto. Tente novamente.",
  "Invalid MFA code": "Código incorreto. Tente novamente.",
  "MFA challenge not found": "Desafio MFA expirado. Tente novamente.",
  "A factor with the friendly name": "Autenticador já cadastrado. Aguarde enquanto reiniciamos.",
  AuthRetryableFetchError: "Falha de conexão. Verifique sua internet.",
  "Auth session missing!": "Sessão expirada. Faça login novamente.",
};

export function translateAuthError(input: unknown): string {
  const obj = (input ?? {}) as { message?: string; code?: string; error_code?: string; name?: string };
  const code = obj.code || obj.error_code || "";
  if (code && CODE_MAP[code]) return CODE_MAP[code];

  const raw = input instanceof Error ? input.message : typeof input === "string" ? input : obj.message || obj.name || "";
  if (!raw) return "Erro inesperado. Tente novamente.";

  for (const [needle, pt] of Object.entries(MESSAGE_MAP)) {
    if (raw.includes(needle)) return pt;
  }

  return "Erro inesperado. Tente novamente.";
}
