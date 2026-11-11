import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AvisosLegais } from "./AvisosLegais";

/**
 * Aviso legal aos administradores (Termos v2, cláusula 15): o ultra admin confere quantos
 * recebem antes de mandar, e o envio só sai depois da confirmação.
 */

const { invoke, toastSucesso } = vi.hoisted(() => ({
  invoke: vi.fn(),
  toastSucesso: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke } } }));
vi.mock("sonner", () => ({ toast: { success: toastSucesso, error: vi.fn() } }));

function renderizar() {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AvisosLegais />
    </QueryClientProvider>
  );
}

describe("AvisosLegais", () => {
  beforeEach(() => {
    invoke.mockReset();
    toastSucesso.mockReset();
  });

  it("não deixa enviar antes de conferir", () => {
    renderizar();
    expect(screen.getByRole("button", { name: "Enviar" })).toBeDisabled();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("conferir mostra quantos recebem e o envio sai só depois de confirmar", async () => {
    const user = userEvent.setup();
    invoke
      .mockResolvedValueOnce({ data: { aviso: "x", administradores: 12, ja_receberam: 2, pendentes: 10 }, error: null })
      .mockResolvedValueOnce({
        data: { aviso: "x", administradores: 12, ja_receberam: 2, enviados: 10, falhas: 0 },
        error: null,
      });

    renderizar();
    await user.click(screen.getByRole("button", { name: "Conferir" }));

    expect(invoke).toHaveBeenCalledWith("aviso-legal-admins", { body: { aviso: "termos-2.0", modo: "simular" } });
    expect(await screen.findByText("12 administradores ativos, 2 já receberam.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Enviar a 10" }));
    expect(invoke).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Enviar aviso" }));
    await waitFor(() =>
      expect(invoke).toHaveBeenLastCalledWith("aviso-legal-admins", { body: { aviso: "termos-2.0", modo: "enviar" } })
    );
    await waitFor(() => expect(toastSucesso).toHaveBeenCalledWith("Aviso enviado a 10 administradores"));
    expect(await screen.findByText("12 administradores ativos, 12 já receberam.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar" })).toBeDisabled();
  });
});
