import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { DashboardVencimento } from "@/hooks/dashboard/types";
import { VencimentoRow } from "./VencimentoRow";

// Smoke test de render (spec #45): a linha de vencimento é 100% props (sem query).
const base: DashboardVencimento = {
  id: "1",
  tipo: "receita",
  descricao: "Parcela 1/3",
  valor: 1500,
  vencimento: "2026-08-20",
  diasRestantes: 3,
  status: "Pendente",
  projeto: "Projeto X",
  entidade: "Cliente Y",
};

describe("VencimentoRow", () => {
  it("receita: mostra entidade, valor com sinal '+' e dias restantes", () => {
    render(<VencimentoRow item={base} />);
    expect(screen.getByText("Cliente Y")).toBeInTheDocument();
    expect(screen.getByText(/^\+/)).toBeInTheDocument();
    expect(screen.getByText("3d")).toBeInTheDocument();
  });

  it("despesa vencendo hoje: valor com sinal '-' e rótulo 'Hoje'", () => {
    render(<VencimentoRow item={{ ...base, tipo: "despesa", diasRestantes: 0 }} />);
    expect(screen.getByText(/^-/)).toBeInTheDocument();
    expect(screen.getByText("Hoje")).toBeInTheDocument();
  });
});
