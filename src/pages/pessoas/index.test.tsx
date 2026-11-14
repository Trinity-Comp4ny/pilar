import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import type { ChainQuery, ChainResult } from "@/test/supabaseChain";
import Pessoas from "./index";

const h = vi.hoisted(() => ({
  resolve: vi.fn<(q: ChainQuery) => ChainResult>(),
  calls: [] as ChainQuery[],
  canEdit: true,
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", async () => {
  const { createSupabaseFrom } = await import("@/test/supabaseChain");
  const chain = createSupabaseFrom((q) => h.resolve(q));
  h.calls = chain.calls;
  return { supabase: { from: chain.from, rpc: vi.fn() } };
});
vi.mock("@/hooks/useFeatureAccess", () => ({ useFeatureAccess: () => ({ canEdit: h.canEdit }) }));
vi.mock("@/hooks/usePageTitle", () => ({ usePageTitle: vi.fn() }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ profile: { role: "admin", empresa_id: "e1" } }) }));
vi.mock("./components/PessoaAcessoSecao", () => ({ PessoaAcessoSecao: () => null }));
vi.mock("sonner", () => ({ toast: { error: h.toastError, success: h.toastSuccess } }));
vi.mock("@/components/PilarPage", () => ({
  PilarPage: ({
    title,
    primaryAction,
    children,
  }: {
    title: string;
    primaryAction?: { label: string; onClick: () => void };
    children: ReactNode;
  }) => (
    <main>
      <h1>{title}</h1>
      {primaryAction && <button onClick={primaryAction.onClick}>{primaryAction.label}</button>}
      {children}
    </main>
  ),
}));

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const PESSOAS = [
  {
    id: "p1",
    nome: "Rita Alves",
    cargo: "Arquiteta",
    email: "rita@seed.test",
    telefone: "",
    tipo_contrato: "clt",
    status: "ativo",
    cpf: "",
  },
  {
    id: "p2",
    nome: "Davi Melo",
    cargo: "Projetista",
    email: "davi@seed.test",
    telefone: "",
    tipo_contrato: "pj",
    status: "ativo",
    cpf: "",
  },
];

function renderPage(url = "/gestao/equipe") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <Pessoas />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  h.calls.length = 0;
  h.canEdit = true;
  h.resolve.mockImplementation((q) => (q.op === "select" ? { data: PESSOAS } : { error: null }));
});

describe("Equipe (página)", () => {
  it("lê da view mascarada pessoas_safe, nunca da tabela crua", async () => {
    renderPage();
    expect(await screen.findAllByText("Rita Alves")).not.toHaveLength(0);
    const leitura = h.calls.find((c) => c.op === "select");
    expect(leitura?.table).toBe("pessoas_safe");
    expect(leitura?.filters).toContainEqual(["is", "deleted_at", null]);
  });

  it("quem não pode editar não vê 'Nova pessoa' nem ações de editar/excluir", async () => {
    h.canEdit = false;
    renderPage();
    await screen.findAllByText("Rita Alves");
    expect(screen.queryByRole("button", { name: "Nova pessoa" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Mais ações/ })).not.toBeInTheDocument();
  });

  it("admin abre o cadastro de nova pessoa", async () => {
    renderPage();
    await userEvent.setup().click(screen.getByRole("button", { name: "Nova pessoa" }));
    expect(await screen.findByRole("dialog", { name: "Nova pessoa" })).toBeInTheDocument();
  });

  it("busca rápida: ?new=1 abre o cadastro de nova pessoa", async () => {
    renderPage("/gestao/equipe?new=1");
    expect(await screen.findByRole("dialog", { name: "Nova pessoa" })).toBeInTheDocument();
  });

  it("busca rápida: sem permissão de editar a equipe não abre o cadastro", async () => {
    h.canEdit = false;
    renderPage("/gestao/equipe?new=1");
    await screen.findAllByText("Rita Alves");
    expect(screen.queryByRole("dialog", { name: "Nova pessoa" })).not.toBeInTheDocument();
  });

  it("excluir pede confirmação e faz exclusão lógica (deleted_at)", async () => {
    renderPage();
    const user = userEvent.setup();
    await screen.findAllByText("Rita Alves");
    await user.click(screen.getAllByRole("button", { name: /^Mais ações/ })[0]);
    await user.click(await screen.findByRole("menuitem", { name: "Excluir" }));
    expect(await screen.findByText("Excluir pessoa")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(h.toastSuccess).toHaveBeenCalledWith("Pessoa excluída"));
    const up = h.calls.find((c) => c.op === "update");
    expect(up?.table).toBe("pessoas");
    expect(up?.payload).toEqual({ deleted_at: expect.any(String) });
    expect(up?.filters).toContainEqual(["eq", "id", "p1"]);
    expect(h.calls.some((c) => c.op === "delete")).toBe(false);
  });

  it("cancelar a exclusão não grava nada", async () => {
    renderPage();
    const user = userEvent.setup();
    await screen.findAllByText("Rita Alves");
    await user.click(screen.getAllByRole("button", { name: /^Mais ações/ })[0]);
    await user.click(await screen.findByRole("menuitem", { name: "Excluir" }));
    await user.click(await screen.findByRole("button", { name: "Cancelar" }));
    expect(h.calls.some((c) => c.op === "update")).toBe(false);
  });

  it("falha na exclusão avisa", async () => {
    h.resolve.mockImplementation((q) =>
      q.op === "select" ? { data: PESSOAS } : { error: { message: "row-level security" } }
    );
    renderPage();
    const user = userEvent.setup();
    await screen.findAllByText("Rita Alves");
    await user.click(screen.getAllByRole("button", { name: /^Mais ações/ })[0]);
    await user.click(await screen.findByRole("menuitem", { name: "Excluir" }));
    await user.click(await screen.findByRole("button", { name: "Excluir" }));
    await waitFor(() =>
      expect(h.toastError).toHaveBeenCalledWith("Não foi possível excluir a pessoa. Tente novamente.")
    );
  });

  it("lista vazia mostra estado vazio", async () => {
    h.resolve.mockReturnValue({ data: [] });
    renderPage();
    expect(await screen.findByText("Nenhum membro cadastrado")).toBeInTheDocument();
  });

  it("erro ao carregar avisa", async () => {
    h.resolve.mockReturnValue({ error: new Error("timeout") });
    renderPage();
    await waitFor(() =>
      expect(h.toastError).toHaveBeenCalledWith("Erro ao carregar equipe", {
        description: "Tente recarregar a página.",
      })
    );
  });
});
