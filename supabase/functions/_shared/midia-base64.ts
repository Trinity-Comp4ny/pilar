// Decodifica mídia enviada em base64 (foto, áudio) com o tamanho conferido ANTES de
// decodificar (4 caracteres = 3 bytes): não aloca uma string gigante à toa, e base64
// malformado vira erro 400 em vez de derrubar a função.

export type Midia = { ok: true; bytes: Uint8Array } | { ok: false; status: 400 | 413; erro: string };

export function decodificarBase64(base64: string, maxBytes: number, nome: string): Midia {
  if (Math.floor((base64.length * 3) / 4) > maxBytes + 3) {
    return { ok: false, status: 413, erro: `${nome} grande demais` };
  }
  let binario: string;
  try {
    binario = atob(base64);
  } catch {
    return { ok: false, status: 400, erro: `${nome} inválido` };
  }
  const bytes = Uint8Array.from(binario, (c) => c.charCodeAt(0));
  if (bytes.byteLength === 0) return { ok: false, status: 400, erro: `${nome} vazio` };
  if (bytes.byteLength > maxBytes) return { ok: false, status: 413, erro: `${nome} grande demais` };
  return { ok: true, bytes };
}
