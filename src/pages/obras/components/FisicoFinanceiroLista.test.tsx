import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { FisicoFinanceiroLista } from "./FisicoFinanceiroLista";
import { colunasDaEscala, montarFisicoFinanceiro } from "@/pages/obras/lib/fisicoFinanceiro";
import { montarOrcadoRealizado, type NoFinanceiro } from "@/pages/obras/lib/orcadoRealizado";

vi.mock("@/hooks/useMoneyMask", () => ({ useMoneyMask: () => (v: number) => `R$ ${v}` }));

const no = (id: string, parent_id: string | null, nivel: string): NoFinanceiro => ({
  id, parent_id, nivel, nome: id.toUpperCase(), ordem: 0, created_at: "2026-01-01",
});

describe("FisicoFinanceiroLista", () => {
  const nos = [no("f1", null, "fase"), no("e1", "f1", "etapa"), no("s1", "e1", "servico")];
  const orcado = montarOrcadoRealizado(nos, new Map([["s1", 1000]]), {});
  const ff = montarFisicoFinanceiro(orcado.raizes, new Map([["s1", { inicio: "2026-01-01", fim: "2026-02-28" }]]), new Map());
  const colunas = colunasDaEscala(ff.meses, "mensal");

  it("um cartão por mês com total, acumulado e só as fases; abrir mostra as etapas", () => {
    render(<FisicoFinanceiroLista ff={ff} colunas={colunas} />);
    const jan = screen.getByTestId(`ffl-${colunas[0].chave}`);
    expect(within(jan).getByText(/Acumulado/)).toBeInTheDocument();
    expect(within(jan).getByText("F1")).toBeInTheDocument();
    expect(within(jan).queryByText("E1")).not.toBeInTheDocument();
    fireEvent.click(within(jan).getByRole("button"));
    expect(within(jan).getByText("E1")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").length).toBeGreaterThanOrEqual(2);
  });
});
