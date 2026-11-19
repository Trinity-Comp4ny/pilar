const PII_PATTERNS: Array<{ re: RegExp; replace: string }> = [
  { re: /\/proposta-compartilhada#[a-f0-9-]{36}/gi, replace: "/proposta-compartilhada#[link]" },
  // O token de acesso do link público deve ficar fora da telemetria.
  { re: /\/cotar\/[A-Za-z0-9_-]{16,}/g, replace: "/cotar/[link]" },
  // CPF: 123.456.789-00 ou 12345678900
  { re: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, replace: "[CPF]" },
  // CNPJ: 12.345.678/0001-90 ou 12345678000190
  { re: /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, replace: "[CNPJ]" },
  // CEP: 12345-678 ou 12345678
  { re: /\b\d{5}-?\d{3}\b/g, replace: "[CEP]" },
  // Cartão de crédito (16 dígitos com ou sem espaços)
  { re: /\b(?:\d[ -]?){13,16}\d\b/g, replace: "[CARD]" },
];

export function scrubString(s: string, maskEmail = false): string {
  let out = s;
  for (const { re, replace } of PII_PATTERNS) {
    out = out.replace(re, replace);
  }
  return maskEmail ? out.replace(/[^\s@<>()"']+@[^\s@<>()"']+\.[a-z]{2,}/gi, "[EMAIL]") : out;
}

export function scrubTelemetry(value: unknown, sensitiveKeys: RegExp, maskEmail = false, depth = 0): unknown {
  if (depth > 5) return "[max depth]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    const masked = scrubString(value, maskEmail);
    if (masked.length > 500) return masked.slice(0, 500) + "…";
    return masked;
  }
  if (typeof value !== "object") return value;

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((v) => scrubTelemetry(v, sensitiveKeys, maskEmail, depth + 1));
  }

  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (sensitiveKeys.test(k)) {
      result[k] = "***";
    } else {
      result[k] = scrubTelemetry(v, sensitiveKeys, maskEmail, depth + 1);
    }
  }
  return result;
}
