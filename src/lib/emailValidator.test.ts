import { describe, it, expect } from "vitest";
import {
  isValidEmail,
  isBusinessEmail,
  isPersonalEmail,
  emailFormatValidator,
} from "./emailValidator";

describe("isValidEmail", () => {
  it("aceita formatos válidos", () => {
    expect(isValidEmail("joao@empresa.com.br")).toBe(true);
    expect(isValidEmail("  ana@x.io  ")).toBe(true);
  });

  it("rejeita formatos inválidos", () => {
    expect(isValidEmail("semarroba.com")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
    expect(isValidEmail("")).toBe(false);
  });
});

describe("isPersonalEmail / isBusinessEmail", () => {
  it("reconhece provedores gratuitos globais e brasileiros", () => {
    expect(isPersonalEmail("joao@gmail.com")).toBe(true);
    expect(isPersonalEmail("joao@hotmail.com.br")).toBe(true);
    expect(isPersonalEmail("joao@uol.com.br")).toBe(true);
    expect(isBusinessEmail("joao@gmail.com")).toBe(false);
  });

  it("trata domínio corporativo como business", () => {
    expect(isBusinessEmail("joao@construtorax.com.br")).toBe(true);
    expect(isPersonalEmail("joao@construtorax.com.br")).toBe(false);
  });

  it("é case-insensitive e ignora espaços", () => {
    expect(isPersonalEmail("  Joao@GMAIL.com ")).toBe(true);
  });

  it("retorna false para e-mail sem domínio", () => {
    expect(isBusinessEmail("joao")).toBe(false);
    expect(isPersonalEmail("joao")).toBe(false);
  });
});

describe("emailFormatValidator", () => {
  it("não erra em campo vazio (validação de obrigatoriedade fica a cargo do form)", () => {
    expect(emailFormatValidator("")).toBeNull();
    expect(emailFormatValidator("   ")).toBeNull();
  });

  it("erra em formato inválido", () => {
    expect(emailFormatValidator("invalido")).toBe("E-mail em formato inválido");
  });

  it("passa em e-mail válido, pessoal ou corporativo", () => {
    expect(emailFormatValidator("joao@gmail.com")).toBeNull();
    expect(emailFormatValidator("joao@empresa.com.br")).toBeNull();
  });
});
