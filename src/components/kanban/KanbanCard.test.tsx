import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { KanbanCard } from "./KanbanCard";

describe("KanbanCard", () => {
  it("mostra título e apoio, sem cabeçalho quando não há eyebrow, tag nem menu", () => {
    const { container } = render(<KanbanCard title="Organizar planilha" subtitle="Cliente X" />);
    expect(screen.getByText("Organizar planilha")).toBeInTheDocument();
    expect(screen.getByText("Cliente X")).toBeInTheDocument();
    expect(container.querySelector(".min-h-5")).toBeNull();
  });

  it("não exibe número de identificação: só o que a tela passa", () => {
    render(<KanbanCard title="Teste" tag="Tarefa" />);
    expect(screen.getByText("Tarefa")).toBeInTheDocument();
    expect(screen.queryByText(/^#\d+/)).not.toBeInTheDocument();
  });

  it("clicar no título abre uma vez só; o card inteiro também abre", () => {
    const onClick = vi.fn();
    const { container } = render(<KanbanCard title="Teste" onClick={onClick} />);
    fireEvent.click(screen.getByRole("button", { name: "Teste" }));
    expect(onClick).toHaveBeenCalledTimes(1);
    fireEvent.click(container.firstElementChild as Element);
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("usa o mesmo raio e padding em todo card", () => {
    const { container } = render(<KanbanCard title="Teste" />);
    expect(container.firstElementChild).toHaveClass("rounded-lg", "p-3", "gap-2");
  });

  it("o menu de ações tem rótulo e não dispara o clique do card", () => {
    const onClick = vi.fn();
    render(<KanbanCard title="Teste" onClick={onClick} menu={<span>Editar</span>} />);
    const gatilho = screen.getByRole("button", { name: "Mais opções" });
    fireEvent.click(gatilho);
    expect(onClick).not.toHaveBeenCalled();
  });
});
