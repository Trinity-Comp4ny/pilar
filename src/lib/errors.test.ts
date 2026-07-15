import { describe, it, expect } from "vitest";
import { errorMessage } from "./errors";

describe("errorMessage", () => {
  it("extrai .message de uma instância de Error", () => {
    expect(errorMessage(new Error("falhou"))).toBe("falhou");
  });

  it("extrai .message de um objeto do PostgREST (não é Error)", () => {
    const postgrestError = {
      message: "new row violates row-level security policy",
      code: "42501",
      details: null,
      hint: null,
    };
    expect(errorMessage(postgrestError)).toBe("new row violates row-level security policy");
  });

  it("usa o fallback quando o valor não tem message legível", () => {
    expect(errorMessage(null, "erro padrão")).toBe("erro padrão");
    expect(errorMessage(undefined, "erro padrão")).toBe("erro padrão");
    expect(errorMessage("string crua", "erro padrão")).toBe("erro padrão");
    expect(errorMessage({ code: "X" }, "erro padrão")).toBe("erro padrão");
  });

  it("usa o fallback quando message é string vazia", () => {
    expect(errorMessage({ message: "" }, "erro padrão")).toBe("erro padrão");
  });

  it("usa o fallback quando message não é string", () => {
    expect(errorMessage({ message: 42 }, "erro padrão")).toBe("erro padrão");
  });

  it("tem um fallback padrão quando nenhum é passado", () => {
    expect(errorMessage(null)).toBe("Erro inesperado. Tente novamente.");
  });
});
