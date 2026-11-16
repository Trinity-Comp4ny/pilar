import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { RelatorioOrcadoRealizado, type LinhaDoRelatorio } from "./RelatorioOrcadoRealizado";

const linha = (
  id: string,
  parent_id: string | null,
  nivel: string,
  nome: string,
  previsto: number,
  realizado: number
): LinhaDoRelatorio => ({
  id,
  parent_id,
  nivel,
  nome,
  ordem: 0,
  previsto,
  realizado,
});

const linhas = [
  linha("f", null, "fase", "Estrutura", 0, 0),
  // O realizado de cada linha é só o que foi lançado nela: a etapa soma o do serviço.
  linha("e", "f", "etapa", "Fundação", 1000, 0),
  linha("s", "e", "servico", "Sapatas", 0, 1200),
];

describe("RelatorioOrcadoRealizado", () => {
  it("mostra a árvore com orçado, realizado e saldo, somando de baixo para cima", () => {
    render(<RelatorioOrcadoRealizado linhas={linhas} />);
    const fase = screen.getByText("Estrutura").closest("div")!;
    // A fase não tem valor próprio: soma a etapa dela (R$ 1.000 orçados, R$ 1.200 gastos, saldo negativo).
    expect(within(fase).getByText(/1\.000,00/)).toBeInTheDocument();
    expect(within(fase).getAllByText(/1\.200,00/).length).toBeGreaterThan(0);
    expect(screen.getByText("Total da obra")).toBeInTheDocument();
  });

  it("despesa sem item do cronograma aparece numa linha própria e entra no total", () => {
    render(<RelatorioOrcadoRealizado linhas={linhas} semFrente={300} />);
    expect(screen.getByText("Sem item do cronograma")).toBeInTheDocument();
    const total = screen.getByText("Total da obra").closest("div")!;
    expect(within(total).getByText(/1\.500,00/)).toBeInTheDocument();
  });

  it("obra sem itens avisa em vez de mostrar tabela vazia", () => {
    render(<RelatorioOrcadoRealizado linhas={[]} />);
    expect(screen.getByText("O cronograma desta obra ainda não tem itens.")).toBeInTheDocument();
  });

  it("não tem campo de edição: é só leitura", () => {
    render(<RelatorioOrcadoRealizado linhas={linhas} />);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  });
});
