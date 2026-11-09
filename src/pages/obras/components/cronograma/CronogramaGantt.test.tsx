import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { NoArvore } from "@/pages/obras/lib/obraArvore";
import type { ObraFrenteRow } from "@/pages/obras/hooks/useObraFrentes";
import type { ObraTarefa } from "@/pages/obras/hooks/useObraTarefas";
import type { CronogramaAcoes } from "./useCronogramaAcoes";

// Gantt da obra: barras próprias (arrastáveis) e resumo tracejado, recolher pela
// barra, concluir tarefa, zoom e "Hoje". O arraste em si é do useGanttDrag (com
// teste próprio): aqui ele entra dublado e o commit é chamado direto.

type Commit = (chave: string, p: { start: Date; end: Date }) => Promise<void>;
const g = vi.hoisted(() => ({
  commit: null as null | Commit,
  startDrag: vi.fn(),
  suprimir: false,
  isSaving: false,
  isDragging: false,
  semGeometria: new Set<string>(),
  enabled: undefined as boolean | undefined,
  mobile: false,
}));
vi.mock("@/components/gantt/useGanttDrag", () => ({
  useGanttDrag: (o: { onCommit: Commit; enabled: boolean }) => {
    g.commit = o.onCommit;
    g.enabled = o.enabled;
    return {
      isSaving: g.isSaving,
      isDragging: g.isDragging,
      startDrag: g.startDrag,
      shouldSuppressClick: () => g.suprimir,
      getBarGeometry: (chave: string) => (g.semGeometria.has(chave) ? null : { leftPct: 10, widthPct: 20 }),
    };
  },
}));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => g.mobile }));

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
const scrollTo = vi.fn();
Element.prototype.scrollTo = scrollTo as never;

import { CronogramaGantt } from "./CronogramaGantt";

type Arvore = NoArvore<ObraFrenteRow, ObraTarefa>;

