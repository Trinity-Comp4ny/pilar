const ERROR_MAP: Record<string, string> = {
  "Invalid login credentials": "Email ou senha incorretos.",
  "Email not confirmed": "Confirme seu email antes de entrar.",
  "User already registered": "Este email já está cadastrado.",
  "User not found": "Usuário não encontrado.",
  "Password should be at least 6 characters": "Senha deve ter pelo menos 12 caracteres.",
  "Unable to validate email address: invalid format": "Formato de email inválido.",
  "New password should be different from the old password": "A nova senha deve ser diferente da anterior.",
  "Signup requires a valid password": "Informe uma senha válida.",
  signup_disabled: "Cadastro desativado. Fale com o administrador.",
  "Email rate limit exceeded": "Muitas tentativas. Aguarde alguns minutos.",
  "For security purposes, you can only request this after": "Aguarde antes de tentar novamente por segurança.",
  "Invalid TOTP code": "Código incorreto. Tente novamente.",
  "Invalid MFA code": "Código incorreto. Tente novamente.",
  "MFA challenge not found": "Desafio MFA expirado. Tente novamente.",
  "A factor with the friendly name": "Autenticador já cadastrado. Aguarde enquanto reiniciamos.",
  AuthRetryableFetchError: "Falha de conexão. Verifique sua internet.",
  "Auth session missing!": "Sessão expirada. Faça login novamente.",
};

export function translateAuthError(input: unknown): string {
  const raw = input instanceof Error ? input.message : typeof input === "string" ? input : "";

  if (!raw) return "Erro inesperado. Tente novamente.";

  for (const [needle, pt] of Object.entries(ERROR_MAP)) {
    if (raw.includes(needle)) return pt;
  }

  return raw;
}
