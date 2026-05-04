#!/usr/bin/env node
/**
 * Wrap Edge Functions com withSentry. Use: node scripts/wrap-edge-functions.mjs <name> [name...]
 *
 * Idempotente: se já está wrapped, skip.
 * Backup-friendly: se algo der errado, `git checkout` reverte.
 */

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const FN_DIR = join(process.cwd(), "supabase", "functions");

const SENTRY_IMPORT = `import { withSentry } from "../_shared/sentry.ts";\n`;

async function wrapOne(name) {
  const file = join(FN_DIR, name, "index.ts");
  let src = await readFile(file, "utf8");

  if (src.includes("withSentry")) {
    console.log(`  skip ${name} (já wrapped)`);
    return;
  }

  // 1. Adicionar import após o import do serve (linha onde está http/server.ts)
  const serveImportRe = /import \{ serve \} from "https:\/\/deno\.land\/std@[^"]+\/http\/server\.ts";/;
  const m = src.match(serveImportRe);
  if (!m) {
    console.error(`  ❌ ${name}: import de 'serve' não encontrado`);
    return;
  }
  src = src.replace(serveImportRe, m[0] + "\n" + SENTRY_IMPORT.trimEnd());

  // 2. Trocar serve(async (req) por serve(withSentry("name", async (req)
  const serveCallRe = /serve\(async \(req(:\s*Request)?\)\s*=>\s*\{/;
  if (!serveCallRe.test(src)) {
    console.error(`  ❌ ${name}: chamada serve(async (req) => {...}) não encontrada`);
    return;
  }
  src = src.replace(serveCallRe, `serve(withSentry("${name}", async (req) => {`);

  // 3. Substituir o ÚLTIMO `});` por `}));`
  // Usando lastIndexOf, considerando que o `});` final fecha o serve(...)
  const lastIdx = src.lastIndexOf("});");
  if (lastIdx === -1) {
    console.error(`  ❌ ${name}: '});' final não encontrado`);
    return;
  }
  src = src.slice(0, lastIdx) + "}));" + src.slice(lastIdx + 3);

  await writeFile(file, src);
  console.log(`  ✅ ${name}`);
}

const targets = process.argv.slice(2);
if (targets.length === 0) {
  console.error("Uso: node scripts/wrap-edge-functions.mjs <fn-name> [<fn-name>...]");
  process.exit(1);
}

console.log(`\nWrapping ${targets.length} função(ões):\n`);
for (const t of targets) {
  await wrapOne(t);
}
console.log();
