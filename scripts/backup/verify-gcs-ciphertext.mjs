import { createHash } from "node:crypto";
import { open } from "node:fs/promises";
import { join } from "node:path";

const NAMES = ["backup-Production.tar.gz.enc", "storage-Production.tar.gz.enc"];

async function verify(dir) {
  const manifest = join(dir, "SHA256SUMS.txt");
  const handle = await open(manifest, "r");
  let text;
  try {
    if ((await handle.stat()).size > 1024) throw new Error("Manifesto GCS fora do tamanho esperado.");
    text = await handle.readFile("utf8");
  } finally {
    await handle.close();
  }
  const lines = text.trimEnd().split(/\r?\n/);
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
    const fh = await open(file, "r");
    const hash = createHash("sha256");
    try {
      if (!(await fh.stat()).size) throw new Error(`Arquivo cifrado vazio: ${name}.`);
      for await (const chunk of fh.createReadStream({ autoClose: false })) hash.update(chunk);
    } finally {
      await fh.close();
    }
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
