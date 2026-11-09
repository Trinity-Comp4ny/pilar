import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CarteiraOverview } from "./CarteiraOverview";
import type { Fatura } from "../hooks/useFaturas";
import type { ContaItem } from "../hooks/useContasCartoes";

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

// Resumo com dados: saldo somado, total a pagar (restante), vencimento relativo
// e "Pagar" só em fatura pagável, sem abrir o detalhe junto.
describe("CarteiraOverview com faturas", () => {
  const fatura = (p: Partial<Fatura>): Fatura => ({
    id: "f",
    cartao_id: "k1",
    cartao_nome: "Visa Empresa",
    cartao_cor: "#123456",
    mes_referencia: 10,
    ano_referencia: 2026,
    data_inicio: "2026-09-06",
    data_fim: "2026-10-05",
    data_vencimento: "2026-10-15",
    status: "Fechada",
    data_pagamento: null,
    conta_pagamento_id: null,
    conta_pagamento_nome: null,
    valor_total: 1000,
    valor_pago: 0,
    qtd_despesas: 3,
    ...p,
  });
  const contas = [{ saldo_atual: 1500 }, { saldo_atual: null }] as unknown as ContaItem[];

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 15, 10));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("soma saldo e restante das faturas, com plural/singular", () => {
    render(
      <CarteiraOverview
        contas={contas}
        faturas={[fatura({ id: "a", valor_pago: 400 })]}
        onDetalhe={vi.fn()}
        onPagar={vi.fn()}
      />
    );
    expect(screen.getByText("2 contas")).toBeInTheDocument();
    expect(screen.getByText("1 fatura em aberto")).toBeInTheDocument();
    expect(screen.getAllByText(/R\$\s?600,00/).length).toBeGreaterThan(0);
    expect(screen.getByText(/R\$\s?1\.500,00/)).toBeInTheDocument();
  });

  it("vencimento relativo e Pagar só na fatura pagável", () => {
    const onPagar = vi.fn();
    const onDetalhe = vi.fn();
    render(
      <CarteiraOverview
        contas={[]}
        faturas={[
          fatura({ id: "hoje" }),
          fatura({ id: "aberta", status: "Aberta", data_vencimento: "2026-10-20", cartao_nome: "Master" }),
        ]}
        onDetalhe={onDetalhe}
        onPagar={onPagar}
      />
    );
    expect(screen.getByText("vence hoje").className).toMatch(/danger/);
    expect(screen.getByText("vence em 5d")).toBeInTheDocument();
    const pagar = screen.getAllByRole("button", { name: /^Pagar$/ });
    expect(pagar).toHaveLength(1);
    fireEvent.click(pagar[0]);
    expect(onPagar).toHaveBeenCalledWith(expect.objectContaining({ id: "hoje" }));
    expect(onDetalhe).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Master"));
    expect(onDetalhe).toHaveBeenCalledWith(expect.objectContaining({ id: "aberta" }));
  });
});
