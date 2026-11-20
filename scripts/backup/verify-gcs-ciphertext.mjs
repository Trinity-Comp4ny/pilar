import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";

const NAMES = ["backup-Production.tar.gz.enc", "storage-Production.tar.gz.enc"];

async function verify(dir) {
  const manifest = join(dir, "SHA256SUMS.txt");
  if ((await stat(manifest)).size > 1024) throw new Error("Manifesto GCS fora do tamanho esperado.");
  const lines = (await readFile(manifest, "utf8")).trimEnd().split(/\r?\n/);
  const expected = new Map();
  for (const line of lines) {
    const match = /^([\da-f]{64})  ([a-zA-Z.-]+)$/.exec(line);
    if (!match || !NAMES.includes(match[2]) || expected.has(match[2])) {
      throw new Error("Manifesto GCS com nome ou checksum inválido.");
    }
    expected.set(match[2], match[1]);
  }
  if (expected.size !== NAMES.length) throw new Error("Manifesto GCS incompleto.");
  for (const name of NAMES) {
    const file = join(dir, name);
    if (!(await stat(file)).size) throw new Error(`Arquivo cifrado vazio: ${name}.`);
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(file)) hash.update(chunk);
    if (hash.digest("hex") !== expected.get(name)) throw new Error(`Checksum GCS divergente: ${name}.`);
  }
  console.log("GCS: os dois arquivos cifrados correspondem ao manifesto.");
}

try {
  if (!process.argv[2]) throw new Error("Informe o diretório contendo o par cifrado e seu manifesto.");
  await verify(process.argv[2]);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
