const KNOWN_USER_ERRORS: Record<string, string> = {
  "duplicate key value": "Já existe um registro com esses dados.",
  "violates foreign key": "Este registro está vinculado a outros dados e não pode ser alterado.",
  "violates not-null": "Preencha todos os campos obrigatórios.",
  "violates check constraint": "Os dados informados são inválidos.",
  "row-level security": "Você não tem permissão para realizar esta ação.",
  "JWT expired": "Sua sessão expirou. Faça login novamente.",
  "Invalid login credentials": "Credenciais inválidas.",
};

/**
 * Converts an unknown error into a user-safe message.
 * Prevents leaking internal database schema, table names, or constraint details.
 */
export function getSafeErrorMessage(error: unknown, fallback = "Ocorreu um erro. Tente novamente."): string {
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : "";

  for (const [pattern, userMessage] of Object.entries(KNOWN_USER_ERRORS)) {
    if (raw.toLowerCase().includes(pattern.toLowerCase())) {
      return userMessage;
    }
  }

  return fallback;
}
