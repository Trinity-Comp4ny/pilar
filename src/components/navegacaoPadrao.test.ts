import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..");

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx$/.test(name) && !/\.test\.tsx$/.test(name) ? [path] : [];
  });

const rel = (file: string) => file.replace(`${ROOT}/`, "");
const todos = sourceFiles(join(ROOT, "src"));
const ler = (file: string) => readFileSync(file, "utf8");

// SPEC 121 / ADR 0058 (navegação de seção, visão, filtros e tabelas padrão).
describe("varredura: navegação e filtros padrão (SPEC 121)", () => {
  it("não existe mais sidebar de página: SecondSidebar foi removido", () => {
    const offenders = todos.filter((f) => /from "[^"]*SecondSidebar"/.test(ler(f))).map(rel);
    expect(offenders).toEqual([]);
  });

  it("filtro não é SelectTrigger h-9 em pill; usa FilterSelect", () => {
    // Select inline de edição (badge de status h-6, modelo do chat) é outra coisa e fica de fora.
    const offenders = todos
      .filter((f) => !f.includes("/components/ui/"))
      .filter((f) => /<SelectTrigger[^>]*(?:\bh-9\b[^>]*rounded-full|rounded-full[^>]*\bh-9\b)/.test(ler(f)))
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it("segmented de visão não é montado à mão; usa ViewSwitcher", () => {
    const segmented = /inline-flex rounded-(?:full|lg|md)[^"'`]*\b(?:p-0\.5|p-1)\b/;
    const offenders = todos
      .filter((f) => !f.endsWith("components/ViewSwitcher.tsx"))
      .filter((f) => segmented.test(ler(f)))
      .map(rel);
    expect(offenders).toEqual([]);
  });
});

// Tabela à mão (`<Table>` ou `<table>`) fica só onde há razão registrada. Lista que só encolhe:
// migrou para DataTable, sai daqui. Arquivo novo com tabela à mão reprova.
const TABELA_A_MAO: Record<string, string> = {
  // Listas com comportamento que o DataTable não cobre hoje (fase de migração futura):
  "src/components/admin/UsersAccessManager.tsx": "permissões por linha, edição inline",
  "src/pages/admin/tabs/Auditoria.tsx": "duas tabelas com filtro e paginação próprios",
  "src/pages/fornecedores/[id].tsx": "linhas expansíveis (cotações)",
  "src/pages/propostas/index.tsx": "ordenação em botão e ações por linha",
  "src/pages/relatorios/RelatoriosRentabilidade.tsx": "tabela agrupada com totais",
  "src/pages/projetos/components/DisciplinasTableView.tsx": "edição inline por célula",
  "src/pages/projetos/components/DisciplinasTab.tsx": "edição inline por célula",
  "src/pages/financeiro/tabs/folha-pagamento/components/FolhaTable.tsx": "linha expansível e ações",
  "src/pages/financeiro/components/LancamentosTable.tsx": "exceção documentada: server-side, agrupada, scroll infinito",
  // Dormente (CLAUDE.md): não investir.
  "src/pages/Timesheet.tsx": "módulo dormente",
  // Tabela dentro de diálogo/editor/card de chat, não é lista de página:
  "src/pages/financeiro/tabs/folha-pagamento/components/FolhaDialogs.tsx": "diálogo",
  "src/pages/financeiro/components/ImportarLancamentosDialog.tsx": "diálogo",
  "src/pages/financeiro/components/CategoriaDetalheDialog.tsx": "diálogo",
  "src/pages/propostas/components/SmartInvoiceDialog.tsx": "diálogo",
  "src/pages/propostas/components/DisciplinasEditor.tsx": "editor",
  "src/pages/obras/components/CotacaoDetailDialog.tsx": "diálogo",
  "src/pages/chat/FolhaCard.tsx": "card do chat",
};

const TABELA = /<Table[\s>]|<table[\s>]/;

describe("varredura: tabela padrão é DataTable (SPEC 121)", () => {
  it("nenhum arquivo novo monta tabela à mão fora da lista", () => {
    const offenders = todos
      .filter((f) => !/components\/(ui\/table|data\/DataTable)\.tsx$/.test(f))
      .filter((f) => TABELA.test(ler(f)))
      .map(rel)
      .filter((f) => !(f in TABELA_A_MAO));
    expect(offenders).toEqual([]);
  });

  it("a lista não guarda arquivo que já migrou", () => {
    const migrados = Object.keys(TABELA_A_MAO).filter((f) => !TABELA.test(ler(join(ROOT, f))));
    expect(migrados).toEqual([]);
  });
});
