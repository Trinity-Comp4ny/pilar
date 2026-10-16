import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AtividadeComposer } from "./AtividadeComposer";

// SPEC 131: marcação confiável e @all no composer das Atividades.

vi.mock("../hooks/usePessoasSemConta", () => ({
  usePessoasSemConta: () => new Set(["p3"]),
}));

const pessoas = [
  { id: "p1", nome: "Maria Silva" },
  { id: "p2", nome: "Maria" },
  { id: "p3", nome: "Carlos Sem Conta" },
];

function digitar(texto: string) {
  const caixa = screen.getByPlaceholderText("Escrever um comentário...") as HTMLTextAreaElement;
  fireEvent.change(caixa, { target: { value: texto, selectionStart: texto.length, selectionEnd: texto.length } });
  return caixa;
}

describe("AtividadeComposer, marcação", () => {
  it("nome digitado inteiro, sem usar o menu, entra em mencionados ao enviar", () => {
    const onSubmit = vi.fn();
    render(<AtividadeComposer pessoas={pessoas} onSubmit={onSubmit} />);

    const caixa = digitar("@Maria Silva pode revisar?");
    fireEvent.keyDown(caixa, { key: "Enter" });

    expect(onSubmit).toHaveBeenCalledWith("@Maria Silva pode revisar?", ["p1"]);
  });

  it("o menu continua aberto enquanto o texto é começo de um nome com sobrenome", () => {
    render(<AtividadeComposer pessoas={pessoas} onSubmit={vi.fn()} />);

    digitar("@Maria S");
    expect(screen.getByRole("button", { name: "Maria Silva" })).toBeInTheDocument();
  });

  it("o menu fecha quando o que vem depois do espaço não é nome", () => {
    render(<AtividadeComposer pessoas={pessoas} onSubmit={vi.fn()} />);

    digitar("@Maria e");
    expect(screen.queryByRole("button", { name: "Maria Silva" })).not.toBeInTheDocument();
  });

  it("oferece @all primeiro e insere o token no texto, sem id de pessoa", () => {
    const onSubmit = vi.fn();
    render(<AtividadeComposer pessoas={pessoas} onSubmit={onSubmit} />);

    const caixa = digitar("@a");
    fireEvent.click(screen.getByRole("button", { name: /@all/ }));
    expect(caixa).toHaveValue("@all ");

    fireEvent.change(caixa, { target: { value: "@all reunião às 9h", selectionStart: 18, selectionEnd: 18 } });
    fireEvent.keyDown(caixa, { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledWith("@all reunião às 9h", []);
  });

  it("avisa quando marca alguém sem conta e some o aviso ao tirar a marcação", () => {
    render(<AtividadeComposer pessoas={pessoas} onSubmit={vi.fn()} />);

    digitar("@Carlos Sem Conta olha isso");
    expect(screen.getByRole("status")).toHaveTextContent("Carlos Sem Conta não tem conta e não recebe o aviso.");

    digitar("olha isso");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("mostra 'sem acesso' no menu para quem não tem conta", () => {
    render(<AtividadeComposer pessoas={pessoas} onSubmit={vi.fn()} />);

    digitar("@Carlos");
    expect(screen.getByRole("button", { name: /Carlos Sem Conta/ })).toHaveTextContent("sem acesso");
  });
});