const iso = (dias: number) => {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const tarefa = (p: Partial<ObraTarefa>): ObraTarefa =>
  ({ id: "t", titulo: "T", status: "a_fazer", data_inicio: null, prazo: null, ...p }) as unknown as ObraTarefa;

const arvore = (no: Partial<ObraFrenteRow>, p: Partial<Arvore> = {}): Arvore => ({
  no: { id: "x", nome: "X", parent_id: null, data_inicio: null, data_fim: null, ...no } as ObraFrenteRow,
  nivel: "fase",
  filhos: [],
  tarefas: [],
  todasTarefas: [],
  periodoProprio: null,
  periodo: null,
  progresso: 0,
  concluidas: 0,
  total: 0,
  estado: "sem_prazo",
  ...p,
});

const tConcluida = tarefa({ id: "t1", titulo: "Concretar", status: "concluida", data_inicio: iso(-5), prazo: iso(-1) });
const tSemData = tarefa({ id: "t2", titulo: "Sem data" });
const servico = arvore(
  { id: "s1", nome: "Sapatas", data_inicio: iso(-10), data_fim: iso(20) },
  {
    nivel: "servico",
    tarefas: [tConcluida, tSemData],
    total: 2,
    progresso: 50,
    estado: "em_andamento",
    periodo: { inicio: iso(-10), fim: iso(20) },
  }
);
const etapa = arvore(
  { id: "e1", nome: "Fundação" },
  { nivel: "etapa", filhos: [servico], total: 2, progresso: 50, periodo: { inicio: iso(-10), fim: iso(20) } }
);
const fase = arvore({ id: "f1", nome: "Estrutura" }, { filhos: [etapa], periodo: { inicio: iso(-10), fim: iso(30) } });
const faseSemPeriodo = arvore({ id: "f2", nome: "Acabamento" });

let acoes: CronogramaAcoes;
const onToggle = vi.fn();
const onIrParaLista = vi.fn();

function montar(p: Partial<React.ComponentProps<typeof CronogramaGantt>> = {}) {
  return render(
    <CronogramaGantt
      fases={[fase, faseSemPeriodo]}
      recolhidos={new Set()}
      onToggle={onToggle}
      canEdit
      acoes={acoes}
      onIrParaLista={onIrParaLista}
      {...p}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  g.suprimir = false;
  g.isSaving = false;
  g.isDragging = false;
  g.semGeometria = new Set();
  g.mobile = false;
  acoes = {
    atualizarNo: vi.fn().mockResolvedValue(undefined),
    atualizarTarefa: vi.fn().mockResolvedValue(undefined),
  } as unknown as CronogramaAcoes;
});

describe("CronogramaGantt", () => {
  it("sem nenhum período mostra o vazio que leva para a lista", () => {
    montar({ fases: [faseSemPeriodo] });
    expect(screen.getByText("Sem datas para a linha do tempo")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ir para a lista" }));
    expect(onIrParaLista).toHaveBeenCalled();
  });

  it("desenha a árvore, rola até hoje e mostra a legenda de edição", () => {
    montar();
    expect(screen.getByText("Linha do tempo")).toBeInTheDocument();
    expect(screen.getAllByText("Estrutura").length).toBeGreaterThan(0);
    expect(screen.getByText("Serviço · Em andamento · 50%")).toBeInTheDocument();
    expect(screen.getAllByText("Fase · Sem período")).toHaveLength(2);
    expect(screen.getAllByText("Concretar")[0]).toHaveClass("line-through");
    expect(screen.getAllByText("sem período")).toHaveLength(2); // fase sem período e tarefa sem data
    expect(screen.getByText("Arraste as bordas para ajustar as datas")).toBeInTheDocument();
    expect(scrollTo).toHaveBeenCalled();
    scrollTo.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Hoje" }));
    expect(scrollTo).toHaveBeenCalled();
  });

  it("recolher pela seta e pela barra; barra de tarefa não recolhe", () => {
    montar({ recolhidos: new Set(["e1"]) });
    const [recolherF1, expandirE1] = screen.getAllByRole("button", { name: /Recolher|Expandir/ });
    expect(expandirE1).toHaveAccessibleName("Expandir");
    fireEvent.click(recolherF1);
    expect(onToggle).toHaveBeenCalledWith("f1");
    // Resumo tracejado da fase (sem data própria) recolhe ao clicar.
    fireEvent.click(screen.getByTitle("Estrutura · período pelos itens abaixo"));
    expect(onToggle).toHaveBeenLastCalledWith("f1");
    expect(screen.queryByText("Sapatas")).not.toBeInTheDocument();
  });

  it("barra própria: clique recolhe (a não ser logo após arrastar); tarefa mostra o título", () => {
    montar();
    fireEvent.click(screen.getByTitle("Sapatas · Em andamento"));
    expect(onToggle).toHaveBeenCalledWith("s1");
    g.suprimir = true;
    onToggle.mockClear();
    fireEvent.click(screen.getByTitle("Sapatas · Em andamento"));
    expect(onToggle).not.toHaveBeenCalled();
    g.suprimir = false;
    fireEvent.click(screen.getByTitle("Concretar · Concluída"));
    expect(onToggle).not.toHaveBeenCalled();
    expect(within(screen.getByTitle("Sapatas · Em andamento")).getByText("50%")).toBeInTheDocument();
    expect(within(screen.getByTitle("Concretar · Concluída")).getByText("Concretar")).toBeInTheDocument();
  });

  it("arrastar: corpo move, alças redimensionam; commit grava nó e tarefa", async () => {
    montar();
    const barra = screen.getByTitle("Sapatas · Em andamento");
    fireEvent.mouseDown(barra, { clientX: 100 });
    expect(g.startDrag).toHaveBeenCalledWith(
      100,
      "no:s1",
      "move",
      expect.objectContaining({ start: expect.any(Date) })
    );
    const [esquerda, direita] = Array.from(barra.parentElement!.querySelectorAll("[aria-hidden]"));
    fireEvent.mouseDown(esquerda, { clientX: 50 });
    expect(g.startDrag).toHaveBeenLastCalledWith(50, "no:s1", "left", expect.anything());
    fireEvent.mouseDown(direita, { clientX: 70 });
    expect(g.startDrag).toHaveBeenLastCalledWith(70, "no:s1", "right", expect.anything());

    await act(() => g.commit!("no:s1", { start: new Date(2026, 2, 1), end: new Date(2026, 2, 10) }));
    expect(acoes.atualizarNo).toHaveBeenCalledWith({ id: "s1", data_inicio: "2026-03-01", data_fim: "2026-03-10" });
    await act(() => g.commit!("tarefa:t1", { start: new Date(2026, 2, 2), end: new Date(2026, 2, 3) }));
    expect(acoes.atualizarTarefa).toHaveBeenCalledWith({ id: "t1", data_inicio: "2026-03-02", prazo: "2026-03-03" });
  });

  it("concluir e reabrir tarefa pelo checkbox", () => {
    montar();
    fireEvent.click(screen.getByRole("checkbox", { name: "Concluir Concretar" }));
    expect(acoes.atualizarTarefa).toHaveBeenCalledWith({ id: "t1", status: "a_fazer" });
    fireEvent.click(screen.getByRole("checkbox", { name: "Concluir Sem data" }));
    expect(acoes.atualizarTarefa).toHaveBeenCalledWith({ id: "t2", status: "concluida" });
  });

  it("somente leitura: sem alças, sem arraste e checkbox travado", () => {
    montar({ canEdit: false });
    expect(g.enabled).toBe(false);
    const barra = screen.getByTitle("Sapatas · Em andamento");
    expect(barra.parentElement!.querySelectorAll("[aria-hidden]")).toHaveLength(0);
    fireEvent.mouseDown(barra, { clientX: 10 });
    expect(g.startDrag).not.toHaveBeenCalled();
    expect(screen.getByRole("checkbox", { name: "Concluir Concretar" })).toBeDisabled();
    expect(screen.queryByText("Arraste as bordas para ajustar as datas")).not.toBeInTheDocument();
  });

  it("estado de arraste/salvamento, zoom em semanas e mobile sem subtítulo", () => {
    g.isSaving = true;
    g.isDragging = true;
    g.mobile = true;
    montar();
    expect(screen.getByText("Salvando…")).toBeInTheDocument();
    expect(screen.getByText("Esc cancela")).toBeInTheDocument();
    expect(screen.queryByText(/Serviço · /)).not.toBeInTheDocument();
    const semanas = screen.getByRole("button", { name: /Semanas/ });
    fireEvent.click(semanas);
    expect(semanas).toHaveAttribute("aria-pressed", "true");
  });

  it("sem geometria (fora da janela) não desenha a barra", () => {
    g.semGeometria = new Set(["no:s1", "no:f1"]);
    montar();
    expect(screen.queryByTitle("Sapatas · Em andamento")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Estrutura · período pelos itens abaixo")).not.toBeInTheDocument();
  });

  it("período todo no passado: Hoje fica desabilitado", () => {
    const passada = arvore({ id: "p1", nome: "Antiga" }, { periodo: { inicio: "2020-01-01", fim: "2020-02-01" } });
    montar({ fases: [passada] });
    expect(screen.getByRole("button", { name: "Hoje" })).toBeDisabled();
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
