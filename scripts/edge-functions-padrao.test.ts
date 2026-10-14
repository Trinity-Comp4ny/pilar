import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Padrão das Edge Functions (ADR 0056): uma função por endpoint, uniformes por regra
 * compartilhada. Este teste é a régua; função nova que foge dela reprova o PR.
 *
 * 1. Todo handler passa por withSentry/withSentryCron (erro, trace e cron no Sentry).
 * 2. Chamada a serviço de terceiro passa por fetchComTempo (_shared/http.ts): fetch
 *    cru só nos módulos que já põem o próprio signal com tempo limite.
 * 3. Ninguém volta ao corsHeaders estático (removido em 13/10).
 */
const RAIZ = join(process.cwd(), "supabase/functions");

// Módulos com fetch cru e motivo: o próprio helper; IA e healthcheck com AbortSignal
// próprio (timeout por chamada); script local de evals, não publicado.
const FETCH_CRU_PERMITIDO = new Set([
  "_shared/http.ts",
  "_shared/ai-client.ts",
  "_shared/llm.ts",
  "_shared/healthcheck.ts",
  "ai-chat/evals/rodar.ts",
]);

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return arquivos(caminho);
    return nome.endsWith(".ts") && !nome.endsWith(".test.ts") ? [caminho] : [];
  });
}

const funcoes = readdirSync(RAIZ, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
  .map((d) => d.name);

describe("padrão das Edge Functions (ADR 0056)", () => {
  it("encontrou as funções", () => {
    expect(funcoes.length).toBeGreaterThan(40);
  });

  it("todo handler passa por withSentry ou withSentryCron", () => {
    const sem = funcoes.filter((f) => !/withSentry(Cron)?\(/.test(readFileSync(join(RAIZ, f, "index.ts"), "utf8")));
    expect(sem, "Envolva o handler com withSentry (ou withSentryCron em cron)").toEqual([]);
  });

  it("chamada externa tem tempo limite (fetchComTempo)", () => {
    const cru = arquivos(RAIZ)
      .map((f) => relative(RAIZ, f))
      .filter((f) => !FETCH_CRU_PERMITIDO.has(f))
      .filter((f) => /(^|[^\w.])fetch\(/.test(readFileSync(join(RAIZ, f), "utf8")));
    expect(cru, "Use fetchComTempo de _shared/http.ts").toEqual([]);
  });

  it("ninguém usa o corsHeaders estático", () => {
    const legado = arquivos(RAIZ).filter((f) =>
      /import \{[^}]*\bcorsHeaders\b[^}]*\} from ".*cors\.ts"/.test(readFileSync(f, "utf8"))
    );
    expect(legado.map((f) => relative(RAIZ, f))).toEqual([]);
  });
});
