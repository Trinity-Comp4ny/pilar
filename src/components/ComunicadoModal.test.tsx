import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { ComunicadoModal } from "./ComunicadoModal";

const rpc = vi.hoisted(() => vi.fn(() => Promise.resolve({ error: null })));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
vi.mock("@/hooks/useAvisosPlataforma", () => ({
  AVISOS_PLATAFORMA_KEY: ["avisos-plataforma"],
  useComunicadosModal: () => [
    {
      id: "c1",
      titulo: "Preço novo",
      mensagem: "Vale a partir de dezembro",
      formato: "modal",
      link_url: null,
      link_rotulo: null,
    },
  ],
}));

describe("ComunicadoModal (SPEC 157)", () => {
  it("abre o comunicado e Entendi dispensa no banco", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <ComunicadoModal />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.getByText("Preço novo")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Entendi" }));
    expect(rpc).toHaveBeenCalledWith("dispensar_comunicado", { p_comunicado_id: "c1" });
    expect(screen.queryByText("Preço novo")).not.toBeInTheDocument();
  });
});
