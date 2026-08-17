import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CarteiraOverview } from "./CarteiraOverview";

// Smoke test de render (spec #45): visão da carteira é prop-driven. Com listas vazias
// deve cair no estado "tudo em dia" sem quebrar. É o empty state honesto.
describe("CarteiraOverview", () => {
  it("com contas e faturas vazias mostra o resumo e o empty state", () => {
    render(<CarteiraOverview contas={[]} faturas={[]} onDetalhe={vi.fn()} onPagar={vi.fn()} />);
    expect(screen.getByText("Saldo em contas")).toBeInTheDocument();
    expect(screen.getByText("Nenhuma fatura em aberto. Tudo em dia.")).toBeInTheDocument();
    // Sem faturas, não há botão "Pagar".
    expect(screen.queryByRole("button", { name: /Pagar/ })).not.toBeInTheDocument();
  });
});
