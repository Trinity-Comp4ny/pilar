import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Portal do cliente (SPEC 163): bloco "Arquivos do projeto" com a pasta Cliente do Drive.

const h = vi.hoisted(() => ({
  conteudo: {} as Record<string, unknown>,
  listar: vi.fn(),
  baixar: vi.fn(),
  toast: { error: vi.fn() },
}));

vi.mock("./portalArquivos", async (orig) => ({
  ...(await orig<typeof import("./portalArquivos")>()),
  listarArquivosPortal: h.listar,
  baixarArquivoPortal: h.baixar,
}));
vi.mock("sonner", () => ({ toast: h.toast }));

import { ArquivosDoProjeto } from "./ArquivosDoProjeto";

const PASTA = "application/vnd.google-apps.folder";

function abrir() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ArquivosDoProjeto projetoId="p1" />
    </QueryClientProvider>
  );
  return userEvent.setup();
}

beforeEach(() => {
  vi.clearAllMocks();
  h.conteudo = {
    raiz: {
      pasta: { id: "cli" },
      caminho: [{ id: "cli", nome: "Cliente" }],
      itens: [
        { id: "rev", name: "Revisão 1", mimeType: PASTA },
        { id: "a1", name: "planta.pdf", mimeType: "application/pdf", size: "2048" },
      ],
    },
    rev: {
      pasta: { id: "rev" },
      caminho: [
        { id: "cli", nome: "Cliente" },
        { id: "rev", nome: "Revisão 1" },
      ],
      itens: [{ id: "a2", name: "corte.pdf", mimeType: "application/pdf" }],
    },
  };
  h.listar.mockImplementation(async (_p: string, pasta?: string) => h.conteudo[pasta ?? "raiz"]);
  h.baixar.mockResolvedValue(undefined);
});

describe("ArquivosDoProjeto", () => {
  it("sem pasta do cliente (sem Drive) o bloco não aparece", async () => {
    h.conteudo.raiz = { pasta: null, itens: [] };
    abrir();
    await waitFor(() => expect(h.listar).toHaveBeenCalled());
    expect(screen.queryByText("Arquivos do projeto")).not.toBeInTheDocument();
  });

  it("sem Drive, mas com links para o cliente: mostra só os links", async () => {
    h.conteudo.raiz = {
      pasta: null,
      itens: [],
      links: [{ url: "https://wetransfer.com/x", rotulo: "Pranchas aprovadas" }, { url: "https://site.com/" }],
    };
    abrir();
    const link = await screen.findByRole("link", { name: /Pranchas aprovadas/ });
    expect(link).toHaveAttribute("href", "https://wetransfer.com/x");
    expect(link).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("link", { name: /site\.com/ })).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("com Drive e links: links em cima, arquivos embaixo", async () => {
    h.conteudo.raiz = { ...(h.conteudo.raiz as object), links: [{ url: "https://site.com/", rotulo: "Modelo 3D" }] };
    abrir();
    expect(await screen.findByRole("link", { name: /Modelo 3D/ })).toBeInTheDocument();
    expect(screen.getByText("planta.pdf")).toBeInTheDocument();
  });

  it("lista, baixa e navega pela subpasta", async () => {
    const user = abrir();
    expect(await screen.findByText("planta.pdf")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Baixar planta.pdf" }));
    expect(h.baixar).toHaveBeenCalledWith("p1", expect.objectContaining({ id: "a1" }));

    await user.click(screen.getByText("Revisão 1"));
    expect(await screen.findByText("corte.pdf")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cliente" }));
    expect(await screen.findByText("planta.pdf")).toBeInTheDocument();
  });

  it("falha no download vira aviso", async () => {
    h.baixar.mockRejectedValue(new Error("Arquivo não encontrado"));
    const user = abrir();
    await user.click(await screen.findByRole("button", { name: "Baixar planta.pdf" }));
    await waitFor(() => expect(h.toast.error).toHaveBeenCalled());
  });
});
