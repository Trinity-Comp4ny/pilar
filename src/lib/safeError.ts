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
 * Converts an unknown error into a user-safe message.
 * Prevents leaking internal database schema, table names, or constraint details.
 *
 * Handles: Error instances, plain strings, and PostgrestError objects
 * (which are plain objects with a `message` property, not Error instances).
 */
export function getSafeErrorMessage(error: unknown, fallback = "Ocorreu um erro. Tente novamente."): string {
  let raw = "";

  if (error instanceof Error) {
    raw = error.message;
  } else if (typeof error === "string") {
    raw = error;
  } else if (typeof error === "object" && error !== null && "message" in error) {
    raw = String((error as { message: unknown }).message);
  }

  for (const [pattern, userMessage] of Object.entries(KNOWN_USER_ERRORS)) {
    if (raw.toLowerCase().includes(pattern.toLowerCase())) {
      return userMessage;
    }
  }

  return fallback;
}
