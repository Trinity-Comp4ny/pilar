import { describe, expect, it } from "vitest";
import { getRawErrorMessage, getSafeErrorMessage } from "./safeError";

describe("getRawErrorMessage", () => {
  it("extrai a mensagem de uma instância de Error", () => {
    expect(getRawErrorMessage(new Error("boom"))).toBe("boom");
  });

  it("extrai a mensagem de uma string", () => {
    expect(getRawErrorMessage("deu erro")).toBe("deu erro");
  });

  it("extrai a mensagem de um PostgrestError (objeto plano, não instanceof Error)", () => {
    const postgrestError = { message: "column x does not exist", code: "42703" };
    expect(getRawErrorMessage(postgrestError)).toBe("column x does not exist");
  });

  it("retorna string vazia para erro sem mensagem reconhecível", () => {
    expect(getRawErrorMessage({ code: "42703" })).toBe("");
    expect(getRawErrorMessage(null)).toBe("");
    expect(getRawErrorMessage(undefined)).toBe("");
  });
});

describe("getSafeErrorMessage", () => {
  it("mapeia erro conhecido do Postgrest para mensagem amigável", () => {
    const postgrestError = { message: "violates row-level security policy" };
    expect(getSafeErrorMessage(postgrestError)).toBe("Você não tem permissão para realizar esta ação.");
  });

  it("usa o fallback genérico para erro desconhecido, sem vazar detalhe interno", () => {
    const postgrestError = { message: "relation projetos_rentabilidade_x does not exist" };
    expect(getSafeErrorMessage(postgrestError)).toBe("Ocorreu um erro. Tente novamente.");
  });

  it("traduz a colisão de código de projeto sem vazar o nome da constraint", () => {
    // Exatamente o toast que a VRZ recebeu em produção em 03/09.
    const postgrestError = {
      message: 'duplicate key value violates unique constraint "projetos_unique_empresa_codigo"',
    };
    expect(getSafeErrorMessage(postgrestError)).toBe("Já existe um projeto com esse código.");
  });

  it("explica o bloqueio de valor de contrato em vez do texto cru do banco", () => {
    const postgrestError = { message: "Sem permissão para definir valor de contrato ou margem" };
    expect(getSafeErrorMessage(postgrestError)).toBe(
      "Só quem tem acesso ao Financeiro pode informar valor de contrato ou margem."
    );
  });
});
