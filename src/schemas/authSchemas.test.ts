import { describe, it, expect } from "vitest";
import { companySetupSchema, loginSchema, profileSetupSchema, signupSchema } from "./authSchemas";

describe("companySetupSchema — CNPJ checksum", () => {
  it("aceita CNPJ válido formatado", () => {
    // CNPJ de exemplo válido: 11.222.333/0001-81
    expect(companySetupSchema.safeParse({ name: "Empresa", cnpj: "11.222.333/0001-81" }).success).toBe(true);
  });

  it("aceita CNPJ vazio (campo opcional)", () => {
    expect(companySetupSchema.safeParse({ name: "Empresa", cnpj: "" }).success).toBe(true);
  });

  it("aceita sem campo cnpj", () => {
    expect(companySetupSchema.safeParse({ name: "Empresa" }).success).toBe(true);
  });

  it("rejeita CNPJ com dígitos verificadores errados", () => {
    const r = companySetupSchema.safeParse({ name: "Empresa", cnpj: "11.222.333/0001-99" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].message).toContain("CNPJ inválido");
    }
  });

  it("rejeita CNPJ de dígitos repetidos (ex: 00.000.000/0000-00)", () => {
    const r = companySetupSchema.safeParse({ name: "Empresa", cnpj: "00.000.000/0000-00" });
    expect(r.success).toBe(false);
  });

  it("rejeita nome vazio", () => {
    expect(companySetupSchema.safeParse({ name: "", cnpj: "" }).success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("aceita email e senha válidos", () => {
    expect(loginSchema.safeParse({ email: "user@empresa.com", password: "senha123" }).success).toBe(true);
  });

  it("rejeita email inválido", () => {
    expect(loginSchema.safeParse({ email: "nao-é-email", password: "senha123" }).success).toBe(false);
  });

  it("rejeita senha vazia", () => {
    expect(loginSchema.safeParse({ email: "user@empresa.com", password: "" }).success).toBe(false);
  });

  it("normaliza email para lowercase", () => {
    const r = loginSchema.safeParse({ email: "User@Empresa.COM", password: "x" });
    if (r.success) expect(r.data.email).toBe("user@empresa.com");
  });
});

describe("signupSchema: aceite dos Termos (SPEC 049)", () => {
  const validBase = {
    nome: "João",
    email: "joao@empresa.com",
    telefone: "11999999999",
    password: "Senha@123456!",
    confirmPassword: "Senha@123456!",
    companyName: "Empresa X",
    termsAccepted: true,
  };

  it("aceita quando termsAccepted é true", () => {
    expect(signupSchema.safeParse(validBase).success).toBe(true);
  });

  it("rejeita quando termsAccepted é false", () => {
    const r = signupSchema.safeParse({ ...validBase, termsAccepted: false });
    expect(r.success).toBe(false);
    if (!r.success) {
      const issue = r.error.issues.find((i) => i.path.includes("termsAccepted"));
      expect(issue?.message).toContain("Termos de Uso");
    }
  });
});

describe("profileSetupSchema", () => {
  const validBase = {
    firstName: "João",
    lastName: "Silva",
    phone: "11999999999",
    password: "Senha@123456!",
    confirmPassword: "Senha@123456!",
  };

  it("aceita dados válidos", () => {
    expect(profileSetupSchema.safeParse(validBase).success).toBe(true);
  });

  it("rejeita senhas que não coincidem", () => {
    const r = profileSetupSchema.safeParse({ ...validBase, confirmPassword: "outra-senha-diferente!" });
    expect(r.success).toBe(false);
    if (!r.success) {
      const issue = r.error.issues.find((i) => i.path.includes("confirmPassword"));
      expect(issue?.message).toContain("coincidem");
    }
  });

  it("rejeita telefone muito curto", () => {
    expect(profileSetupSchema.safeParse({ ...validBase, phone: "123" }).success).toBe(false);
  });
});
