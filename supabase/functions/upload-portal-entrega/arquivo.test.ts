import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { sanitizeFilename, validateMagicBytes } from "./arquivo.ts";

const bytes = (...b: number[]) => new Uint8Array([...b, 0, 0, 0, 0, 0, 0, 0, 0]);

Deno.test("aceita arquivo cujo conteúdo bate com o tipo declarado", () => {
  assertEquals(validateMagicBytes(bytes(0x25, 0x50, 0x44, 0x46), "application/pdf"), true);
  assertEquals(validateMagicBytes(bytes(0xff, 0xd8, 0xff), "image/jpeg"), true);
  assertEquals(
    validateMagicBytes(
      bytes(0x50, 0x4b, 0x03, 0x04),
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ),
    true
  );
});

Deno.test("webp confere as duas assinaturas (RIFF e WEBP no offset 8)", () => {
  const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]);
  assertEquals(validateMagicBytes(webp, "image/webp"), true);
  const riffQualquer = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x41, 0x56, 0x49, 0x20]);
  assertEquals(validateMagicBytes(riffQualquer, "image/webp"), false);
});

Deno.test("recusa executável declarado como PDF e tipo fora da lista", () => {
  assertEquals(validateMagicBytes(bytes(0x4d, 0x5a), "application/pdf"), false);
  assertEquals(validateMagicBytes(bytes(0x25, 0x50, 0x44, 0x46), "application/x-msdownload"), false);
});

Deno.test("texto só passa se não tiver bytes binários", () => {
  assertEquals(validateMagicBytes(new TextEncoder().encode("nome;valor\nA;1\n"), "text/csv"), true);
  assertEquals(validateMagicBytes(new Uint8Array([0x41, 0x00, 0x42]), "text/plain"), false);
});

Deno.test("nome do arquivo vira nome seguro para o path", () => {
  assertEquals(sanitizeFilename("../../etc/passwd"), "._._etc_passwd");
  assertEquals(sanitizeFilename("Planta baixa (rev 2).pdf"), "Planta_baixa__rev_2_.pdf");
  assertEquals(sanitizeFilename("a".repeat(300) + ".pdf").length, 120);
});
