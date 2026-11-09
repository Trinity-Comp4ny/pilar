import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

vi.mock("@/components/ui/date-picker", () => ({
  DatePicker: ({ value, onChange, minDate }: { value?: string; onChange: (v: string) => void; minDate?: string }) => (
    <input
      data-testid="date-picker"
      data-min={minDate ?? ""}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

import { EMPTY_FILTERS, ProjetosFilterBar, type ProjetosFilters } from "./ProjetosFilterBar";

const pessoas = [
  { id: "p1", nome: "Ana Souza" },
  { id: "p2", nome: "Bruno Lima" },
];
const clientes = [{ id: "c1", nome: "Construtora Alfa" }];
const disciplinas = [{ id: "d1", nome: "Estrutural" }];

function Harness({ inicial = EMPTY_FILTERS, spy }: { inicial?: ProjetosFilters; spy: (f: ProjetosFilters) => void }) {
  const [filters, setFilters] = useState(inicial);
  return (
    <ProjetosFilterBar
      pessoas={pessoas}
      clientes={clientes}
      disciplinas={disciplinas}
      filters={filters}
      onChange={(f) => {
        spy(f);
        setFilters(f);
      }}
    />
  );
}

async function abrir() {
  const user = userEvent.setup();
  render(<Harness spy={spyGlobal} />);
  await user.click(screen.getByRole("button", { name: "Filtros" }));
  return user;
}

let spyGlobal = vi.fn();

describe("ProjetosFilterBar", () => {
  it("sem filtro não mostra o Limpar e o popover abre com as seções", async () => {
    spyGlobal = vi.fn();
    await abrir();
    expect(screen.queryByRole("button", { name: /Limpar \(/ })).not.toBeInTheDocument();
    expect(screen.getByText("Prioridade")).toBeInTheDocument();
    expect(screen.getByText("Status de prazo")).toBeInTheDocument();
  });

  it("alterna prioridade e status de prazo (liga e desliga)", async () => {
    spyGlobal = vi.fn();
    const user = await abrir();
    const alta = screen.getByRole("button", { name: /^Alta$/ });
    await user.click(alta);
    expect(spyGlobal).toHaveBeenLastCalledWith(expect.objectContaining({ prioridades: ["Alta"] }));
    await user.click(screen.getByRole("button", { name: /^Alta$/ }));
    expect(spyGlobal).toHaveBeenLastCalledWith(expect.objectContaining({ prioridades: [] }));

    await user.click(screen.getByRole("button", { name: "Atrasado" }));
    expect(spyGlobal).toHaveBeenLastCalledWith(expect.objectContaining({ deadlineStatus: ["em_atraso"] }));
    await user.click(screen.getByRole("button", { name: "No prazo" }));
    expect(spyGlobal).toHaveBeenLastCalledWith(expect.objectContaining({ deadlineStatus: ["em_atraso", "no_prazo"] }));
    await user.click(screen.getByRole("button", { name: "Atrasado" }));
    expect(spyGlobal).toHaveBeenLastCalledWith(expect.objectContaining({ deadlineStatus: ["no_prazo"] }));
  });

  it("seção recolhe e expande pelo título", async () => {
    spyGlobal = vi.fn();
    const user = await abrir();
    await user.click(screen.getByText("Prioridade"));
    expect(screen.queryByRole("button", { name: /^Alta$/ })).not.toBeInTheDocument();
    await user.click(screen.getByText("Prioridade"));
    expect(screen.getByRole("button", { name: /^Alta$/ })).toBeInTheDocument();
  });

  it("Equipe: busca, marca, desmarca e limpa", async () => {
    spyGlobal = vi.fn();
    const user = await abrir();
    await user.click(screen.getByText("Equipe"));
    const busca = screen.getByPlaceholderText("Buscar membro...");
    await user.type(busca, "zzz");
    expect(screen.getByText("Nenhum membro")).toBeInTheDocument();
    await user.clear(busca);
    await user.type(busca, "ana");
    expect(screen.queryByText("Bruno Lima")).not.toBeInTheDocument();
    await user.clear(busca);

    await user.click(within(screen.getByText("Ana Souza").closest("label")!).getByRole("checkbox"));
    expect(spyGlobal).toHaveBeenLastCalledWith(expect.objectContaining({ pessoaIds: ["p1"] }));
    await user.click(within(screen.getByText("Bruno Lima").closest("label")!).getByRole("checkbox"));
    await user.click(within(screen.getByText("Ana Souza").closest("label")!).getByRole("checkbox"));
    expect(spyGlobal).toHaveBeenLastCalledWith(expect.objectContaining({ pessoaIds: ["p2"] }));

    await user.click(screen.getByRole("button", { name: "Limpar equipe" }));
    expect(spyGlobal).toHaveBeenLastCalledWith(expect.objectContaining({ pessoaIds: [] }));
  });

  it("Cliente e Disciplina: marca, desmarca e limpa", async () => {
    spyGlobal = vi.fn();
    const user = await abrir();
    await user.click(screen.getByText("Cliente"));
    await user.click(within(screen.getByText("Construtora Alfa").closest("label")!).getByRole("checkbox"));
    expect(spyGlobal).toHaveBeenLastCalledWith(expect.objectContaining({ clienteIds: ["c1"] }));
    await user.click(within(screen.getByText("Construtora Alfa").closest("label")!).getByRole("checkbox"));
    expect(spyGlobal).toHaveBeenLastCalledWith(expect.objectContaining({ clienteIds: [] }));
    await user.click(within(screen.getByText("Construtora Alfa").closest("label")!).getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Limpar clientes" }));
    expect(spyGlobal).toHaveBeenLastCalledWith(expect.objectContaining({ clienteIds: [] }));

    await user.click(screen.getByText("Disciplina"));
    await user.click(within(screen.getByText("Estrutural").closest("label")!).getByRole("checkbox"));
    expect(spyGlobal).toHaveBeenLastCalledWith(expect.objectContaining({ disciplinaIds: ["d1"] }));
    await user.click(within(screen.getByText("Estrutural").closest("label")!).getByRole("checkbox"));
    expect(spyGlobal).toHaveBeenLastCalledWith(expect.objectContaining({ disciplinaIds: [] }));
    await user.click(within(screen.getByText("Estrutural").closest("label")!).getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Limpar disciplinas" }));
    expect(spyGlobal).toHaveBeenLastCalledWith(expect.objectContaining({ disciplinaIds: [] }));
  });

  it("Período: campo de data, intervalo, próximos 30d e limpar", async () => {
    spyGlobal = vi.fn();
    const user = await abrir();
    await user.click(screen.getByText("Período"));
    await user.click(screen.getByRole("button", { name: "Início" }));
    expect(spyGlobal).toHaveBeenLastCalledWith(expect.objectContaining({ dataCampo: "inicio" }));

    const [de, ate] = screen.getAllByTestId("date-picker");
    await user.type(de, "2026-01-01");
    expect(spyGlobal).toHaveBeenLastCalledWith(expect.objectContaining({ dataInicio: "2026-01-01" }));
    expect(screen.getAllByTestId("date-picker")[1]).toHaveAttribute("data-min", "2026-01-01");
    await user.type(ate, "2026-02-01");
    expect(spyGlobal).toHaveBeenLastCalledWith(expect.objectContaining({ dataFim: "2026-02-01" }));

    await user.click(screen.getByRole("button", { name: "Limpar" }));
    expect(spyGlobal).toHaveBeenLastCalledWith(expect.objectContaining({ dataInicio: "", dataFim: "" }));

    await user.click(screen.getByRole("button", { name: /Próximos 30d/ }));
    const ultimo = spyGlobal.mock.calls.at(-1)![0] as ProjetosFilters;
    expect(ultimo.dataInicio).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(ultimo.dataFim > ultimo.dataInicio).toBe(true);
  });

  it("Limpar tudo preserva a busca; Limpar da barra zera inclusive a busca", async () => {
    const spy = vi.fn();
    const user = userEvent.setup();
    render(
      <Harness
        spy={spy}
        inicial={{ ...EMPTY_FILTERS, search: "torre", prioridades: ["Alta"], dataInicio: "2026-01-01", dataFim: "x" }}
      />
    );
    expect(screen.getByRole("button", { name: /^Limpar\s*\(4\)/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Filtros" }));
    await user.click(screen.getByRole("button", { name: "Limpar tudo" }));
    expect(spy).toHaveBeenLastCalledWith({ ...EMPTY_FILTERS, search: "torre" });
    await user.click(screen.getByRole("button", { name: /^Limpar\s*\(1\)/ }));
    expect(spy).toHaveBeenLastCalledWith(EMPTY_FILTERS);
  });
});
