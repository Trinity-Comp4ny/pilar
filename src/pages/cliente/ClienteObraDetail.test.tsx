import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Obra no portal do cliente: carregamento, acesso negado/sem token, andamento por frente,
// prestação de contas (aportes, despesas com nota, taxa e saldo negativo), registros
// liberados com resumo da semana e o diário com fotos assinadas.

const h = vi.hoisted(() => ({
  rpc: vi.fn(),
  invoke: vi.fn(),
  rpcs: {} as Record<string, { data: unknown; error: unknown }>,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: h.rpc,
    functions: { invoke: h.invoke },
    auth: { getSession: () => Promise.resolve({ data: { session: null } }) },
  },
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/hooks/usePageTitle", () => ({ usePageTitle: vi.fn() }));
vi.mock("@/lib/monitoring", () => ({ reportInvokeError: vi.fn(), monitoring: { captureException: vi.fn() } }));

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

import ClienteObraDetail from "./ClienteObraDetail";
import { ContaObraContent } from "@/pages/portal/PortalContaObra";

const ACCOUNT = { id: "c1", cliente_id: "cl1", empresa_id: "e1", nome: "Marina Prado", email: "m@seed.test" };

function iso(offset: number) {
  return new Date(Date.now() + offset * 86400000).toISOString().split("T")[0];
}

const OBRA = {
  obra_id: "o1",
  nome: "Residência Seed",
  status: "em_andamento",
  data_inicio_prevista: "2026-09-01",
  data_fim_prevista: null,
  taxa_administracao_pct: 12,
  frentes: [
    {
      id: "f1",
      nome: "Fundação",
      ordem: 1,
      data_inicio: iso(-60),
      data_fim: iso(-30),
      tarefas: [{ status: "concluida", data_inicio: iso(-60), prazo: iso(-30) }],
    },
    {
      id: "f2",
      nome: "Estrutura",
      ordem: 2,
      data_inicio: iso(-10),
      data_fim: iso(20),
      tarefas: [{ status: "pendente", data_inicio: iso(-10), prazo: iso(20) }],
    },
    { id: "f3", nome: "Acabamento", ordem: 3, data_inicio: null, data_fim: null, tarefas: [] },
  ],
  conta: {
    total_aportado: 50000,
    total_gasto: 62000,
    saldo: -12000,
    taxa_administracao_valor: 7440,
    aportes: [{ data: "2026-09-02", descricao: "Aporte inicial", valor: 50000 }],
    despesas: [
      {
        data: "2026-09-10",
        descricao: "Concreto usinado",
        valor: 32000,
        frente_nome: "Fundação",
        comprovante_url: "https://nota/1",
      },
      { data: "2026-09-12", descricao: "Aço", valor: 30000, frente_nome: null, comprovante_url: null },
    ],
  },
  diario: [
    {
      id: "r1",
      data: "2026-10-01",
      clima: "ensolarado",
      atividades: "Concretagem da laje",
      fotos: [{ id: "ft1", path: "a" }],
    },
    { id: "r2", data: "2026-09-30", clima: null, atividades: "Armação", fotos: [{ id: "ft2", path: "b" }] },
  ],
  registros: [
    { id: "g1", data: "2026-10-02", texto: "Formas da laje prontas", num_fotos: 2 },
    { id: "g2", data: "2026-10-01", texto: "Chegou o aço", num_fotos: 0 },
  ],
};

function renderPage(aba?: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/cliente/obra/o1${aba ? `?aba=${aba}` : ""}`]}>
        <Routes>
          <Route path="/cliente" element={<Outlet context={ACCOUNT} />}>
            <Route path="obra/:id" element={<ClienteObraDetail />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  sessionStorage.setItem("pilar_portal_token", "tok");
  h.rpcs = { get_cliente_obra_detail: { data: OBRA, error: null } };
  h.rpc.mockImplementation((name: string) => Promise.resolve(h.rpcs[name] ?? { data: null, error: null }));
  h.invoke.mockImplementation((nome: string, { body }: { body: Record<string, unknown> }) => {
    if (nome === "portal-resumo-semana") return Promise.resolve({ data: { resumo: "Semana de laje." }, error: null });
    if (body.registro_ids) {
      return Promise.resolve({
        data: { registro_fotos: [{ registro_id: "g1", urls: ["https://reg/1", "https://reg/2"] }] },
        error: null,
      });
    }
    return Promise.resolve({ data: { fotos: [{ id: "ft1", signed_url: "https://foto/1" }] }, error: null });
  });
});

describe("ClienteObraDetail", () => {
  it("carrega a obra com o token do portal e mostra datas e andamento", async () => {
    renderPage();
    expect(await screen.findByText("Andamento da obra")).toBeInTheDocument();
    expect(h.rpc).toHaveBeenCalledWith("get_cliente_obra_detail", { p_token: "tok", p_obra_id: "o1" });
    expect(screen.getByText("01/09/2026")).toBeInTheDocument();
    expect(screen.getByText("A definir")).toBeInTheDocument();
    expect(screen.getByText("1 de 3 etapas concluídas")).toBeInTheDocument();
    expect(screen.getByText("Estrutura")).toBeInTheDocument();
  });

  it("aba Cronograma mostra as etapas com período e o Gantt", async () => {
    renderPage();
    await userEvent.setup().click(await screen.findByRole("tab", { name: "Cronograma" }));
    expect(await screen.findByText("Linha do tempo")).toBeInTheDocument();
    expect(screen.getByText("Etapas")).toBeInTheDocument();
    expect(screen.getByText("Prazo a definir")).toBeInTheDocument();
    expect(screen.getAllByText("Fundação").length).toBeGreaterThan(0);
  });

  it("prestação de contas com saldo negativo, taxa e nota da despesa", async () => {
    renderPage("financeiro");
    expect(await screen.findByText("Prestação de contas")).toBeInTheDocument();
    expect(screen.getByText("12% sobre o gasto da obra")).toBeInTheDocument();
    expect(screen.getByText("Aporte inicial")).toBeInTheDocument();
    expect(screen.getByText("Concreto usinado")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver nota/ })).toHaveAttribute("href", "https://nota/1");
  });

  it("registros liberados trazem o resumo da semana e as fotos", async () => {
    renderPage("rdo");
    expect(await screen.findByText("Formas da laje prontas")).toBeInTheDocument();
    expect(await screen.findByText("Semana de laje.")).toBeInTheDocument();
    await waitFor(() =>
      expect(h.invoke).toHaveBeenCalledWith("portal-obra-fotos", {
        body: { session_token: "tok", registro_ids: ["g1"] },
      })
    );
  });

  it("diário mostra os dias e só as fotos com URL assinada", async () => {
    renderPage("rdo");
    expect(await screen.findByText("Concretagem da laje")).toBeInTheDocument();
    await waitFor(() =>
      expect(h.invoke).toHaveBeenCalledWith("portal-obra-fotos", {
        body: { session_token: "tok", foto_ids: ["ft1", "ft2"] },
      })
    );
    await waitFor(() => expect(document.querySelector('img[src="https://foto/1"]')).not.toBeNull());
    expect(document.querySelector('img[src*="ft2"]')).toBeNull();
  });

  it("obra sem diário e sem registros não chama o resumo", async () => {
    h.rpcs.get_cliente_obra_detail = { data: { ...OBRA, diario: [], registros: [] }, error: null };
    renderPage("rdo");
    expect(await screen.findByText("Nenhum registro ainda")).toBeInTheDocument();
    expect(h.invoke).not.toHaveBeenCalled();
  });

  it("acesso negado no servidor mostra 'Obra não encontrada' com o motivo", async () => {
    h.rpcs.get_cliente_obra_detail = { data: null, error: { message: "Acesso negado" } };
    renderPage();
    expect(await screen.findByText("Obra não encontrada")).toBeInTheDocument();
    expect(screen.getByText("Acesso negado")).toBeInTheDocument();
    expect(screen.queryByText("Residência Seed")).not.toBeInTheDocument();
  });

  it("sem token do portal não consulta o servidor", async () => {
    sessionStorage.clear();
    renderPage();
    expect(await screen.findByText("Não autenticado")).toBeInTheDocument();
    expect(h.rpc).not.toHaveBeenCalled();
  });
});

describe("ContaObraContent", () => {
  it("sem aportes nem despesas mostra os vazios", () => {
    render(
      <ContaObraContent
        conta={{
          total_aportado: 0,
          total_gasto: 0,
          saldo: 0,
          taxa_administracao_valor: 0,
          aportes: [],
          despesas: [],
        }}
        taxaPct={10}
      />
    );
    expect(screen.getByText("Nenhum aporte registrado")).toBeInTheDocument();
    expect(screen.getByText("Nenhuma despesa registrada")).toBeInTheDocument();
    const saldo = screen.getByText("Saldo em conta").closest("div") as HTMLElement;
    expect(within(saldo.parentElement as HTMLElement).getByText(/R\$/)).toBeInTheDocument();
  });
});
