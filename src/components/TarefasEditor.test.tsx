import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TarefasEditor } from "./TarefasEditor";

describe("TarefasEditor", () => {
  it("renderiza uma linha por item existente", () => {
    render(
      <TarefasEditor
        value={[{ texto: "Visita ao terreno" }, { texto: "Briefing com cliente", duracao_dias_uteis: 2 }]}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByDisplayValue("Visita ao terreno")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Briefing com cliente")).toBeInTheDocument();
    expect(screen.getByLabelText("Dias úteis de Briefing com cliente")).toHaveValue(2);
  });

  it("Enter no campo de rascunho adiciona um item novo sem duração e limpa o campo", async () => {
    const onChange = vi.fn();
    render(<TarefasEditor value={[{ texto: "Item 1" }]} onChange={onChange} />);

    const draft = screen.getByPlaceholderText("Adicionar tarefa…");
    await userEvent.type(draft, "Item 2{Enter}");

    expect(onChange).toHaveBeenCalledWith([{ texto: "Item 1" }, { texto: "Item 2" }]);
  });

  it("não adiciona item vazio", async () => {
    const onChange = vi.fn();
    render(<TarefasEditor value={[]} onChange={onChange} />);

    const draft = screen.getByPlaceholderText("Adicionar tarefa…");
    await userEvent.type(draft, "   {Enter}");

    expect(onChange).not.toHaveBeenCalled();
  });

  it("botão remover tira o item da lista", async () => {
    const onChange = vi.fn();
    render(<TarefasEditor value={[{ texto: "Item 1" }, { texto: "Item 2" }]} onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Remover tarefa Item 1" }));

    expect(onChange).toHaveBeenCalledWith([{ texto: "Item 2" }]);
  });

  it("editar o texto de um item existente propaga a mudança preservando o resto", async () => {
    const onChange = vi.fn();
    render(<TarefasEditor value={[{ texto: "Item 1", duracao_dias_uteis: 3 }]} onChange={onChange} />);

    const input = screen.getByDisplayValue("Item 1");
    await userEvent.type(input, "!");

    expect(onChange).toHaveBeenLastCalledWith([{ texto: "Item 1!", duracao_dias_uteis: 3 }]);
  });

  it("preencher dias úteis de um item propaga só esse campo", async () => {
    const onChange = vi.fn();
    render(<TarefasEditor value={[{ texto: "Briefing" }]} onChange={onChange} />);

    const diasInput = screen.getByLabelText("Dias úteis de Briefing");
    await userEvent.type(diasInput, "2");

    expect(onChange).toHaveBeenLastCalledWith([{ texto: "Briefing", duracao_dias_uteis: 2 }]);
  });

  it("preencher horas estimadas nunca aparece como dias úteis", async () => {
    const onChange = vi.fn();
    render(<TarefasEditor value={[{ texto: "Ligação rápida" }]} onChange={onChange} />);

    const horasInput = screen.getByLabelText("Horas estimadas de Ligação rápida");
    await userEvent.type(horasInput, "2");

    expect(onChange).toHaveBeenLastCalledWith([{ texto: "Ligação rápida", horas_estimadas: 2 }]);
  });
});
