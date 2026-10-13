import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * O catálogo (eventosProduto.ts) garante que todo `track()` usa um nome conhecido. Este
 * teste fecha o outro lado: evento no catálogo que nenhuma tela dispara é métrica que
 * parece existir no PostHog e nunca chega. Textual de propósito, como env.paridade.test.ts.
 */
const raiz = join(process.cwd(), "src");
const catalogo = readFileSync(join(raiz, "lib/eventosProduto.ts"), "utf8");
const eventos = [...catalogo.matchAll(/^\s*\|\s*"([^"]+)"/gm)].map((m) => m[1]);

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return arquivos(caminho);
    return /\.(ts|tsx)$/.test(nome) && !/\.test\.tsx?$/.test(nome) ? [caminho] : [];
  });
}

const codigo = arquivos(raiz)
  .filter((f) => !f.endsWith("eventosProduto.ts"))
  .map((f) => readFileSync(f, "utf8"))
  .join("\n");

describe("catálogo de eventos de produto", () => {
  it("leu os eventos do catálogo", () => {
    expect(eventos.length).toBeGreaterThan(20);
  });

  it("todo evento do catálogo é disparado por alguma tela", () => {
    const semUso = eventos.filter((e) => !codigo.includes(`track("${e}"`));
    expect(semUso, "Dispare o evento (analytics.track) ou tire do catálogo").toEqual([]);
  });
});
