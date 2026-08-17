import { describe, expect, it } from "vitest";
import { base32Decode, generateTotp } from "./totp";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** Só pra montar o fixture do teste — a produção nunca precisa codificar base32. */
function base32Encode(buf: Buffer): string {
  let bits = "";
  for (const byte of buf) bits += byte.toString(2).padStart(8, "0");
  let out = "";
  for (let i = 0; i + 5 <= bits.length; i += 5) out += ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  const remainder = bits.length % 5;
  if (remainder > 0) {
    const last = bits.slice(bits.length - remainder).padEnd(5, "0");
    out += ALPHABET[parseInt(last, 2)];
  }
  return out;
}

describe("totp", () => {
  it("base32Decode é o inverso de base32Encode", () => {
    const original = Buffer.from("qualquer coisa aqui, 12345", "utf8");
    expect(base32Decode(base32Encode(original))).toEqual(original);
  });

  it("gera o código certo pro vetor de teste oficial da RFC 6238 (Appendix B, SHA1, T=59)", () => {
    // RFC 6238 usa o secret ASCII "12345678901234567890" direto como chave HMAC
    // (não em base32) e publica o TOTP de 8 dígitos "94287082" pra T=59 (counter=1).
    // Os 6 dígitos que qualquer app autenticador mostraria são os últimos 6
    // (mesmo valor binário, só truncado a menos dígitos): "287082".
    const secretAscii = Buffer.from("12345678901234567890", "ascii");
    const secretBase32 = base32Encode(secretAscii);
    expect(generateTotp(secretBase32, 59)).toBe("287082");
  });

  it("dois códigos na mesma janela de 30s são iguais; janelas diferentes divergem", () => {
    const secret = base32Encode(Buffer.from("teste-e2e-pilar-totp", "utf8"));
    expect(generateTotp(secret, 100)).toBe(generateTotp(secret, 101));
    expect(generateTotp(secret, 100)).not.toBe(generateTotp(secret, 140));
  });
});
