import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditColumnDialog } from "./EditColumnDialog";

const CORES = ["#ef4444", "#3b82f6"] as const;

function setup(cor = "#ef4444") {
  const onSave = vi.fn().mockResolvedValue(true);
  const onClose = vi.fn();
  render(
    <EditColumnDialog
      coluna={{ id: "e1", nome: "Em revisão", cor }}
      onClose={onClose}
      colors={CORES}
      onSave={onSave}
      isPending={false}
    />
  );
  return { onSave, onClose };
}

describe("EditColumnDialog", () => {
  it("salva nome e cor novos e fecha", async () => {
    const { onSave, onClose } = setup();
    const nome = screen.getByLabelText("Nome da coluna");
    await userEvent.clear(nome);
    await userEvent.type(nome, "Aprovado");
    await userEvent.click(screen.getByRole("radio", { name: "Cor #3b82f6" }));
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ id: "e1", nome: "Aprovado", cor: "#3b82f6" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("mostra a cor atual mesmo fora da paleta", () => {
    setup("#123456");
    expect(screen.getByRole("radio", { name: "Cor #123456" })).toHaveAttribute("aria-checked", "true");
  });

  it("bloqueia salvar com nome vazio", async () => {
    setup();
    await userEvent.clear(screen.getByLabelText("Nome da coluna"));
    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();
  });
});
