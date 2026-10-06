import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));

import { ComentarioCard } from "./ComentarioCard";

const pessoas = [
  { id: "p-larissa", nome: "Larissa Favero" },
  { id: "p-flavio", nome: "Flavio Januzzi" },
];

function renderCard(props: Partial<React.ComponentProps<typeof ComentarioCard>> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ComentarioCard
          comentario={{
            id: "c1",
            texto: "@Larissa Favero liberado para detalhamento, fala com @Flavio Januzzi",
            autor: "Flavio Januzzi",
            data: "2026-10-06T20:12:40Z",
            mencionados: ["p-larissa"],
          }}
          pessoas={pessoas}
          {...props}
        />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("ComentarioCard", () => {
  beforeEach(() => {
    rpc.mockReset();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("destaca e torna clicável só quem foi mencionado", () => {
    renderCard();
    const chip = screen.getByRole("button", { name: "@Larissa Favero" });
    expect(chip.className).toContain("bg-brand/25");
    // "@Flavio Januzzi" foi digitado sem escolher da lista: continua texto comum.
    expect(screen.queryByRole("button", { name: "@Flavio Januzzi" })).toBeNull();
  });

  it("abre o perfil público ao clicar na menção", async () => {
    rpc.mockResolvedValue({
      data: [
        {
          id: "p-larissa",
          nome: "Larissa Favero",
          cargo: "Projetista",
          email: "larissa@vrz.com.br",
          avatar_url: null,
          tem_conta: true,
          disciplinas: [
            {
              id: "d1",
              nome: "Elétrica - Detalhamento",
              status: "Não Iniciado",
              prazo: null,
              projeto_id: "pr1",
              projeto_nome: "367 - Miriam e Nelson",
            },
          ],
        },
      ],
      error: null,
    });
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: "@Larissa Favero" }));

    await waitFor(() => expect(screen.getByText("Projetista")).toBeInTheDocument());
    expect(rpc).toHaveBeenCalledWith("rpc_perfil_publico", { p_pessoa_id: "p-larissa" });
    expect(screen.getByText("larissa@vrz.com.br")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Elétrica - Detalhamento/ })).toHaveAttribute(
      "href",
      "/projetos/pr1?disciplina=d1"
    );
  });

  it("rola até o comentário de destino e destaca", () => {
    const { container } = renderCard({ destacado: true });
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    expect(container.querySelector('[data-comentario-id="c1"]')?.className).toContain("border-brand");
  });
});
