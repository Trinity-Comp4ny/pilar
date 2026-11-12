import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { LinkItem } from "@/components/LinksEditor";

// Links da aba Arquivos (SPEC 164): adicionar com "o cliente vê", alternar e remover.

const h = vi.hoisted(() => ({
  links: [] as LinkItem[],
  salvar: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("../hooks/useProjetoAtividades", () => ({
  useProjetoAtividades: () => ({ links: h.links, salvar: { mutateAsync: h.salvar, isPending: false } }),
}));
vi.mock("sonner", () => ({ toast: h.toast }));

import { LinksDoProjeto } from "./LinksDoProjeto";

// Switch do Radix mede o tamanho no jsdom.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const abrir = (canEdit = true) => {
  render(<LinksDoProjeto projetoId="p1" canEdit={canEdit} />);
  return userEvent.setup();
};

beforeEach(() => {
  vi.clearAllMocks();
  h.links = [];
  h.salvar.mockResolvedValue(undefined);
});

describe("LinksDoProjeto", () => {
  it("adiciona link que o cliente vê (padrão) com nome", async () => {
    const user = abrir();
    expect(screen.getByText("Nenhum link ainda.")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Endereço"), "wetransfer.com/abc");
    await user.type(screen.getByLabelText("Nome (opcional)"), "Pranchas");
    await user.click(screen.getByRole("button", { name: /Adicionar link/ }));
    await waitFor(() =>
      expect(h.salvar).toHaveBeenCalledWith({
        links: [{ url: "https://wetransfer.com/abc", rotulo: "Pranchas", cliente: true }],
      })
    );
    expect(h.toast.success).toHaveBeenCalledWith("Link adicionado. O cliente vê no portal.");
  });

  it("link só para a equipe e endereço inválido", async () => {
    const user = abrir();
    await user.type(screen.getByLabelText("Endereço"), "xyz");
    await user.click(screen.getByRole("button", { name: /Adicionar link/ }));
    expect(h.toast.error).toHaveBeenCalledWith("Link inválido", expect.anything());
    expect(h.salvar).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText("Endereço"));
    await user.type(screen.getByLabelText("Endereço"), "https://interno.com/plan");
    await user.click(screen.getByLabelText("O cliente vê no portal"));
    await user.click(screen.getByRole("button", { name: /Adicionar link/ }));
    await waitFor(() =>
      expect(h.salvar).toHaveBeenCalledWith({ links: [{ url: "https://interno.com/plan", cliente: false }] })
    );
  });

  it("alterna quem vê e remove, preservando os outros links", async () => {
    h.links = [{ url: "https://a.com/", rotulo: "A", cliente: true }, { url: "https://b.com/" }];
    const user = abrir();
    const lista = screen.getByRole("list", { name: "Links do projeto" });
    expect(within(lista).getByText("o cliente vê")).toBeInTheDocument();
    expect(within(lista).getByText("só a equipe")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Mostrar ao cliente: https://b.com/" }));
    await waitFor(() =>
      expect(h.salvar).toHaveBeenCalledWith({
        links: [
          { url: "https://a.com/", rotulo: "A", cliente: true },
          { url: "https://b.com/", cliente: true },
        ],
      })
    );
    await user.click(screen.getByRole("button", { name: "Remover link: A" }));
    await waitFor(() => expect(h.salvar).toHaveBeenLastCalledWith({ links: [{ url: "https://b.com/" }] }));
  });

  it("quem só vê o projeto não edita", () => {
    h.links = [{ url: "https://a.com/", cliente: true }];
    abrir(false);
    expect(screen.queryByLabelText("Endereço")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Remover link/ })).not.toBeInTheDocument();
  });

  it("erro ao salvar avisa", async () => {
    h.salvar.mockRejectedValue(new Error("x"));
    const user = abrir();
    await user.type(screen.getByLabelText("Endereço"), "https://a.com");
    await user.click(screen.getByRole("button", { name: /Adicionar link/ }));
    await waitFor(() =>
      expect(h.toast.error).toHaveBeenCalledWith("Não foi possível salvar o link", expect.anything())
    );
  });
});
