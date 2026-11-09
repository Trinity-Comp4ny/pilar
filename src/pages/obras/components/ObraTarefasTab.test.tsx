import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Plus } from "lucide-react";
import type { ComponentType } from "react";
import type { MolduraTarefasProps } from "@/pages/meu-trabalho/TarefasWorkspace";

type Obra = { id: string; servicos: { id: string; caminho: string }[]; aoMontarCronograma: () => void };
const h = vi.hoisted(() => ({
  nos: undefined as unknown[] | undefined,
  ultimo: null as null | { moldura: unknown; obra: unknown },
  search: undefined as MolduraTarefasProps["search"],
  acao: undefined as MolduraTarefasProps["primaryAction"],
}));

vi.mock("@/pages/obras/hooks/useObraFrentes", () => ({ useObraFrentes: () => ({ data: h.nos }) }));
vi.mock("@/pages/meu-trabalho/TarefasWorkspace", () => ({
  TarefasWorkspace: ({ moldura: Moldura, obra }: { moldura: ComponentType<MolduraTarefasProps>; obra: Obra }) => {
    h.ultimo = { moldura: Moldura, obra };
    return (
      <Moldura toolbar={<div role="toolbar">barra</div>} search={h.search} primaryAction={h.acao}>
        <p>conteudo</p>
      </Moldura>
    );
  },
}));

import { ObraTarefasTab } from "./ObraTarefasTab";

beforeEach(() => {
  h.nos = undefined;
  h.ultimo = null;
  h.search = undefined;
  h.acao = undefined;
});

describe("ObraTarefasTab", () => {
  it("passa só os serviços, com o caminho completo e em ordem alfabética", () => {
    h.nos = [
      { id: "f1", parent_id: null, nome: "Torre A", nivel: "frente" },
      { id: "s2", parent_id: "f1", nome: "Pintura", nivel: "servico" },
      { id: "s1", parent_id: "f1", nome: "Alvenaria", nivel: "servico" },
    ];
    const monta = vi.fn();
    render(<ObraTarefasTab obraId="o1" aoMontarCronograma={monta} />);
    const obra = h.ultimo!.obra as Obra;
    expect(obra.id).toBe("o1");
    expect(obra.servicos).toEqual([
      { id: "s1", caminho: "Torre A › Alvenaria" },
      { id: "s2", caminho: "Torre A › Pintura" },
    ]);
    expect(obra.aoMontarCronograma).toBe(monta);
    // Sem busca nem ação, a moldura mostra só a toolbar e o conteúdo.
    expect(screen.getByRole("toolbar")).toBeInTheDocument();
    expect(screen.getByText("conteudo")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("sem frentes carregadas manda lista vazia", () => {
    render(<ObraTarefasTab obraId="o1" aoMontarCronograma={vi.fn()} />);
    expect((h.ultimo!.obra as Obra).servicos).toEqual([]);
  });

  it("moldura desenha busca (com placeholder padrão) e ação principal", () => {
    const onChange = vi.fn();
    const onClick = vi.fn();
    h.search = { value: "", onChange };
    h.acao = { label: "Nova tarefa", icon: Plus, onClick };
    render(<ObraTarefasTab obraId="o1" aoMontarCronograma={vi.fn()} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Buscar" }), { target: { value: "laje" } });
    expect(onChange).toHaveBeenCalledWith("laje");
    fireEvent.click(screen.getByRole("button", { name: "Nova tarefa" }));
    expect(onClick).toHaveBeenCalled();
  });

  it("moldura usa o placeholder informado", () => {
    h.search = { value: "x", onChange: vi.fn(), placeholder: "Buscar tarefa" };
    render(<ObraTarefasTab obraId="o1" aoMontarCronograma={vi.fn()} />);
    expect(screen.getByPlaceholderText("Buscar tarefa")).toHaveValue("x");
  });
});
