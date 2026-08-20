import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TarefasEditor } from "./TarefasEditor";

describe("TarefasEditor", () => {
  it("renderiza uma linha por item existente", () => {
    render(<TarefasEditor value={["Visita ao terreno", "Briefing com cliente"]} onChange={vi.fn()} />);
    expect(screen.getByDisplayValue("Visita ao terreno")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Briefing com cliente")).toBeInTheDocument();
  });

  it("Enter no campo de rascunho adiciona um item novo e limpa o campo", async () => {
    const onChange = vi.fn();
    render(<TarefasEditor value={["Item 1"]} onChange={onChange} />);

    const draft = screen.getByPlaceholderText("Adicionar tarefa…");
    await userEvent.type(draft, "Item 2{Enter}");

    expect(onChange).toHaveBeenCalledWith(["Item 1", "Item 2"]);
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
    render(<TarefasEditor value={["Item 1", "Item 2"]} onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Remover tarefa Item 1" }));

    expect(onChange).toHaveBeenCalledWith(["Item 2"]);
  });

  it("editar o texto de um item existente propaga a mudança", async () => {
    const onChange = vi.fn();
    render(<TarefasEditor value={["Item 1"]} onChange={onChange} />);

    const input = screen.getByDisplayValue("Item 1");
    await userEvent.type(input, "!");

    expect(onChange).toHaveBeenLastCalledWith(["Item 1!"]);
  });
});
