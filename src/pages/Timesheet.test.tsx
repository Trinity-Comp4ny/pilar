import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TimesheetLancamento } from "@/hooks/useTimesheet";

// Timesheet (módulo dormente, ainda roteado): meus lançamentos com filtro de
// status e total de horas; aba Equipe para quem gere pessoas, com aprovar,
// rejeitar, reabrir e aprovar em lote, sempre após confirmação.

vi.mock("@/components/ui/select", async () => await import("./financeiro/testing/nativeSelect"));
vi.mock("@/hooks/usePageTitle", () => ({ usePageTitle: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/components/PageLayout", () => ({
  PageLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/PageHeader", () => ({
  PageHeader: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <header>
      <h1>{title}</h1>
      {children}
    </header>
  ),
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/components/LancarHorasDialog", () => ({
  LancarHorasDialog: ({ open }: { open: boolean }) => (open ? <div role="dialog">lancar-horas</div> : null),
}));
vi.mock("@/components/filters/FiltroPeriodo", () => ({
  FiltroPeriodo: ({ onChange }: { onChange: (from?: Date, to?: Date) => void }) => (
    <>
      <button type="button" onClick={() => onChange(new Date(2026, 0, 1), new Date(2026, 0, 31))}>
        periodo-janeiro
      </button>
      <button type="button" onClick={() => onChange(undefined, undefined)}>
        periodo-limpar
      </button>
    </>
  ),
}));

const estado = vi.hoisted(() => ({
  gerente: true,
  meus: [] as unknown[],
  equipe: [] as unknown[],
  loading: false,
  filtros: [] as Record<string, unknown>[],
  aprovar: vi.fn(),
  lote: vi.fn(),
  rejeitar: vi.fn(),
  reabrir: vi.fn(),
}));
vi.mock("@/hooks/useFeatureAccess", () => ({ useFeatureAccess: () => ({ canEdit: estado.gerente }) }));
vi.mock("@/hooks/useTimesheet", () => ({
  useTimesheetLancamentos: (f: Record<string, unknown>) => {
    estado.filtros.push(f);
    return { data: "userId" in f ? estado.meus : estado.equipe, isLoading: estado.loading };
  },
  useAprovarHoras: () => ({ mutate: estado.aprovar, isPending: false }),
  useAprovarHorasLote: () => ({ mutate: estado.lote, isPending: false }),
  useRejeitarHoras: () => ({ mutate: estado.rejeitar, isPending: false }),
  useReabrirHoras: () => ({ mutate: estado.reabrir, isPending: false }),
}));

import Timesheet from "./Timesheet";

const lanc = (p: Partial<TimesheetLancamento>) =>
  ({
    id: "t1",
    data: "2026-11-05",
    projeto_nome: "Torre A",
    fase_nome: null,
    user_nome: "Ana",
    descricao: "Detalhamento",
    horas: 2.5,
    status: "pendente",
    ...p,
  }) as TimesheetLancamento;

beforeEach(() => {
  vi.clearAllMocks();
  estado.gerente = true;
  estado.meus = [];
  estado.equipe = [];
  estado.loading = false;
  estado.filtros = [];
});

const ultimoFiltroMeus = () => estado.filtros.filter((f) => "userId" in f).at(-1);

