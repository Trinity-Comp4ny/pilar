import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const h = vi.hoisted(() => ({
  disponivel: true,
  lista: vi.fn(),
  apagar: vi.fn(),
  cadastrar: vi.fn(),
  success: vi.fn(),
}));

vi.mock("@/lib/passkey", () => ({ passkeyDisponivel: () => h.disponivel, cadastrarPasskey: h.cadastrar }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { passkey: { list: h.lista, delete: h.apagar } } },
}));
vi.mock("sonner", () => ({ toast: { success: h.success, error: vi.fn() } }));

import { PasskeysConta } from "./PasskeysConta";

const montar = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <PasskeysConta />
    </QueryClientProvider>
  );

describe("PasskeysConta", () => {
  beforeEach(() => {
    h.disponivel = true;
    h.lista.mockReset().mockResolvedValue({
      data: [{ id: "p1", friendly_name: "iPhone", created_at: "2026-11-01T10:00:00Z" }],
      error: null,
    });
    h.apagar.mockReset().mockResolvedValue({ error: null });
    h.cadastrar.mockReset();
    h.success.mockReset();
  });

  it("não renderiza onde passkey não está disponível", () => {
    h.disponivel = false;
    const { container } = montar();
    expect(container).toBeEmptyDOMElement();
    expect(h.lista).not.toHaveBeenCalled();
  });

  it("lista os aparelhos cadastrados", async () => {
    montar();
    expect(await screen.findByText("iPhone")).toBeInTheDocument();
  });

  it("ativa neste aparelho e avisa", async () => {
    h.cadastrar.mockResolvedValue({ ok: true });
    montar();
    await userEvent.click(await screen.findByRole("button", { name: /ativar neste aparelho/i }));
    await waitFor(() => expect(h.success).toHaveBeenCalledWith("Biometria ativada neste aparelho"));
  });

  it("cancelar o prompt não mostra aviso", async () => {
    h.cadastrar.mockResolvedValue({ ok: false, cancelado: true, mensagem: "x" });
    montar();
    await userEvent.click(await screen.findByRole("button", { name: /ativar neste aparelho/i }));
    await waitFor(() => expect(h.cadastrar).toHaveBeenCalled());
    expect(h.success).not.toHaveBeenCalled();
  });

  it("remove depois de confirmar", async () => {
    montar();
    await userEvent.click(await screen.findByRole("button", { name: "Remover" }));
    await userEvent.click(
      await screen
        .findByRole("button", { name: "Remover", hidden: false })
        .then(() => screen.getAllByRole("button", { name: "Remover" }).at(-1) as HTMLElement)
    );
    await waitFor(() => expect(h.apagar).toHaveBeenCalledWith({ passkeyId: "p1" }));
  });
});
