import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const mutate = vi.fn();
vi.mock("../hooks/useConfigComercial", async (orig) => ({
  ...(await orig<typeof import("../hooks/useConfigComercial")>()),
  useSalvarConfigComercial: () => ({ mutate, isPending: false }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { CONFIG_COMERCIAL_PADRAO } from "../hooks/useConfigComercial";
import { MeiosRecebimentoDialog } from "./MeiosRecebimentoDialog";

const abrir = (onOpenChange = vi.fn()) => {
  render(<MeiosRecebimentoDialog open onOpenChange={onOpenChange} config={CONFIG_COMERCIAL_PADRAO} />);
  return onOpenChange;
};

beforeEach(() => mutate.mockReset());

describe("MeiosRecebimentoDialog", () => {
  it("lista os meios cadastrados", () => {
    abrir();
    expect(screen.getAllByTestId("meio-recebimento")).toHaveLength(3);
  });

  it("salva a taxa editada mantendo o resto da configuração", async () => {
    const onOpenChange = abrir();
    const campos = screen.getAllByRole("textbox");
    fireEvent.change(campos[1], { target: { value: "1,5" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(mutate).toHaveBeenCalled());
    const [config, opts] = mutate.mock.calls[0];
    expect(config.margemAlvoPct).toBe(30);
    expect(config.meiosRecebimento[0].taxa_pct).toBe(1.5);
    opts.onSuccess();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("adiciona e remove meio, e barra nome vazio", async () => {
    abrir();
    fireEvent.click(screen.getByRole("button", { name: /Adicionar meio/ }));
    expect(screen.getAllByTestId("meio-recebimento")).toHaveLength(4);
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/nome/);
    expect(mutate).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole("button", { name: /Remover meio/ })[0]);
    expect(screen.getAllByTestId("meio-recebimento")).toHaveLength(3);
  });

  it("cria e remove faixa por parcelas", () => {
    abrir();
    const faixas = () => screen.queryAllByRole("button", { name: "Remover faixa" }).length;
    const antes = faixas();
    fireEvent.click(screen.getAllByRole("button", { name: /Taxa por número de parcelas/ })[0]);
    expect(faixas()).toBe(antes + 1);
    fireEvent.click(screen.getAllByRole("button", { name: "Remover faixa" })[0]);
    expect(faixas()).toBe(antes);
  });

  it("erro ao salvar mostra aviso", () => {
    abrir();
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    mutate.mock.calls[0][1].onError();
  });
});
