import { describe, expect, it } from "vitest";
import { translateAuthError } from "./authErrors";

describe("translateAuthError", () => {
  it("usa o código do GoTrue antes da mensagem", () => {
    expect(translateAuthError({ code: "invalid_credentials", message: "qualquer coisa" })).toBe(
      "Email ou senha incorretos."
    );
    expect(translateAuthError({ error_code: "weak_password" })).toMatch(/12 caracteres/);
  });

  it("cai na mensagem quando o código é desconhecido", () => {
    expect(translateAuthError(new Error("Password should be at least 12 characters"))).toMatch(/12 caracteres/);
    expect(translateAuthError("Invalid TOTP code")).toBe("Código incorreto. Tente novamente.");
    expect(translateAuthError({ name: "AuthRetryableFetchError" })).toBe("Falha de conexão. Verifique sua internet.");
  });

  it("conta nova sem convite orienta a falar com o time (SPEC 133)", () => {
    expect(translateAuthError("Database error saving new user")).toMatch(/Fale com o time/);
    expect(translateAuthError({ code: "signup_disabled" })).toMatch(/Fale com o time/);
  });

  it("nunca devolve a mensagem técnica", () => {
    expect(translateAuthError(new Error("relation auth.users does not exist"))).toBe(
      "Erro inesperado. Tente novamente."
    );
    expect(translateAuthError(null)).toBe("Erro inesperado. Tente novamente.");
    expect(translateAuthError({})).toBe("Erro inesperado. Tente novamente.");
  });
});
