import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { DisciplinaResponsavel } from "@/types/projetos";

// Gantt das disciplinas do projeto. O motor de arraste (useGanttDrag) tem teste
// próprio e entra dublado: aqui se exercitam o guarda-chuva (constrain), o commit,
// o aviso de bloqueio, o rótulo flutuante do arraste e o resto da tela.

type Constrain = (a: { start: Date; end: Date; type: string }) => { start: Date; end: Date; snapping: boolean };
type Override = { key: number; start: Date; end: Date; type: "left" | "right" | "move"; snapping: boolean } | null;
const g = vi.hoisted(() => ({
  opts: null as null | {
    constrain: Constrain;
    onCommit: (k: number, p: { start: Date; end: Date }) => Promise<void>;
    onBlockedCommit: (k: number) => void;
    enabled: boolean;
  },
  override: null as Override,
  guideX: null as number | null,
  isSaving: false,
  isDragging: false,
  startDrag: vi.fn(),
  suprimir: false,
  mobile: false,
}));
vi.mock("@/components/gantt/useGanttDrag", () => ({
  useGanttDrag: (o: typeof g.opts) => {
    g.opts = o;
    return {
      override: g.override,
      guideX: g.guideX,
      isSaving: g.isSaving,
      isDragging: g.isDragging,
      startDrag: g.startDrag,
      getBarGeometry: (_k: number, base: { start: Date; end: Date } | null) =>
        base ? { ...base, leftPct: 10, widthPct: 30 } : null,
      guideDateLabel: () => "guia-data",
      shouldSuppressClick: () => g.suprimir,
    };
  },
}));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => g.mobile }));
const toast = vi.hoisted(() => ({ info: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
const scrollTo = vi.fn();
Element.prototype.scrollTo = scrollTo as never;

import { CronogramaTab } from "./CronogramaTab";

const iso = (dias: number) => {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const disc = (p: Partial<DisciplinaResponsavel>): DisciplinaResponsavel => ({
  disciplina: "D",
  responsavel_id: "",
  responsavel_nome: "",
  ...p,
});

const disciplinas = [
  disc({
    disciplina: "Arquitetura",
    data_inicio: iso(-20),
    data_previsao: iso(-5),
    status: "Em Andamento",
    responsavel_id: "p1",
    responsavel_nome: "Ana",
  }),
  disc({
    disciplina: "Estrutural",
    responsaveis: [
      { responsavel_id: "p2", responsavel_nome: "Bia", data_inicio: iso(-10), data_previsao: iso(40) },
      { responsavel_id: "p3", responsavel_nome: "Caio", data_inicio: iso(-15), data_final: iso(50) },
    ],
  }),
  disc({ disciplina: "Só início", data_inicio: iso(1) }),
  disc({ disciplina: "Hidráulica", data_inicio: iso(-3), data_final: iso(2), status: "Concluído" }),
  disc({ disciplina: "Sem datas" }),
  disc({ disciplina: "Também sem" }),
];

const props = (p: Partial<React.ComponentProps<typeof CronogramaTab>> = {}) => ({
  disciplinas,
  projetoDataInicio: iso(-30),
  projetoDataPrevisao: iso(30),
  onDatesChange: vi.fn().mockResolvedValue(undefined),
  onDisciplinaClick: vi.fn(),
  ...p,
});

beforeEach(() => {
  vi.clearAllMocks();
  g.override = null;
  g.guideX = null;
  g.isSaving = false;
  g.isDragging = false;
  g.suprimir = false;
  g.mobile = false;
});

describe("CronogramaTab", () => {
  it("sem disciplinas mostra o vazio", () => {
    render(<CronogramaTab disciplinas={[]} />);
    expect(screen.getByText("Nenhuma disciplina definida")).toBeInTheDocument();
  });

  it("monta linhas com responsáveis, atraso, marcadores e o aviso das sem datas", () => {
    render(<CronogramaTab {...props()} />);
    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(screen.getByText("Bia, Caio")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    expect(screen.getByText("INÍCIO")).toBeInTheDocument();
    expect(screen.getByText("HOJE")).toBeInTheDocument();
    expect(screen.getByText(/^PREV\. · /)).toBeInTheDocument();
    expect(scrollTo).toHaveBeenCalled();

    const aviso = screen.getByRole("button", { name: /2 disciplinas sem datas definidas/ });
    expect(screen.getAllByText("Sem datas")).toHaveLength(1);
    fireEvent.click(aviso);
    expect(screen.getAllByText("Sem datas")).toHaveLength(2);
    fireEvent.click(aviso);
    expect(screen.getAllByText("Sem datas")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Hoje" }));
    fireEvent.click(screen.getByRole("button", { name: /Semanas/ }));
    expect(screen.getByRole("button", { name: /Semanas/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("uma disciplina sem datas usa o singular; sem datas do projeto não há marcadores de projeto", () => {
    render(
      <CronogramaTab
        disciplinas={[
          disc({ disciplina: "A", data_inicio: "2020-01-01", data_previsao: "2020-02-01" }),
          disc({ disciplina: "B" }),
        ]}
      />
    );
    expect(screen.getByRole("button", { name: /^1 disciplina sem datas/ })).toBeInTheDocument();
    expect(screen.queryByText("INÍCIO")).not.toBeInTheDocument();
    expect(screen.queryByText("HOJE")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hoje" })).toBeDisabled();
  });

  it("clique na barra abre a disciplina, a não ser logo após arrastar", () => {
    const p = props();
    render(<CronogramaTab {...p} />);
    const barra = screen.getAllByText("Hidráulica").find((e) => e.className.includes("text-white"))!;
    fireEvent.click(barra);
    expect(p.onDisciplinaClick).toHaveBeenCalledWith(expect.objectContaining({ disciplina: "Hidráulica" }));
    g.suprimir = true;
    vi.mocked(p.onDisciplinaClick).mockClear();
    fireEvent.click(barra);
    expect(p.onDisciplinaClick).not.toHaveBeenCalled();
  });

  it("alças e corpo iniciam o arraste por mouse e por toque", () => {
    render(<CronogramaTab {...props()} />);
    const corpo = screen.getAllByText("Arquitetura").find((e) => e.className.includes("text-white"))!.parentElement!;
    const barra = corpo.parentElement!;
    const [esquerda, , direita] = Array.from(barra.children) as HTMLElement[];
    fireEvent.mouseDown(corpo, { clientX: 100 });
    expect(g.startDrag).toHaveBeenLastCalledWith(100, 0, "move", expect.anything());
    fireEvent.touchStart(corpo, { touches: [{ clientX: 50 }] });
    expect(g.startDrag).toHaveBeenLastCalledWith(50, 0, "move", expect.anything());
    fireEvent.mouseDown(esquerda, { clientX: 10 });
    expect(g.startDrag).toHaveBeenLastCalledWith(10, 0, "left", expect.anything());
    fireEvent.touchStart(esquerda, { touches: [{ clientX: 11 }] });
    expect(g.startDrag).toHaveBeenLastCalledWith(11, 0, "left", expect.anything());
    fireEvent.mouseDown(direita, { clientX: 20 });
    expect(g.startDrag).toHaveBeenLastCalledWith(20, 0, "right", expect.anything());
    fireEvent.touchStart(direita, { touches: [{ clientX: 21 }] });
    expect(g.startDrag).toHaveBeenLastCalledWith(21, 0, "right", expect.anything());
  });

  it("sem onDatesChange não arrasta e a disciplina só abre pelo clique", () => {
    render(<CronogramaTab {...props({ onDatesChange: undefined })} />);
    expect(g.opts!.enabled).toBe(false);
    const corpo = screen.getAllByText("Arquitetura").find((e) => e.className.includes("text-white"))!.parentElement!;
    fireEvent.mouseDown(corpo, { clientX: 1 });
    expect(g.startDrag).not.toHaveBeenCalled();
    expect(corpo.className).toContain("cursor-pointer");
  });
});

describe("CronogramaTab: regras do arraste", () => {
  it("constrain segura o início no do projeto (mover leva o fim junto) e marca snapping", () => {
    render(<CronogramaTab {...props({ projetoDataInicio: "2026-03-10" })} />);
    const c = g.opts!.constrain;
    const d = (s: string) => new Date(`${s}T00:00:00`);

    const livre = c({ start: d("2026-03-12"), end: d("2026-03-20"), type: "move" });
    expect(livre.snapping).toBe(false);

    const movido = c({ start: d("2026-03-05"), end: d("2026-03-15"), type: "move" });
    expect(movido).toEqual({ start: d("2026-03-10"), end: d("2026-03-20"), snapping: true });

    const esquerda = c({ start: d("2026-03-01"), end: d("2026-03-15"), type: "left" });
    expect(esquerda).toEqual({ start: d("2026-03-10"), end: d("2026-03-15"), snapping: true });

    const invertido = c({ start: d("2026-03-01"), end: d("2026-03-05"), type: "left" });
    expect(invertido.start).toEqual(d("2026-03-10"));
    expect(invertido.end > invertido.start).toBe(true);
  });

  it("sem início do projeto o constrain não mexe", () => {
    render(<CronogramaTab {...props({ projetoDataInicio: undefined })} />);
    const s = new Date(2026, 2, 5);
    const e = new Date(2026, 2, 1);
    expect(g.opts!.constrain({ start: s, end: e, type: "left" })).toEqual({ start: s, end: e, snapping: false });
  });

  it("commit grava início e previsão; bloqueio avisa com o nome da disciplina", async () => {
    const p = props();
    render(<CronogramaTab {...p} />);
    await act(() => g.opts!.onCommit(1, { start: new Date(2026, 2, 2), end: new Date(2026, 2, 9) }));
    expect(p.onDatesChange).toHaveBeenCalledWith(1, { data_inicio: "2026-03-02", data_previsao: "2026-03-09" });
    g.opts!.onBlockedCommit(0);
    expect(toast.info).toHaveBeenCalledWith('"Arquitetura" não pode começar antes do projeto', expect.anything());
    g.opts!.onBlockedCommit(99);
    expect(toast.info).toHaveBeenCalledWith("Disciplina não pode começar antes do projeto", expect.anything());
  });

  it("commit sem onDatesChange é ignorado", async () => {
    render(<CronogramaTab {...props({ onDatesChange: undefined })} />);
    await act(() => g.opts!.onCommit(0, { start: new Date(), end: new Date() }));
  });

  it("rótulo flutuante: mover, início (antes do projeto) e previsão além do prazo", () => {
    g.isSaving = true;
    g.isDragging = true;
    g.guideX = 120;
    g.override = { key: 0, start: new Date(), end: new Date(), type: "move", snapping: false };
    const { rerender } = render(<CronogramaTab {...props()} />);
    expect(screen.getByText("Salvando...")).toBeInTheDocument();
    expect(screen.getByText("Esc para cancelar")).toBeInTheDocument();
    expect(screen.getByText("guia-data")).toBeInTheDocument();
    expect(screen.getByText(/→ .* · \d+d/)).toBeInTheDocument();

    g.override = { key: 0, start: new Date(), end: new Date(), type: "left", snapping: true };
    rerender(<CronogramaTab {...props()} />);
    expect(screen.getByText(/^Início: /)).toBeInTheDocument();
    expect(screen.getByText("· antes do início do projeto")).toBeInTheDocument();

    g.override = { key: 1, start: new Date(), end: new Date(2099, 0, 1), type: "right", snapping: false };
    rerender(<CronogramaTab {...props()} />);
    expect(screen.getByText(/^Previsão: /)).toBeInTheDocument();
    expect(screen.getByText("· além da previsão")).toBeInTheDocument();
  });

  it("mobile esconde os responsáveis da coluna fixa", () => {
    g.mobile = true;
    render(<CronogramaTab {...props()} />);
    expect(screen.queryByText("Bia, Caio")).not.toBeInTheDocument();
  });
});
