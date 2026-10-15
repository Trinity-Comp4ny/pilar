import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Régua da arquitetura do front (ADR 0055): `src/pages/<modulo>/` é a pasta da feature.
 *
 * 1. Módulo não importa de outro módulo. O que dois módulos usam sobe para `src/hooks`,
 *    `src/lib` ou `src/components`. Os imports cruzados que existiam em 13/10 estão em
 *    CRUZADOS_ACEITOS: a contagem de cada par só pode cair, par novo reprova.
 * 2. Arquivo compartilhado (`src/hooks`, `src/lib`, `src/components`) usado por um módulo
 *    só desce para esse módulo. Exceção: utilitário genérico (GENERICOS), que é
 *    compartilhado por natureza mesmo com um usuário hoje (ADR 0008).
 */

const RAIZ = join(process.cwd(), "src");

// Medido em 13/10, depois de descer 11 arquivos para o módulo e subir usePlans e CycleToggle.
const CRUZADOS_ACEITOS: Record<string, number> = {
  "admin -> company": 6,
  "chat -> financeiro": 1,
  "chat -> projetos": 2,
  "cliente -> obras": 1,
  "cliente -> portal": 6,
  "clientes -> cliente": 1,
  "clientes -> portal": 3,
  "comprar-tokens -> checkout": 3,
  "meu-trabalho -> projetos": 1,
  "obras -> meu-trabalho": 5,
  "pessoas -> meu-trabalho": 1,
  "portal -> cliente": 3,
  "projetos -> mapa": 1,
};

// Genérico por natureza (não sabe de domínio), mesmo usado por um módulo hoje.
const GENERICOS = new Set([
  "components/DuplicateWarningDialog.tsx",
  "components/filters/FilterBar.tsx", // SPEC 121: toolbar padrão, vai a todas as listas (fase 2 em diante)
  "components/filters/filterStyles.ts",
  "components/filters/MultiSelectFilter.tsx",
  "components/PageSlots.tsx", // SPEC 121: portal para toolbar/abas de aba filha, primitivo de layout
  "components/ViewSwitcher.tsx",
  "components/forms/ValidatedField.tsx",
  "components/calendario", // motor compartilhado por camadas (ADR 0010)
  "lib/currency.ts",
  "lib/emailValidator.ts",
  "lib/pdfText.ts",
  "lib/reportError.ts",
  "lib/sanitize.ts",
]);

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return arquivos(caminho);
    return /\.tsx?$/.test(nome) && !/\.test\.tsx?$/.test(nome) ? [caminho] : [];
  });
}

const fontes = arquivos(RAIZ).map((caminho) => ({
  rel: relative(RAIZ, caminho).split(sep).join("/"),
  texto: readFileSync(caminho, "utf8"),
}));

/** Módulo dono do arquivo (`pages/<modulo>/...`) ou null para o resto do app. */
function moduloDe(rel: string): string | null {
  const partes = rel.split("/");
  return partes[0] === "pages" && partes.length > 2 ? partes[1] : null;
}

const IMPORT = /from ["']@\/([^"']+)["']/g;

describe("arquitetura do front (ADR 0055)", () => {
  it("módulo não passa a importar de outro módulo", () => {
    const contagem: Record<string, number> = {};
    for (const { rel, texto } of fontes) {
      const origem = moduloDe(rel);
      if (!origem) continue;
      for (const [, alvo] of texto.matchAll(IMPORT)) {
        const destino = moduloDe(alvo);
        if (destino && destino !== origem) {
          const par = `${origem} -> ${destino}`;
          contagem[par] = (contagem[par] ?? 0) + 1;
        }
      }
    }
    const acima = Object.entries(contagem)
      .filter(([par, n]) => n > (CRUZADOS_ACEITOS[par] ?? 0))
      .map(([par, n]) => `${par}: ${n} (aceito: ${CRUZADOS_ACEITOS[par] ?? 0})`);
    expect(acima, "Suba o código usado pelos dois módulos para src/hooks, src/lib ou src/components").toEqual([]);
  });

  it("arquivo compartilhado usado por um módulo só desce para o módulo", () => {
    const consumidores = new Map<string, Set<string>>();
    for (const { rel, texto } of fontes) {
      const quem = moduloDe(rel) ?? "app";
      for (const [, alvo] of texto.matchAll(IMPORT)) {
        consumidores.set(alvo, (consumidores.get(alvo) ?? new Set()).add(quem));
      }
    }

    const compartilhados = fontes
      .map((f) => f.rel)
      .filter((rel) => /^(hooks|lib|components)\//.test(rel) && !rel.startsWith("components/ui/"));

    const deUmModulo = compartilhados.filter((rel) => {
      if ([...GENERICOS].some((g) => rel === g || rel.startsWith(`${g}/`))) return false;
      const semExtensao = rel.replace(/\.tsx?$/, "").replace(/\/index$/, "");
      const quem = consumidores.get(semExtensao) ?? new Set<string>();
      return quem.size === 1 && !quem.has("app");
    });

    expect(deUmModulo, "Mova para src/pages/<modulo>/ ou, se for genérico, inclua em GENERICOS").toEqual([]);
  });
});
