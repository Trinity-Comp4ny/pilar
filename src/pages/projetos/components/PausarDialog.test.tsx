import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PausarDialog } from "./PausarDialog";

function setup(props: Partial<React.ComponentProps<typeof PausarDialog>> = {}) {
  const onConfirmar = vi.fn();
  render(
    <PausarDialog
      open
      onOpenChange={vi.fn()}
      title="Pausar projeto"
      description="Os prazos ficam congelados até você retomar."
      isPending={false}
      onConfirmar={onConfirmar}
      {...props}
    />
  );
  return { onConfirmar };
}

describe("PausarDialog", () => {
  it("não deixa pausar sem motivo", () => {
    setup();
    expect(screen.getByRole("button", { name: "Pausar projeto" })).toBeDisabled();
  });

  it("motivo só com espaços também não vale", () => {
    setup();
    fireEvent.change(screen.getByLabelText("Motivo da pausa"), { target: { value: "   " } });
    expect(screen.getByRole("button", { name: "Pausar projeto" })).toBeDisabled();
  });

  it("confirma com o motivo aparado", () => {
    const { onConfirmar } = setup();
    fireEvent.change(screen.getByLabelText("Motivo da pausa"), { target: { value: "  Cliente suspendeu a obra  " } });
    fireEvent.click(screen.getByRole("button", { name: "Pausar projeto" }));
    expect(onConfirmar).toHaveBeenCalledWith("Cliente suspendeu a obra");
  });

  it("mostra o aviso do que a pausa faz", () => {
    setup({ aviso: "3 disciplinas abertas serão pausadas. As concluídas não mudam." });
    expect(screen.getByText(/3 disciplinas abertas serão pausadas/)).toBeInTheDocument();
  });
});
