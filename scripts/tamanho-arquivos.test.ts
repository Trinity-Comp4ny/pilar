import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Catraca de tamanho de arquivo do front. Arquivo acima de LIMITE linhas vira dívida
 * registrada com um teto que só pode cair: crescer reprova, e quem encolher abaixo do
 * LIMITE sai da lista. Arquivo novo já nasce abaixo do limite ou o PR explica por quê.
 *
 * Por que existe: o `RdoFormDialog.tsx` chegou a 1.5 mil linhas num componente só, e a
 * régua de arquitetura (arquitetura-front.test.ts) mede fronteira entre módulos, não o
 * tamanho de cada arquivo. Teto medido em 14/10/2026.
 */
const LIMITE = 700;

const TETO: Record<string, number> = {
  "pages/obras/components/RdoFormDialog.tsx": 1547,
  "pages/propostas/index.tsx": 1290,
  "pages/obras/components/CotacaoDetailDialog.tsx": 1196,
  "pages/campo/CampoRegistrarDia.tsx": 990,
  "pages/leads/index.tsx": 901,
  "pages/financeiro/components/LancamentoFormDialog.tsx": 852,
  "pages/projetos/components/useProjetoForm.ts": 865,
  "pages/projetos/components/CronogramaProjetosTab.tsx": 756,
  "pages/clientes/[id]/index.tsx": 805,
  "pages/financeiro/components/LancamentosTable.tsx": 790,
  "pages/projetos/components/DisciplinasTableView.tsx": 788,
  "components/admin/UsersAccessManager.tsx": 754,
  "pages/projetos/components/DisciplinaDetailDialog.tsx": 753,
  "pages/pessoas/components/PessoaFormDialog.tsx": 751,
  "pages/chat/useChat.ts": 740,
  "pages/projetos/components/CronogramaTab.tsx": 731,
  "pages/projetos/components/ProjectDetailDialog.tsx": 710,
  "pages/obras/components/cronograma/CronogramaLista.tsx": 702,
};

const RAIZ = join(process.cwd(), "src");
// Gerado pelo Supabase, não é código escrito à mão.
const IGNORADOS = new Set(["integrations/supabase/types.ts"]);

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return arquivos(caminho);
    return /\.tsx?$/.test(nome) && !/\.test\.tsx?$/.test(nome) ? [caminho] : [];
  });
}

const linhas = new Map(
  arquivos(RAIZ)
    .map((c) => [relative(RAIZ, c).split(sep).join("/"), (readFileSync(c, "utf8").match(/\n/g) ?? []).length] as const)
    .filter(([rel]) => !IGNORADOS.has(rel))
);

describe(`tamanho de arquivo do front (limite ${LIMITE} linhas)`, () => {
  it("nenhum arquivo passa do limite sem estar na lista, nem do próprio teto", () => {
    const estouros = [...linhas]
      .filter(([rel, n]) => n > LIMITE && (TETO[rel] === undefined || n > TETO[rel]))
      .map(([rel, n]) => `${rel}: ${n} linhas (teto ${TETO[rel] ?? LIMITE})`);
    expect(estouros, "Divida o arquivo por responsabilidade; não suba o teto").toEqual([]);
  });

  it("a lista só guarda arquivo que ainda passa do limite", () => {
    const obsoletos = Object.keys(TETO).filter((rel) => (linhas.get(rel) ?? 0) <= LIMITE);
    expect(obsoletos, "Arquivo encolheu ou saiu: tire da lista TETO").toEqual([]);
  });
});