describe("Timesheet: meus lançamentos", () => {
  it("vazio oferece lançar horas, pelo vazio ou pelo cabeçalho", () => {
    render(<Timesheet />);
    expect(screen.getByText("Nenhum lançamento encontrado")).toBeInTheDocument();
    const botoes = screen.getAllByRole("button", { name: /Lançar horas/ });
    fireEvent.click(botoes[botoes.length - 1]);
    expect(screen.getByRole("dialog")).toHaveTextContent("lancar-horas");
  });

  it("carregando mostra o esqueleto sem total", () => {
    estado.loading = true;
    estado.meus = [lanc({})];
    render(<Timesheet />);
    expect(screen.queryByText(/Total:/)).not.toBeInTheDocument();
    expect(screen.queryByText("Torre A")).not.toBeInTheDocument();
  });

  it("lista com data, fase, horas e status e soma o total; filtra por status e período", () => {
    estado.meus = [
      lanc({}),
      lanc({ id: "t2", fase_nome: "Executivo", horas: 1, status: "aprovado" }),
      lanc({ id: "t3", horas: 4, status: "rejeitado" }),
      lanc({ id: "t4", horas: 0.5, status: "outro" }),
    ];
    render(<Timesheet />);
    expect(screen.getByText("Total:")).toHaveTextContent("8.0h");
    expect(screen.getAllByText("05/11/2026")).toHaveLength(4);
    expect(screen.getByText("Executivo")).toBeInTheDocument();
    expect(screen.getByText("Aprovado", { selector: "div" })).toBeInTheDocument();
    expect(screen.getByText("Rejeitado", { selector: "div" })).toBeInTheDocument();
    expect(screen.getByText("outro")).toBeInTheDocument();
    expect(ultimoFiltroMeus()).toMatchObject({ userId: "u1", status: undefined });

    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "aprovado" } });
    expect(ultimoFiltroMeus()).toMatchObject({ status: "aprovado" });
    fireEvent.click(screen.getAllByRole("button", { name: "periodo-janeiro" })[0]);
    expect(ultimoFiltroMeus()).toMatchObject({ dataInicio: "2026-01-01", dataFim: "2026-01-31" });
    fireEvent.click(screen.getAllByRole("button", { name: "periodo-limpar" })[0]);
    expect(ultimoFiltroMeus()).toMatchObject({ dataInicio: undefined, dataFim: undefined });
  });

  it("quem não gere pessoas não vê a aba Equipe", () => {
    estado.gerente = false;
    render(<Timesheet />);
    expect(screen.queryByRole("tab", { name: "Equipe" })).not.toBeInTheDocument();
  });
});

describe("Timesheet: equipe", () => {
  async function abrirEquipe() {
    const user = userEvent.setup();
    render(<Timesheet />);
    await user.click(screen.getByRole("tab", { name: "Equipe" }));
    return user;
  }

  it("aprovar, rejeitar e reabrir pedem confirmação e chamam a ação certa", async () => {
    estado.equipe = [lanc({}), lanc({ id: "t2", projeto_nome: "Casa", status: "aprovado" })];
    const user = await abrirEquipe();
    expect(screen.getAllByText("Ana", { selector: "td" })).toHaveLength(2);
    expect(screen.getByText("1 pendente(s)")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Aprovar" }));
    let dlg = screen.getByRole("alertdialog");
    expect(within(dlg).getByText("Aprovar lançamento")).toBeInTheDocument();
    await user.click(within(dlg).getByRole("button", { name: "Aprovar" }));
    expect(estado.aprovar).toHaveBeenCalledWith("t1");

    await user.click(screen.getByRole("button", { name: "Rejeitar" }));
    dlg = screen.getByRole("alertdialog");
    await user.click(within(dlg).getByRole("button", { name: "Rejeitar" }));
    expect(estado.rejeitar).toHaveBeenCalledWith("t1");

    await user.click(screen.getByRole("button", { name: "Reabrir" }));
    dlg = screen.getByRole("alertdialog");
    expect(within(dlg).getByText("Reabrir lançamento")).toBeInTheDocument();
    await user.click(within(dlg).getByRole("button", { name: "Reabrir" }));
    expect(estado.reabrir).toHaveBeenCalledWith("t2");
  });

  it("aprovar em lote envia só os pendentes; cancelar não chama nada", async () => {
    estado.equipe = [lanc({}), lanc({ id: "t2" }), lanc({ id: "t3", status: "aprovado" })];
    const user = await abrirEquipe();
    await user.click(screen.getByRole("button", { name: "Aprovar pendentes (2)" }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancelar" }));
    expect(estado.lote).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Aprovar pendentes (2)" }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Aprovar todos" }));
    expect(estado.lote).toHaveBeenCalledWith(["t1", "t2"]);
  });

  it("filtro de status da equipe vai para a consulta da equipe", async () => {
    estado.equipe = [lanc({})];
    await abrirEquipe();
    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[selects.length - 1], { target: { value: "pendente" } });
    const equipe = estado.filtros.filter((f) => !("userId" in f)).at(-1);
    expect(equipe).toMatchObject({ status: "pendente" });
  });
});
