import { createHmac } from "node:crypto";

/**
 * TOTP (RFC 6238) sem dependência nova — só pra gerar o código de MFA do
 * usuário de teste E2E a cada login (mesma conta do `otpauth://` que um app
 * autenticador leria). O secret vem em base32 (formato padrão que
 * `supabase.auth.mfa.enroll()` retorna em `totp.secret`).
 */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** Decodifica base32 (RFC 4648, sem padding) para Buffer. */
export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/=+$/, "").replace(/\s+/g, "");
  let bits = "";
  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) throw new Error(`[totp] caractere base32 inválido: ${char}`);
    bits += idx.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

/**
 * Gera o código TOTP de 6 dígitos pro instante atual (ou pro Unix time
 * passado em `atSeconds`, usado só no teste). Janela padrão de 30s, HMAC-SHA1
 * — o par que toda ferramenta de MFA (Supabase incluído) usa por padrão.
 */
export function generateTotp(base32Secret: string, atSeconds: number = Date.now() / 1000): string {
  const key = base32Decode(base32Secret);
  const counter = Math.floor(atSeconds / 30);

  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const hmac = createHmac("sha1", key).update(counterBuffer).digest();

  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return (binary % 1_000_000).toString().padStart(6, "0");
}
