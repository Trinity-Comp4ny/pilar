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

// SPEC 124 / ADR 0059 (navegação de seção, visão, filtros e tabelas padrão).
describe("varredura: navegação e filtros padrão (SPEC 124)", () => {
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
    // Pílula/segmented montado à mão, ou grupo de botões "rounded-none" dentro de uma borda (zoom, visão).
    const segmented = /inline-flex rounded-(?:full|lg|md)[^"'`]*\b(?:p-0\.5|p-1)\b|<Button[^>]*\brounded-none\b/;
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
  // Listas com comportamento que o DataTable ainda não cobre (SPEC 127):
  "src/pages/financeiro/components/LancamentosTable.tsx":
    "server-side, agrupada, virtualizada: <table> própria, mas com o visual do DataTable (constantes compartilhadas)",
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

describe("varredura: tabela padrão é DataTable (SPEC 124)", () => {
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

describe("varredura: tabelas com <table> própria seguem o visual do DataTable (SPEC 127, fase 3)", () => {
  it("LancamentosTable usa as classes compartilhadas de cabeçalho e célula", () => {
    const src = ler(join(ROOT, "src/pages/financeiro/components/LancamentosTable.tsx"));
    expect(src).toContain("TABLE_HEAD_CLASS");
    expect(src).toContain("TABLE_CELL_DENSE_CLASS");
  });
});

// Seção de página é SectionTabs e troca de visão é ViewSwitcher; a pílula cinza `TabsList` só fica onde
// há motivo registrado (SPEC 124, limpeza). A lista só encolhe.
const TABSLIST_PERMITIDO: Record<string, string> = {
  "src/components/ui/responsive-detail-panels.tsx": "painel de detalhe responsivo (primitivo de UI)",
  "src/components/settings/panels/EmpresaPanel.tsx": "dentro do modal de configurações, outro contexto de navegação",
  "src/pages/Timesheet.tsx": "módulo dormente",
};

describe("varredura: abas em pílula cinza (SPEC 124)", () => {
  it("TabsList só aparece onde há motivo registrado", () => {
    const offenders = todos
      .filter((f) => !f.endsWith("components/ui/tabs.tsx"))
      .filter((f) => /<TabsList[\s>]/.test(ler(f)))
      .map(rel)
      .filter((f) => !(f in TABSLIST_PERMITIDO));
    expect(offenders).toEqual([]);
  });

  it("a lista de TabsList permitido não guarda arquivo que já migrou", () => {
    const migrados = Object.keys(TABSLIST_PERMITIDO).filter((f) => !/<TabsList[\s>]/.test(ler(join(ROOT, f))));
    expect(migrados).toEqual([]);
  });
});
