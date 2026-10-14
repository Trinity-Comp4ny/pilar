/**
 * Regras puras do upload de entrega do portal: o arquivo precisa ser do tipo que
 * diz ser (magic bytes) e o nome vira um nome seguro para o path do storage.
 */

export interface MagicSignature {
  mime: string;
  signatures: Array<{ offset: number; bytes: number[] }>;
}

export const MAGIC: MagicSignature[] = [
  { mime: "application/pdf", signatures: [{ offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] }] },
  { mime: "image/png", signatures: [{ offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }] },
  { mime: "image/jpeg", signatures: [{ offset: 0, bytes: [0xff, 0xd8, 0xff] }] },
  { mime: "image/gif", signatures: [{ offset: 0, bytes: [0x47, 0x49, 0x46, 0x38] }] },
  {
    mime: "image/webp",
    signatures: [
      { offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] },
      { offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] },
    ],
  },
  {
    mime: "application/zip",
    signatures: [{ offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] }],
  },
  {
    mime: "application/x-zip-compressed",
    signatures: [{ offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] }],
  },
  // Office OpenXML (docx/xlsx/pptx) = ZIP
  {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    signatures: [{ offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] }],
  },
  {
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    signatures: [{ offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] }],
  },
  {
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    signatures: [{ offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] }],
  },
  // Office legacy (doc/xls/ppt) = OLE2
  {
    mime: "application/msword",
    signatures: [{ offset: 0, bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] }],
  },
  {
    mime: "application/vnd.ms-excel",
    signatures: [{ offset: 0, bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] }],
  },
  {
    mime: "application/vnd.ms-powerpoint",
    signatures: [{ offset: 0, bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] }],
  },
];

// text/plain e text/csv não têm magic bytes fixos — check heurístico
export const TEXT_MIMES = new Set(["text/plain", "text/csv"]);

export function validateMagicBytes(bytes: Uint8Array, declaredMime: string): boolean {
  if (TEXT_MIMES.has(declaredMime)) {
    // Heurística: só caracteres imprimíveis/whitespace nos primeiros 1024 bytes
    const sample = bytes.slice(0, 1024);
    for (const b of sample) {
      if (b === 0) return false;
      if (b < 0x09 || (b > 0x0d && b < 0x20)) return false;
    }
    return true;
  }

  const matches = MAGIC.filter((m) => m.mime === declaredMime);
  if (matches.length === 0) return false;

  return matches.some((m) =>
    m.signatures.every((sig) => {
      const slice = bytes.slice(sig.offset, sig.offset + sig.bytes.length);
      return sig.bytes.every((expected, i) => slice[i] === expected);
    })
  );
}

export function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/\.{2,}/g, ".")
    .slice(0, 120);
}
