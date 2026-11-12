import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import ClienteProjetoDetail from "./ClienteProjetoDetail";

const h = vi.hoisted(() => ({
  rpc: vi.fn(),
  invoke: vi.fn(),
  rpcs: {} as Record<string, { data: unknown; error: unknown }>,
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  reportInvokeError: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: h.rpc,
    functions: { invoke: h.invoke },
    auth: { getSession: () => Promise.resolve({ data: { session: null } }) },
  },
}));
vi.mock("sonner", () => ({ toast: { error: h.toastError, success: h.toastSuccess } }));
vi.mock("@/hooks/usePageTitle", () => ({ usePageTitle: vi.fn() }));
vi.mock("./ArquivosDoProjeto", () => ({ ArquivosDoProjeto: () => null }));
vi.mock("@/lib/monitoring", () => ({
  reportInvokeError: h.reportInvokeError,
  monitoring: { captureException: vi.fn() },
}));

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const ACCOUNT = { id: "c1", cliente_id: "cl1", empresa_id: "e1", nome: "Marina Prado", email: "m@seed.test" };

function iso(offsetDays: number) {
  return new Date(Date.now() + offsetDays * 86400000).toISOString().split("T")[0];
}

const PROJETO = {
  projeto_id: "p1",
  cliente_id: "cl1",
  empresa_id: "e1",
  projeto_nome: "Residência Seed",
  projeto_status: "Em Andamento",
  proposta_aguardando_aprovacao: false,
  projeto_codigo: "P-01",
  data_inicio: null,
  data_previsao: null,
  data_final: null,
  valor_contrato: 12000,
  disciplinas: [{ disciplina: "Arquitetura", status: "Em Andamento" }],
  cliente_nome: "Marina",
  empresa_nome: "Escritório Seed",
  receitas: [],
  portal_entregas_pendentes: 0,
};

const ENTREGA = {
  id: "en1",
  titulo: "Planta baixa",
  descricao: null,
  tipo: null,
  status: "pendente",
  drive_url: "https://drive.google.com/file/x",
  projeto_disciplina_id: null,
  disciplina_nome: "Arquitetura",
  resposta_cliente: null,
  respondido_em: null,
  aprovado_ip: null,
  aprovado_user_agent: null,
  created_at: "2026-10-01T12:00:00Z",
};

function renderPage(path = "/cliente/projeto/p1") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/cliente" element={<Outlet context={ACCOUNT} />}>
          <Route path="projeto/:id/*" element={<ClienteProjetoDetail />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  sessionStorage.setItem("pilar_portal_token", "tok");
  h.rpcs = {
    get_cliente_projeto_detail: { data: PROJETO, error: null },
    portal_listar_entregas: { data: [ENTREGA], error: null },
    portal_aprovar_entrega: { data: null, error: null },
    portal_solicitar_revisao_entrega: { data: null, error: null },
  };
  h.rpc.mockImplementation((name: string) => Promise.resolve(h.rpcs[name] ?? { data: null, error: null }));
  h.invoke.mockResolvedValue({ data: {}, error: null });
});

