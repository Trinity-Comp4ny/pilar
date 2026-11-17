import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ClienteDashboard from "./ClienteDashboard";

const h = vi.hoisted(() => ({
  rpcs: {} as Record<string, { data: unknown; error: unknown }>,
  rpc: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: h.rpc, auth: { getSession: h.getSession } },
}));
vi.mock("@/hooks/usePageTitle", () => ({ usePageTitle: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const ACCOUNT = { id: "c1", cliente_id: "cl1", empresa_id: "e1", nome: "Marina Prado", email: "marina@seed.test" };

const PROJETO = {
  projeto_id: "p1",
  projeto_nome: "Residência Seed",
  projeto_codigo: "P-01",
  projeto_status: "Em Andamento",
  data_inicio: "2026-01-10",
  data_previsao: "2026-06-30",
  valor_contrato: 1000,
  disciplinas: [{ status: "Concluído" }, { status: "Concluído" }, { status: "Em Andamento" }, { status: "A Fazer" }],
  empresa_nome: "Escritório Seed",
};

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/cliente/dashboard"]}>
        <Routes>
          <Route path="/cliente" element={<Outlet context={ACCOUNT} />}>
            <Route path="dashboard" element={<ClienteDashboard />} />
          </Route>
          <Route path="/cliente/login" element={<div data-testid="login" />} />
          <Route path="/cliente/projeto/:id" element={<div data-testid="projeto" />} />
          <Route path="/gestao/clientes" element={<div data-testid="painel" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  sessionStorage.setItem("pilar_portal_token", "tok");
  h.getSession.mockResolvedValue({ data: { session: null } });
  h.rpcs = {
    get_cliente_projetos: { data: [PROJETO], error: null },
    get_cliente_obras: { data: [], error: null },
    portal_logout: { data: null, error: null },
  };
  h.rpc.mockImplementation((name: string) => Promise.resolve(h.rpcs[name] ?? { data: null, error: null }));
});

describe("ClienteDashboard", () => {
  it("saúda pelo primeiro nome e lista projetos com progresso por etapas", async () => {
    renderPage();
    expect(screen.getByText("Olá, Marina")).toBeInTheDocument();
    expect(await screen.findByText("Residência Seed")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Etapas concluídas" })).toHaveAttribute("aria-valuenow", "50");
    expect(screen.getByText("Início: 10/01/2026")).toBeInTheDocument();
    expect(h.rpc).toHaveBeenCalledWith("get_cliente_projetos", { p_token: "tok" });
  });

  it("projeto sem disciplinas mostra 0% e datas ausentes como traço", async () => {
    h.rpcs.get_cliente_projetos = {
      data: [{ ...PROJETO, disciplinas: [], data_inicio: null, data_previsao: null }],
      error: null,
    };
    renderPage();
    expect(await screen.findByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
    expect(screen.getByText("Início: —")).toBeInTheDocument();
  });

  it("Pendências do início juntam as solicitações de projetos e obras, com a origem", async () => {
    const base = { status: "pendente", descricao: null, tipo: "aprovacao", drive_url: null, disciplina_nome: null };
    h.rpcs.portal_listar_solicitacoes = {
      data: [
        {
          ...base,
          id: "s1",
          titulo: "Aprovar piso",
          obra_nome: "Casa Lago",
          projeto_nome: null,
          created_at: "2026-11-10",
        },
        {
          ...base,
          id: "s2",
          titulo: "Enviar RG",
          obra_nome: null,
          projeto_nome: "Residência Seed",
          created_at: "2026-11-11",
        },
        {
          ...base,
          id: "s3",
          status: "aprovado",
          titulo: "Já feita",
          obra_nome: null,
          projeto_nome: "X",
          created_at: "2026-11-01",
        },
      ],
      error: null,
    };
    renderPage();
    expect(await screen.findByText("Aprovar piso")).toBeInTheDocument();
    expect(screen.getByText("Obra: Casa Lago")).toBeInTheDocument();
    expect(screen.getByText("Enviar RG")).toBeInTheDocument();
    expect(screen.queryByText("Já feita")).not.toBeInTheDocument();
    expect(h.rpc).toHaveBeenCalledWith("portal_listar_solicitacoes", {
      p_token: "tok",
      p_projeto_id: null,
      p_obra_id: null,
    });
  });

  it("sem solicitações o início diz que está em dia", async () => {
    h.rpcs.portal_listar_solicitacoes = { data: [], error: null };
    renderPage();
    expect(await screen.findByText("Nada pendente. Você está em dia.")).toBeInTheDocument();
  });

  it("clicar no projeto abre o detalhe", async () => {
    renderPage();
    await userEvent.setup().click(await screen.findByText("Residência Seed"));
    expect(await screen.findByTestId("projeto")).toBeInTheDocument();
  });

  it("sem projetos nem obras mostra estado vazio com contato de suporte", async () => {
    h.rpcs.get_cliente_projetos = { data: [], error: null };
    renderPage();
    expect(await screen.findByText("Você ainda não tem projetos liberados")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /entre em contato com o suporte/ }).getAttribute("href")).toMatch(
      /^mailto:/
    );
  });

  it("erro ao carregar mostra mensagem amigável sem detalhe técnico", async () => {
    h.rpcs.get_cliente_projetos = {
      data: null,
      error: new Error("permission denied for function get_cliente_projetos"),
    };
    renderPage();
    expect(await screen.findByText(/Não foi possível carregar seus projetos agora/)).toBeInTheDocument();
    expect(screen.queryByText(/permission denied/)).not.toBeInTheDocument();
    expect(screen.queryByText("Você ainda não tem projetos liberados")).not.toBeInTheDocument();
  });

  it("obras liberadas aparecem mesmo sem projetos", async () => {
    h.rpcs.get_cliente_projetos = { data: [], error: null };
    h.rpcs.get_cliente_obras = {
      data: [
        {
          id: "o1",
          nome: "Obra Seed",
          status: "em_andamento",
          avanco_pct: 35,
          data_inicio_prevista: null,
          data_fim_prevista: null,
        },
      ],
      error: null,
    };
    renderPage();
    expect(await screen.findByText("Obra Seed")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Avanço da obra" })).toHaveAttribute("aria-valuenow", "35");
    expect(screen.queryByText("Você ainda não tem projetos liberados")).not.toBeInTheDocument();
  });

  it("cliente comum não vê 'Voltar ao painel'", async () => {
    renderPage();
    await screen.findByText("Residência Seed");
    expect(screen.queryByRole("button", { name: "Voltar ao painel" })).not.toBeInTheDocument();
  });

  it("admin pré-visualizando (com sessão interna) vê 'Voltar ao painel'", async () => {
    h.getSession.mockResolvedValue({ data: { session: { user: { id: "admin" } } } });
    renderPage();
    await userEvent.setup().click(await screen.findByRole("button", { name: "Voltar ao painel" }));
    expect(await screen.findByTestId("painel")).toBeInTheDocument();
  });

  it("Sair invalida o token no servidor, limpa local e volta ao login", async () => {
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Marina/ }));
    await user.click(await screen.findByRole("menuitem", { name: /Sair/ }));
    expect(await screen.findByTestId("login")).toBeInTheDocument();
    expect(h.rpc).toHaveBeenCalledWith("portal_logout", { p_token: "tok" });
    expect(sessionStorage.getItem("pilar_portal_token")).toBeNull();
  });

  it("Sair limpa o token mesmo se o logout no servidor falhar", async () => {
    h.rpc.mockImplementation((name: string) =>
      name === "portal_logout"
        ? Promise.reject(new Error("offline"))
        : Promise.resolve(h.rpcs[name] ?? { data: null, error: null })
    );
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Marina/ }));
    await user.click(await screen.findByRole("menuitem", { name: /Sair/ }));
    expect(await screen.findByTestId("login")).toBeInTheDocument();
    expect(sessionStorage.getItem("pilar_portal_token")).toBeNull();
  });

  it("Trocar senha abre o diálogo com o formulário e Cancelar fecha", async () => {
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Marina/ }));
    await user.click(await screen.findByRole("menuitem", { name: /Trocar senha/ }));
    expect(await screen.findByRole("dialog", { name: "Trocar senha" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
