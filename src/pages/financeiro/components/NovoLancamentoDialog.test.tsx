import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NovoLancamentoDialog } from "./NovoLancamentoDialog";

// Seletor de tipo do "Novo lançamento".

describe("NovoLancamentoDialog", () => {
  it.each([
    ["Receita", "receita"],
    ["Despesa", "despesa"],
    ["Transferência", "transferencia"],
  ])("escolher %s fecha e informa o tipo", (rotulo, valor) => {
    const onOpenChange = vi.fn();
    const onEscolher = vi.fn();
    render(<NovoLancamentoDialog open onOpenChange={onOpenChange} onEscolher={onEscolher} />);
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${rotulo}`) }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onEscolher).toHaveBeenCalledWith(valor);
  });

  it("fechado não mostra as opções", () => {
    render(<NovoLancamentoDialog open={false} onOpenChange={vi.fn()} onEscolher={vi.fn()} />);
    expect(screen.queryByText("O que você quer registrar?")).not.toBeInTheDocument();
  });
});