describe("ClienteProjetoDetail", () => {
  it("visão geral: datas indefinidas viram 'A definir' e sem pendências mostra 'Nada pendente'", async () => {
    renderPage();
    expect(await screen.findByText("Nada pendente")).toBeInTheDocument();
    expect(screen.getAllByText("A definir").length).toBeGreaterThanOrEqual(2);
    expect(h.rpc).toHaveBeenCalledWith("get_cliente_projeto_detail", { p_projeto_id: "p1", p_token: "tok" });
  });

  it("projeto de outro cliente (acesso negado no servidor) não mostra dados", async () => {
    h.rpcs.get_cliente_projeto_detail = { data: null, error: { message: "Acesso negado" } };
    renderPage();
    expect(await screen.findByText("Projeto não encontrado")).toBeInTheDocument();
    expect(screen.getByText("Acesso negado")).toBeInTheDocument();
    expect(screen.queryByText("Residência Seed")).not.toBeInTheDocument();
  });

  it("sem token do portal não consulta o servidor", async () => {
    sessionStorage.clear();
    renderPage();
    expect(await screen.findByText("Projeto não encontrado")).toBeInTheDocument();
    expect(h.rpc).not.toHaveBeenCalledWith("get_cliente_projeto_detail", expect.anything());
  });

  it("pendências: parcelas atrasadas, a vencer e entregas levam às abas certas", async () => {
    h.rpcs.get_cliente_projeto_detail = {
      data: {
        ...PROJETO,
        portal_entregas_pendentes: 2,
        receitas: [
          {
            id: "r1",
            descricao: "P1",
            valor: 100,
            data_vencimento: iso(-3),
            data_recebimento: null,
            status: "Pendente",
          },
          {
            id: "r2",
            descricao: "P2",
            valor: 100,
            data_vencimento: iso(2),
            data_recebimento: null,
            status: "Pendente",
          },
          {
            id: "r3",
            descricao: "P3",
            valor: 100,
            data_vencimento: iso(-30),
            data_recebimento: iso(-29),
            status: "Recebido",
          },
        ],
      },
      error: null,
    };
    renderPage();
    expect(await screen.findByText("Você tem pendências")).toBeInTheDocument();
    expect(screen.getByText("4 itens precisam da sua atenção.")).toBeInTheDocument();
    expect(screen.getByText("1 parcela em atraso")).toBeInTheDocument();
    expect(screen.getByText(/1 parcela\s*vencendo em 7 dias/)).toBeInTheDocument();
    await userEvent.setup().click(screen.getByText("2 entregas para aprovar"));
    expect(await screen.findByText("Planta baixa")).toBeInTheDocument();
  });

  describe("aprovar proposta", () => {
    beforeEach(() => {
      h.rpcs.get_cliente_projeto_detail = { data: { ...PROJETO, proposta_aguardando_aprovacao: true }, error: null };
    });

    it("pede confirmação antes de aprovar e 'Voltar' não aprova", async () => {
      renderPage();
      const user = userEvent.setup();
      await user.click(await screen.findByRole("button", { name: /Aprovar proposta/ }));
      expect(await screen.findByText("Aprovar esta proposta?")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Voltar" }));
      expect(h.invoke).not.toHaveBeenCalled();
    });

    it("confirmar chama a função com projeto e token", async () => {
      renderPage();
      const user = userEvent.setup();
      await user.click(await screen.findByRole("button", { name: /Aprovar proposta/ }));
      await user.click(await screen.findByRole("button", { name: "Confirmar aprovação" }));
      await waitFor(() =>
        expect(h.invoke).toHaveBeenCalledWith("portal-aprovar-proposta", { body: { projeto_id: "p1", token: "tok" } })
      );
      expect(h.toastSuccess).toHaveBeenCalledWith("Proposta aprovada!", expect.anything());
    });

    it("falha na aprovação avisa sem detalhe técnico e reporta", async () => {
      h.invoke.mockResolvedValue({ data: null, error: new Error("FunctionsHttpError: 500") });
      renderPage();
      const user = userEvent.setup();
      await user.click(await screen.findByRole("button", { name: /Aprovar proposta/ }));
      await user.click(await screen.findByRole("button", { name: "Confirmar aprovação" }));
      await waitFor(() =>
        expect(h.toastError).toHaveBeenCalledWith("Erro ao aprovar proposta", {
          description: "Tente novamente em instantes.",
        })
      );
      expect(h.reportInvokeError).toHaveBeenCalled();
    });

    it("sessão perdida antes de confirmar não chama a função", async () => {
      renderPage();
      const user = userEvent.setup();
      await user.click(await screen.findByRole("button", { name: /Aprovar proposta/ }));
      sessionStorage.clear();
      await user.click(await screen.findByRole("button", { name: "Confirmar aprovação" }));
      await waitFor(() =>
        expect(h.toastError).toHaveBeenCalledWith("Sessão inválida", { description: "Faça login novamente." })
      );
      expect(h.invoke).not.toHaveBeenCalled();
    });
  });

  describe("aba Entregas", () => {
    it("aprovar entrega chama o RPC por token", async () => {
      renderPage("/cliente/projeto/p1/entregas");
      await userEvent.setup().click(await screen.findByRole("button", { name: /^Aprovar$/ }));
      await waitFor(() =>
        expect(h.rpc).toHaveBeenCalledWith("portal_aprovar_entrega", { p_token: "tok", p_entrega_id: "en1" })
      );
      expect(h.toastSuccess).toHaveBeenCalledWith("Entregável aprovado");
    });

    it("erro ao aprovar mostra mensagem amigável", async () => {
      h.rpcs.portal_aprovar_entrega = { data: null, error: { message: "entrega de outro cliente" } };
      renderPage("/cliente/projeto/p1/entregas");
      await userEvent.setup().click(await screen.findByRole("button", { name: /^Aprovar$/ }));
      await waitFor(() =>
        expect(h.toastError).toHaveBeenCalledWith("Não foi possível aprovar", {
          description: "Tente novamente em instantes ou fale com o escritório.",
        })
      );
    });

    it("solicitar revisão exige texto e envia aparado", async () => {
      renderPage("/cliente/projeto/p1/entregas");
      const user = userEvent.setup();
      await user.click(await screen.findByRole("button", { name: /Solicitar revisão/ }));
      const enviar = screen.getAllByRole("button", { name: /Solicitar revisão/ }).at(-1)!;
      expect(enviar).toBeDisabled();
      await user.type(screen.getByPlaceholderText("Descreva o que precisa ser revisado..."), "   ");
      expect(enviar).toBeDisabled();
      await user.type(screen.getByPlaceholderText("Descreva o que precisa ser revisado..."), "Ajustar cotas  ");
      await user.click(enviar);
      await waitFor(() =>
        expect(h.rpc).toHaveBeenCalledWith("portal_solicitar_revisao_entrega", {
          p_token: "tok",
          p_entrega_id: "en1",
          p_resposta: "Ajustar cotas",
        })
      );
    });

    it("falha ao listar entregas mostra aviso", async () => {
      h.rpcs.portal_listar_entregas = { data: null, error: { message: "boom" } };
      renderPage("/cliente/projeto/p1/entregas");
      expect(await screen.findByText(/Não foi possível carregar as entregas agora/)).toBeInTheDocument();
    });

    it("sem entregas mostra estado vazio", async () => {
      h.rpcs.portal_listar_entregas = { data: [], error: null };
      renderPage("/cliente/projeto/p1/entregas");
      expect(await screen.findByText("Nenhuma entrega disponível")).toBeInTheDocument();
    });
  });

  it("aba Financeiro lista parcelas e resumo", async () => {
    h.rpcs.get_cliente_projeto_detail = {
      data: {
        ...PROJETO,
        receitas: [
          {
            id: "r1",
            descricao: "Entrada",
            valor: 500,
            data_vencimento: iso(-10),
            data_recebimento: iso(-9),
            status: "Recebido",
          },
          {
            id: "r2",
            descricao: "Final",
            valor: 500,
            data_vencimento: iso(20),
            data_recebimento: null,
            status: "Pendente",
          },
        ],
      },
      error: null,
    };
    renderPage("/cliente/projeto/p1/financeiro");
    expect(await screen.findByText("Parcelas")).toBeInTheDocument();
    expect(screen.getByText("50% pago")).toBeInTheDocument();
    expect(screen.getByText("Entrada")).toBeInTheDocument();
  });
});
