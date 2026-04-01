/**
 * Extracts a safe, user-friendly error message from an unknown error.
 * Prevents leaking internal database or system details to the UI.
 */
export const getSafeErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return "Ocorreu um erro inesperado.";
};
