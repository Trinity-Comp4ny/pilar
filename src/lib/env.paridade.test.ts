import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// vitest roda a partir da raiz do projeto; import.meta.url não é file:// no ambiente jsdom.
const root = process.cwd();

/**
 * Paridade de configuração: toda chave VITE_ que o schema de `env.ts` espera precisa
 * estar documentada no `.env.example`. Pega a classe de bug que o próprio env.ts relata
 * (VITE_TURNSTILE_SITE_KEY / VITE_POSTHOG_* usadas no código sem estarem no exemplo),
 * que só aparecia em runtime num ambiente novo mal configurado.
 *
 * É textual de propósito: importar env.ts dispararia o parse no boot (efeito colateral),
 * então lemos os dois arquivos como texto.
 */
const envTs = readFileSync(join(root, "src/lib/env.ts"), "utf8");
const exemplo = readFileSync(join(root, ".env.example"), "utf8");

// Chaves declaradas no z.object de env.ts (indentação de 2 espaços dentro do schema).
const schemaKeys = [...envTs.matchAll(/^ {2}(VITE_[A-Z0-9_]+):/gm)].map((m) => m[1]);
// Chaves presentes no .env.example (linha "VITE_XXX=").
const exampleKeys = new Set([...exemplo.matchAll(/^(VITE_[A-Z0-9_]+)=/gm)].map((m) => m[1]));

// Alias legado aceito por compatibilidade, mas não canônico: não precisa ser documentado.
const NAO_DOCUMENTAR = new Set(["VITE_SENTRY_TRACES_RATE"]);

describe("paridade de env (.env.example ⊇ schema de env.ts)", () => {
  it("extraiu as chaves do schema", () => {
    expect(schemaKeys.length).toBeGreaterThan(3);
  });

  it("toda chave do schema está documentada no .env.example", () => {
    const faltando = schemaKeys.filter((k) => !exampleKeys.has(k) && !NAO_DOCUMENTAR.has(k));
    expect(faltando, `No schema de env.ts mas ausentes do .env.example: ${faltando.join(", ")}`).toEqual([]);
  });
});
