import { describe, it, expect } from "vitest";
import { formatCPF, formatCNPJ, formatPhone, formatDocument, onlyDigits, formatAgency, formatBankAccount } from "./maskUtils";

describe("onlyDigits", () => {
  it("strips non-digit characters", () => {
    expect(onlyDigits("123.456.789-00")).toBe("12345678900");
    expect(onlyDigits("(11) 99999-9999")).toBe("11999999999");
    expect(onlyDigits("abc")).toBe("");
  });
});

describe("formatCPF", () => {
  it("formats complete CPF", () => {
    expect(formatCPF("12345678900")).toBe("123.456.789-00");
  });

  it("formats partial CPF progressively", () => {
    expect(formatCPF("123")).toBe("123");
    expect(formatCPF("1234")).toBe("123.4");
    expect(formatCPF("1234567")).toBe("123.456.7");
    expect(formatCPF("1234567890")).toBe("123.456.789-0");
  });

  it("limits to 11 digits", () => {
    expect(formatCPF("123456789001234")).toBe("123.456.789-00");
  });

  it("returns empty for empty input", () => {
    expect(formatCPF("")).toBe("");
  });
});

describe("formatCNPJ", () => {
  it("formats complete CNPJ", () => {
    expect(formatCNPJ("12345678000190")).toBe("12.345.678/0001-90");
  });

  it("formats partial CNPJ progressively", () => {
    expect(formatCNPJ("12")).toBe("12");
    expect(formatCNPJ("12345")).toBe("12.345");
    expect(formatCNPJ("12345678")).toBe("12.345.678");
    expect(formatCNPJ("123456780001")).toBe("12.345.678/0001");
  });

  it("returns empty for empty input", () => {
    expect(formatCNPJ("")).toBe("");
  });
});

describe("formatPhone", () => {
  it("formats cellphone with 11 digits", () => {
    expect(formatPhone("11999999999")).toBe("(11) 99999-9999");
  });

  it("formats landline with 10 digits", () => {
    expect(formatPhone("1133334444")).toBe("(11) 3333-4444");
  });

  it("formats partial phone progressively", () => {
    expect(formatPhone("11")).toBe("11");
    expect(formatPhone("119")).toBe("(11) 9");
    expect(formatPhone("11999")).toBe("(11) 999");
  });

  it("returns empty for empty input", () => {
    expect(formatPhone("")).toBe("");
  });
});

describe("formatDocument", () => {
  it("formats as CPF when 11 digits or less", () => {
    expect(formatDocument("12345678900")).toBe("123.456.789-00");
  });

  it("formats as CNPJ when more than 11 digits", () => {
    expect(formatDocument("12345678000190")).toBe("12.345.678/0001-90");
  });
});

describe("formatAgency", () => {
  it("formats agency with up to 5 digits", () => {
    expect(formatAgency("1234")).toBe("1234");
    expect(formatAgency("12345")).toBe("12345");
  });

  it("limits to 5 digits", () => {
    expect(formatAgency("123456")).toBe("12345");
  });

  it("returns empty for empty input", () => {
    expect(formatAgency("")).toBe("");
  });

  it("removes non-digit characters", () => {
    expect(formatAgency("12a34")).toBe("1234");
  });
});

describe("formatBankAccount", () => {
  it("formats account with check digit when 6+ digits", () => {
    expect(formatBankAccount("123456")).toBe("12345-6");
    expect(formatBankAccount("1234567")).toBe("123456-7");
    expect(formatBankAccount("12345678")).toBe("1234567-8");
  });

  it("returns digits without dash when less than 6 digits", () => {
    expect(formatBankAccount("12345")).toBe("12345");
    expect(formatBankAccount("123")).toBe("123");
  });

  it("limits to 10 digits", () => {
    expect(formatBankAccount("12345678901")).toBe("123456789-0");
  });

  it("returns empty for empty input", () => {
    expect(formatBankAccount("")).toBe("");
  });

  it("removes non-digit characters", () => {
    expect(formatBankAccount("12a34b56")).toBe("12345-6");
  });
});
