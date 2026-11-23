import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Link, MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PropostaPublica from "./PropostaPublica";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke } } }));
const token = "00000000-0000-4000-8000-000000000001";
const outroToken = "00000000-0000-4000-8000-000000000002";
const dados = {
  empresa: "Escritório",
  numero: 2,
  pdf: "https://example.test/v2.pdf",
  aceita_em: null,
  estado: "disponivel",
};
function abrir() {
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/proposta-compartilhada#${token}`]}>
        <Link to={`/proposta-compartilhada#${outroToken}`}>Abrir outra versão</Link>
        <PropostaPublica />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("PropostaPublica", () => {
  beforeEach(() => invoke.mockReset());

  it("abre o PDF exato e confirma o aceite da versão do link", async () => {
    invoke.mockResolvedValueOnce({ data: dados, error: null });
    invoke.mockResolvedValueOnce({
      data: { ...dados, estado: "aceita", aceita_em: "2026-11-19T12:00:00Z" },
      error: null,
    });
    abrir();
    expect(await screen.findByRole("link", { name: "Baixar PDF da V2" })).toHaveAttribute("href", dados.pdf);
    fireEvent.click(screen.getByRole("button", { name: "Aceitar proposta" }));
    expect(invoke).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    fireEvent.click(screen.getByRole("button", { name: "Aceitar proposta" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar aceite" }));
    expect(await screen.findByText(/Proposta aceita em/)).toBeInTheDocument();
    expect(invoke).toHaveBeenNthCalledWith(1, "proposta-link", { body: { token, acao: "abrir" } });
    expect(invoke).toHaveBeenNthCalledWith(2, "proposta-link", { body: { token, acao: "aceitar" } });
  });

  it("pede nova confirmação ao navegar para outra versão", async () => {
    invoke.mockResolvedValueOnce({ data: dados, error: null });
    invoke.mockResolvedValueOnce({ data: { ...dados, numero: 3 }, error: null });
    abrir();

    fireEvent.click(await screen.findByRole("button", { name: "Aceitar proposta" }));
    expect(screen.getByRole("button", { name: "Confirmar aceite" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Abrir outra versão" }));

    expect(await screen.findByRole("heading", { name: /V3/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirmar aceite" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aceitar proposta" })).toBeInTheDocument();
    expect(invoke).toHaveBeenNthCalledWith(2, "proposta-link", { body: { token: outroToken, acao: "abrir" } });
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it("atualiza o PDF depois de um aceite com PDF temporariamente indisponível", async () => {
    const aceita = { ...dados, estado: "aceita", aceita_em: "2026-11-19T12:00:00Z" };
    invoke
      .mockResolvedValueOnce({ data: dados, error: null })
      .mockResolvedValueOnce({ data: { ...aceita, pdf: null }, error: null })
      .mockResolvedValueOnce({ data: aceita, error: null });

    abrir();
    fireEvent.click(await screen.findByRole("button", { name: "Aceitar proposta" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar aceite" }));
    fireEvent.click(await screen.findByRole("button", { name: "Tentar carregar o PDF" }));

    expect(await screen.findByRole("link", { name: "Baixar PDF da V2" })).toHaveAttribute("href", dados.pdf);
    expect(screen.getByText(/Proposta aceita em/)).toBeInTheDocument();
    expect(invoke).toHaveBeenNthCalledWith(3, "proposta-link", { body: { token, acao: "abrir" } });
  });

  it.each(["substituida", "expirada", "encerrada"])("mostra PDF da versão %s sem oferecer aceite", async (estado) => {
    invoke.mockResolvedValue({ data: { ...dados, estado }, error: null });
    abrir();
    expect(await screen.findByRole("heading", { name: /V2/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Aceitar proposta" })).not.toBeInTheDocument();
  });

  it("exibe o estado indisponível para link inexistente", async () => {
    invoke.mockResolvedValue({ data: null, error: new Error("indisponível") });
    abrir();
    expect(await screen.findByText(/Peça o link ao escritório/)).toBeInTheDocument();
  });
});
