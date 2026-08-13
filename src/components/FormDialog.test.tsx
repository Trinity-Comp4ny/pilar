import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FormDialog } from "./FormDialog";

function setup(props: Partial<React.ComponentProps<typeof FormDialog>> = {}) {
  const onSubmit = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <FormDialog open onOpenChange={onOpenChange} title="Novo fornecedor" onSubmit={onSubmit} {...props}>
      <input aria-label="nome" />
    </FormDialog>
  );
  return { onSubmit, onOpenChange };
}

describe("FormDialog", () => {
  it("renderiza título e footer padrão", () => {
    setup();
    expect(screen.getByRole("heading", { name: "Novo fornecedor" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
  });

  it("dispara onSubmit ao enviar o formulário", () => {
    const { onSubmit } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("trava os botões quando isPending", () => {
    setup({ isPending: true });
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();
  });

  it("aceita rótulos e variante custom", () => {
    setup({ submitLabel: "Excluir", submitVariant: "destructive" });
    expect(screen.getByRole("button", { name: "Excluir" })).toBeInTheDocument();
  });
});
