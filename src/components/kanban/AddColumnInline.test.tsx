import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddColumnInline } from "./AddColumnInline";

const CORES = ["#111111", "#222222"] as const;

describe("AddColumnInline", () => {
  it("abre, cria com Enter e fecha no sucesso", async () => {
    const onCreate = vi.fn().mockResolvedValue(true);
    const user = userEvent.setup();
    render(<AddColumnInline colors={CORES} onCreate={onCreate} busy={false} />);
    await user.click(screen.getByRole("button", { name: /Nova coluna/ }));
    await user.type(screen.getByPlaceholderText("Nome da coluna"), "Revisão{Enter}");
    expect(onCreate).toHaveBeenCalledWith("Revisão", "#111111", undefined);
    await waitFor(() => expect(screen.getByRole("button", { name: /Nova coluna/ })).toBeInTheDocument());
  });

  it("falha mantém o painel; Esc e Cancelar fecham", async () => {
    const onCreate = vi.fn().mockResolvedValue(false);
    const user = userEvent.setup();
    render(
      <AddColumnInline
        colors={CORES}
        onCreate={onCreate}
        busy={false}
        extraInitial="em_andamento"
        renderExtra={(v, set) => (
          <button type="button" onClick={() => set("concluido")}>
            extra:{v}
          </button>
        )}
      />
    );
    await user.click(screen.getByRole("button", { name: /Nova coluna/ }));
    expect(screen.getByRole("button", { name: "Adicionar" })).toBeDisabled();
    await user.type(screen.getByPlaceholderText("Nome da coluna"), "Fila");
    await user.click(screen.getByText("extra:em_andamento"));
    await user.click(screen.getByRole("button", { name: "Adicionar" }));
    expect(onCreate).toHaveBeenCalledWith("Fila", "#111111", "concluido");
    expect(screen.getByPlaceholderText("Nome da coluna")).toHaveValue("Fila");

    await user.click(screen.getByPlaceholderText("Nome da coluna"));
    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: /Nova coluna/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Nova coluna/ }));
    expect(screen.getByText("extra:em_andamento")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.getByRole("button", { name: /Nova coluna/ })).toBeInTheDocument();
  });

  it("ocupado ou nome vazio não cria", async () => {
    const onCreate = vi.fn();
    const user = userEvent.setup();
    render(<AddColumnInline colors={CORES} onCreate={onCreate} busy label="Novo grupo" />);
    await user.click(screen.getByRole("button", { name: /Novo grupo/ }));
    await user.type(screen.getByPlaceholderText("Nome da coluna"), "   {Enter}");
    await user.type(screen.getByPlaceholderText("Nome da coluna"), "x{Enter}");
    expect(onCreate).not.toHaveBeenCalled();
  });
});
