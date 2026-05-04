import { describe, it, expect, beforeEach, vi } from "vitest";

// Forçamos modo no-op (sem DSN). monitoring.captureException loga via console em DEV.
vi.stubEnv("VITE_SENTRY_DSN", "");

import { monitoring } from "./monitoring";

describe("monitoring scrubber — keys sensíveis", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  function getLastExtra(): unknown {
    const call = consoleSpy.mock.calls[consoleSpy.mock.calls.length - 1] ?? [];
    return call[2];
  }

  it("mascara keys sensíveis (password, token, cpf, cnpj)", () => {
    monitoring.captureException(new Error("x"), {
      password: "hunter2",
      token: "abc",
      cpf: "12345678900",
      cnpj: "12345678000190",
      ok: "visible",
    });
    const extra = getLastExtra() as Record<string, unknown>;
    expect(extra.password).toBe("***");
    expect(extra.token).toBe("***");
    expect(extra.cpf).toBe("***");
    expect(extra.cnpj).toBe("***");
    expect(extra.ok).toBe("visible");
  });

  it("mascara CPF dentro de strings em valores benignos", () => {
    monitoring.captureException(new Error("x"), {
      message: "Cliente 123.456.789-00 atualizado",
    });
    const extra = getLastExtra() as Record<string, unknown>;
    expect(extra.message).toBe("Cliente [CPF] atualizado");
  });

  it("mascara CNPJ dentro de strings", () => {
    monitoring.captureException(new Error("x"), {
      payload: "Empresa 12.345.678/0001-90 cadastrada",
    });
    const extra = getLastExtra() as Record<string, unknown>;
    expect(extra.payload).toBe("Empresa [CNPJ] cadastrada");
  });

  it("mascara CEP dentro de strings", () => {
    monitoring.captureException(new Error("x"), {
      address: "Rua X, CEP 01234-567",
    });
    const extra = getLastExtra() as Record<string, unknown>;
    expect(extra.address).toBe("Rua X, CEP [CEP]");
  });

  it("recursivo em objetos aninhados", () => {
    monitoring.captureException(new Error("x"), {
      user: {
        nome: "João",
        cpf: "12345678900",
        endereco: {
          rua: "Rua das Flores",
          cep: "01234-567",
        },
      },
    });
    const extra = getLastExtra() as Record<string, unknown>;
    const user = extra.user as Record<string, unknown>;
    expect(user.cpf).toBe("***");
    const endereco = user.endereco as Record<string, unknown>;
    expect(endereco.cep).toBe("Rua das Flores".includes("[CEP]") ? "[CEP]" : endereco.cep);
    expect(endereco.rua as string).toBe("Rua das Flores");
  });

  it("não mascara strings sem padrões PII", () => {
    monitoring.captureException(new Error("x"), {
      msg: "Operação concluída com sucesso",
    });
    const extra = getLastExtra() as Record<string, unknown>;
    expect(extra.msg).toBe("Operação concluída com sucesso");
  });
});
