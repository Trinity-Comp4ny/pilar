/**
 * Validação e formatação de cartão de crédito, extraído de CheckoutForm.tsx
 * (checkout público) na SPEC 098 Fase 2B: AtivarPlano é o 3º uso do mesmo
 * código (regra dos 3, ADR 0008) — antes duplicado ali e em comprar-tokens.
 * CPF/CNPJ/CEP/telefone continuam em @/lib/maskUtils, não é escopo daqui.
 */

import { onlyDigits } from "@/lib/maskUtils";

export type CardBrand = "visa" | "mastercard" | "amex" | "elo" | null;

export function detectCardBrand(number: string): CardBrand {
  const n = onlyDigits(number);
  if (/^4/.test(n)) return "visa";
  if (/^5[1-5]/.test(n) || /^2[2-7]/.test(n)) return "mastercard";
  if (/^3[47]/.test(n)) return "amex";
  if (/^(4011|4312|4389|4514|4576|5041|5066|5090|6277|6362|6363|650[0-3]|6504|6505|6516|6550)/.test(n)) return "elo";
  return null;
}

export function formatCardNumber(value: string): string {
  const digits = onlyDigits(value).slice(0, 16);
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

export function formatExpiry(value: string): string {
  const digits = onlyDigits(value).slice(0, 4);
  if (digits.length > 2) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return digits;
}

// Algoritmo de Luhn: valida o dígito verificador do número do cartão.
export function luhnValid(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

export interface CreditCardValidationResult {
  ok: boolean;
  error?: string;
}

/** Valida número (Luhn + comprimento) e validade (mês/ano futuro) do cartão já digitado. */
export function validateCreditCard(cardNumber: string, expiry: string): CreditCardValidationResult {
  const cardDigits = onlyDigits(cardNumber);
  if (cardDigits.length < 13 || cardDigits.length > 19 || !luhnValid(cardDigits)) {
    return { ok: false, error: "Número do cartão inválido" };
  }

  const expiryDigits = onlyDigits(expiry);
  const expMonth = parseInt(expiryDigits.slice(0, 2), 10);
  const expYear = 2000 + parseInt(expiryDigits.slice(2, 4), 10);
  if (!(expMonth >= 1 && expMonth <= 12) || expiryDigits.length < 4) {
    return { ok: false, error: "Validade inválida (use MM/AA)" };
  }

  const lastValidDay = new Date(expYear, expMonth, 0, 23, 59, 59);
  if (lastValidDay < new Date()) {
    return { ok: false, error: "Cartão vencido" };
  }

  return { ok: true };
}
