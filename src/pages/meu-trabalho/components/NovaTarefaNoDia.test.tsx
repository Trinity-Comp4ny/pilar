import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NovaTarefaNoDia } from "./NovaTarefaNoDia";

const pessoas = [
  { id: "p1", nome: "Juliana Costa" },
  { id: "p2", nome: "Thiago Alves" },
];

function abrir(sobrescrever: Partial<React.ComponentProps<typeof NovaTarefaNoDia>> = {}) {
  const props = {
    rotuloDia: "18 de outubro",
    rotuloPrazo: "18 de out. de 2026",
    pessoas,
    projetos: [],
    minhaPessoaId: "p1",
    podeEscolherResponsavel: false,
    onCriar: vi.fn().mockResolvedValue(true),
    onMaisCampos: vi.fn(),
    onFechar: vi.fn(),
    ...sobrescrever,
  };
  render(<NovaTarefaNoDia {...props} />);
  return props;
}

const nome = () => screen.getByRole("textbox", { name: "Nome" });

// SPEC 140: criar tarefa pelo dia da Agenda (feedback da VRZ, 17/10).
describe("NovaTarefaNoDia", () => {
  it("mostra o dia e o prazo", () => {
    abrir();
    expect(screen.getByText("Nova tarefa em 18 de outubro")).toBeInTheDocument();
    expect(screen.getByText("Prazo: 18 de out. de 2026")).toBeInTheDocument();
  });

  it("sem nome, explica o erro e não grava", () => {
    const props = abrir();
    fireEvent.click(screen.getByRole("button", { name: "Criar tarefa" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Dê um nome à tarefa para criar.");
    expect(nome()).toHaveAttribute("aria-invalid", "true");
    expect(props.onCriar).not.toHaveBeenCalled();
    expect(props.onFechar).not.toHaveBeenCalled();
  });

  it("com nome, grava para quem criou e fecha", async () => {
    const props = abrir();
    fireEvent.change(nome(), { target: { value: "  Revisar armadura  " } });
    fireEvent.click(screen.getByRole("button", { name: "Criar tarefa" }));

    await waitFor(() => expect(props.onFechar).toHaveBeenCalledTimes(1));
    expect(props.onCriar).toHaveBeenCalledWith({ titulo: "Revisar armadura", responsavelId: "p1", projetoId: null });
  });

  it("se a gravação falha, não fecha e mantém o que foi digitado", async () => {
    const props = abrir({ onCriar: vi.fn().mockResolvedValue(false) });
    fireEvent.change(nome(), { target: { value: "Revisar armadura" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar tarefa" }));

    await waitFor(() => expect(props.onCriar).toHaveBeenCalledTimes(1));
    expect(props.onFechar).not.toHaveBeenCalled();
    expect(nome()).toHaveValue("Revisar armadura");
  });

  it("Mais campos leva o nome digitado para o formulário completo", () => {
    const props = abrir();
    fireEvent.change(nome(), { target: { value: " Revisar " } });
    fireEvent.click(screen.getByRole("button", { name: "Mais campos" }));
    expect(props.onMaisCampos).toHaveBeenCalledWith("Revisar");
  });

  it("quem não é admin não troca o responsável", () => {
    abrir({ podeEscolherResponsavel: false });
    expect(screen.getAllByRole("combobox")[0]).toBeDisabled();
  });

  it("admin troca o responsável", () => {
    abrir({ podeEscolherResponsavel: true });
    expect(screen.getAllByRole("combobox")[0]).toBeEnabled();
  });
});
