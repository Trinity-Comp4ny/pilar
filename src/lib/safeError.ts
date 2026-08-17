const KNOWN_USER_ERRORS: Record<string, string> = {
  "duplicate key value": "Já existe um registro com esses dados.",
  "violates foreign key": "Este registro está vinculado a outros dados e não pode ser alterado.",
  "violates not-null": "Preencha todos os campos obrigatórios.",
  "violates check constraint": "Os dados informados são inválidos.",
  "row-level security": "Você não tem permissão para realizar esta ação.",
  "permission denied": "Você não tem permissão para realizar esta ação.",
  "JWT expired": "Sua sessão expirou. Faça login novamente.",
  "Invalid login credentials": "Credenciais inválidas.",
  "Lead não encontrado": "Lead não encontrado.",
  "Lead já foi convertido": "Este lead já foi convertido em cliente.",
  "Usuário não associado": "Usuário não está associado a uma empresa.",
};

/**
 * Extrai a mensagem crua de um erro desconhecido, incluindo PostgrestError
 * (objeto plano com `.message`, não é `instanceof Error`). Uso: telemetria
 * (Sentry precisa da mensagem real, não da sanitizada por getSafeErrorMessage).
 */
export function getRawErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "";
}

/**
 * Converts an unknown error into a user-safe message.
 * Prevents leaking internal database schema, table names, or constraint details.
 *
 * Handles: Error instances, plain strings, and PostgrestError objects
 * (which are plain objects with a `message` property, not Error instances).
 */
export function getSafeErrorMessage(error: unknown, fallback = "Ocorreu um erro. Tente novamente."): string {
  const raw = getRawErrorMessage(error);

  for (const [pattern, userMessage] of Object.entries(KNOWN_USER_ERRORS)) {
    if (raw.toLowerCase().includes(pattern.toLowerCase())) {
      return userMessage;
    }
  }

  return fallback;
}
