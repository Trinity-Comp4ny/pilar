import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FinanceErrorState } from "./FinanceErrorState";

// Smoke test de render (spec #45): o estado de erro do financeiro não pode virar
// "R$ 0,00" silencioso. Garante que a mensagem e o próximo passo aparecem.
describe("FinanceErrorState", () => {
  it("mostra a mensagem de falha e o botão de retry", () => {
    render(<FinanceErrorState onRetry={vi.fn()} />);
    expect(screen.getByText("Não foi possível carregar os dados financeiros")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
  });

  it("dispara onRetry ao clicar em 'Tentar de novo'", async () => {
    const onRetry = vi.fn();
    render(<FinanceErrorState onRetry={onRetry} />);
    await userEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
