import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FunctionsHttpError } from "@supabase/supabase-js";
import type { ChainQuery, ChainResult } from "@/test/supabaseChain";
import type { Cliente } from "@/hooks/useClientes";
import type { ProjetoResumo, PropostaResumo } from "@/pages/clientes/hooks/useClienteDetalhe";

/**
 * Detalhe do cliente: estados de carga, ações do cabeçalho por permissão,
 * mensagem manual (sucesso e erro da edge function), exclusão, portal do
 * cliente (com gate de 2FA) e abas de projetos/propostas/financeiro/entregas.
 */

const h = vi.hoisted(() => ({
  resolve: vi.fn<(q: ChainQuery) => ChainResult>(),
  invoke: vi.fn(),
  calls: [] as ChainQuery[],
  detalhe: {} as Record<string, unknown>,
  perm: { isAdmin: true, edit: true, entregas: true, role: "admin" },
  requireAal2: vi.fn(),
  invitePortal: vi.fn(),
  resetPortalPassword: vi.fn(),
  revokePortalAccess: vi.fn(),
  deleteCliente: vi.fn(),
  registrar: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  reportInvokeError: vi.fn(),
  mobile: false,
}));

vi.mock("@/integrations/supabase/client", async () => {
  const { createSupabaseFrom } = await import("@/test/supabaseChain");
  const chain = createSupabaseFrom((q) => h.resolve(q));
  h.calls = chain.calls;
  return { supabase: { from: chain.from, functions: { invoke: h.invoke } } };
});
vi.mock("@/pages/clientes/hooks/useClienteDetalhe", () => ({ useClienteDetalhe: () => h.detalhe }));
vi.mock("@/hooks/useClientes", () => ({
  useClientes: () => ({
    invitePortal: h.invitePortal,
    isInvitingPortal: false,
    resetPortalPassword: h.resetPortalPassword,
    isResettingPortal: false,
    revokePortalAccess: h.revokePortalAccess,
    isRevokingPortal: false,
    deleteCliente: h.deleteCliente,
  }),
}));
vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({
    isAdmin: h.perm.isAdmin,
    role: h.perm.role,
    can: (feature: string) => (feature === "portal_cliente" ? h.perm.entregas : h.perm.edit),
  }),
}));
vi.mock("@/components/portal/AcessoPortalDialog", () => ({
  AcessoPortalDialog: ({ open, clienteEmail }: { open: boolean; clienteEmail?: string }) =>
    open ? <div role="dialog">acesso-portal:{clienteEmail || "sem-email"}</div> : null,
}));
vi.mock("@/hooks/useRequireAal2", () => ({ useRequireAal2: () => h.requireAal2 }));
vi.mock("@/hooks/useRecentes", () => ({ useRecentes: () => ({ registrar: h.registrar }) }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => h.mobile }));
vi.mock("@/hooks/usePageTitle", () => ({ usePageTitle: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: h.toastError, success: h.toastSuccess } }));
vi.mock("@/lib/monitoring", () => ({ reportInvokeError: h.reportInvokeError }));
vi.mock("@/components/ui/sidebar", async (orig) => ({
  ...(await orig<typeof import("@/components/ui/sidebar")>()),
  useSidebar: () => ({ state: "expanded", isMobile: false, open: true, setOpenMobile: vi.fn() }),
}));
vi.mock("@/components/ModuleChipNav", () => ({ ModuleChipNav: () => null }));
vi.mock("@/pages/clientes/ClienteFormDialog", () => ({
  ClienteFormDialog: ({ open }: { open: boolean }) => (open ? <div role="dialog" aria-label="Editar cliente" /> : null),
}));
vi.mock("@/pages/portal/PortalFinanceiro", () => ({
  FinanceiroContent: ({ receitas }: { receitas: { descricao: string }[] }) => (
    <ul aria-label="Receitas">
      {receitas.map((r) => (
        <li key={r.descricao}>{r.descricao}</li>
      ))}
    </ul>
  ),
}));
vi.mock("@/pages/portal/PortalEntregas", () => ({
  EntregasContent: ({ projetoId }: { projetoId: string }) => <div>Entregas de {projetoId}</div>,
}));
vi.mock("@/pages/portal/EntregaFormDialog", () => ({
  EntregaFormDialog: ({ projetoId, onCreated }: { projetoId: string; onCreated: () => void }) => (
    <div role="dialog" aria-label="Nova entrega">
      {projetoId}
      <button onClick={onCreated}>Criar entrega</button>
    </div>
  ),
}));

import ClienteDetalhePage from "./index";

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const ANA = {
  id: "c1",
  nome: "Ana",
  sobrenome: "Lima",
  cpf_cnpj: "52998224725",
  email: "ana@seed.test",
  contato: "11988887777",
  endereco: "Rua das Flores, 10",
  origem: "Indicação",
  tipo_nf: "SERVICO",
  contas_bancarias: [{ banco: "Banco Seed", agencia: "0001", conta: "123-4", tipo: "corrente", is_primary: true }],
} as unknown as Cliente;

const PROJETO: ProjetoResumo = {
  id: "pj1",
  codigo_projeto: null,
  nome: "Casa Ipê",
  status: "Em andamento",
  valor_contrato: 12000,
  data_inicio: "2026-01-10",
  data_previsao: "2026-12-20",
  data_final: null,
  total_disciplinas: 4,
  disciplinas_concluidas: 1,
};
const PROPOSTA: PropostaResumo = {
  id: "pp1",
  codigo: "PRP-001",
  titulo: "Projeto executivo",
  status: "enviada",
  valor_proposto: null,
  validade: null,
  created_at: "2026-10-01T12:00:00Z",
};

const detalhe = (over: Record<string, unknown> = {}) => ({
  cliente: ANA,
  isLoadingCliente: false,
  projetos: [PROJETO],
  isLoadingProjetos: false,
  propostas: [PROPOSTA],
  isLoadingPropostas: false,
  portalStatus: { exists: false, email: null },
  isLoadingPortal: false,
  ...over,
});

function Local() {
  return <div data-testid="local">{useLocation().pathname}</div>;
}

function renderPagina() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/clientes/c1"]}>
        <Routes>
          <Route path="/clientes/:id" element={<ClienteDetalhePage />} />
          <Route path="*" element={<Local />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
  return userEvent.setup();
}

const aba = (nome: RegExp) => screen.getByRole("tab", { name: nome });

beforeEach(() => {
  vi.clearAllMocks();
  h.calls.length = 0;
  h.detalhe = detalhe();
  h.perm = { isAdmin: true, edit: true, entregas: true, role: "admin" };
  h.mobile = false;
  h.requireAal2.mockResolvedValue(true);
  h.invoke.mockResolvedValue({ data: {}, error: null });
  h.resolve.mockReturnValue({ data: [] });
});

describe("ClienteDetalhePage: estados", () => {
  it("carregando não mostra conteúdo", () => {
    h.detalhe = detalhe({ isLoadingCliente: true, cliente: null });
    renderPagina();
    expect(screen.queryByText("Cliente não encontrado")).not.toBeInTheDocument();
    expect(h.registrar).not.toHaveBeenCalled();
  });

  it("cliente inexistente mostra aviso e volta para a lista", async () => {
    h.detalhe = detalhe({ cliente: null });
    const user = renderPagina();
    expect(screen.getByRole("heading", { name: "Cliente não encontrado" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Voltar para clientes" }));
    expect(screen.getByTestId("local")).toHaveTextContent("/gestao/clientes");
  });

  it("registra a visita nos recentes e mostra dados formatados", () => {
    renderPagina();
    expect(h.registrar).toHaveBeenCalledWith({ tipo: "cliente", rota: "/clientes/c1", label: "Ana Lima" });
    expect(screen.getByRole("heading", { name: "Ana Lima" })).toBeInTheDocument();
    expect(screen.getByText("529.982.247-25")).toBeInTheDocument();
    expect(screen.getByText("(11) 98888-7777")).toBeInTheDocument();
    expect(screen.getByText("Serviço")).toBeInTheDocument();
    expect(screen.getByText("Banco Seed")).toBeInTheDocument();
  });

  it("sem email nem telefone mostra 'Não informado' e ainda oferece o portal", () => {
    h.detalhe = detalhe({ cliente: { ...ANA, email: "", contato: "", contas_bancarias: [], tipo_nf: "outro" } });
    renderPagina();
    expect(screen.getAllByText("Não informado")).toHaveLength(2);
    expect(screen.getByText("outro")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Criar acesso ao portal" })).toBeInTheDocument();
    expect(screen.queryByText("Contas Bancárias")).not.toBeInTheDocument();
  });
});

describe("ClienteDetalhePage: ações do cabeçalho", () => {
  it("sem permissão de edição nem admin não há ações nem portal", () => {
    h.perm = { isAdmin: false, edit: false, entregas: false, role: "user" };
    renderPagina();
    expect(screen.queryByRole("button", { name: "Mensagem" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Excluir" })).not.toBeInTheDocument();
    expect(screen.queryByText("Portal do Cliente")).not.toBeInTheDocument();
  });

  it("no mobile os botões ficam só com ícone, mas acessíveis pelo nome", () => {
    h.mobile = true;
    renderPagina();
    expect(screen.getByRole("button", { name: "Mensagem" })).not.toHaveTextContent("Mensagem");
  });

  it("editar abre o formulário do cliente", async () => {
    const user = renderPagina();
    await user.click(screen.getByRole("button", { name: "Editar" }));
    expect(screen.getByRole("dialog", { name: "Editar cliente" })).toBeInTheDocument();
  });

  async function enviarMensagem(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: "Mensagem" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Assunto"), "Reunião");
    await user.type(within(dialog).getByLabelText("Mensagem"), "Podemos falar amanhã?");
    await user.click(within(dialog).getByRole("button", { name: "Enviar" }));
  }

  it("mensagem enviada chama a edge function e limpa o formulário", async () => {
    const user = renderPagina();
    await enviarMensagem(user);
    await waitFor(() => expect(h.toastSuccess).toHaveBeenCalledWith("Mensagem enviada para Ana Lima"));
    expect(h.invoke).toHaveBeenCalledWith("send-manual-client-email", {
      body: { cliente_id: "c1", subject: "Reunião", message: "Podemos falar amanhã?" },
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Mensagem" }));
    expect(within(await screen.findByRole("dialog")).getByLabelText("Assunto")).toHaveValue("");
  });

  it("erro da edge function mostra o motivo do servidor e reporta", async () => {
    const erro = new FunctionsHttpError(new Response(JSON.stringify({ error: "Cliente sem email" }), { status: 400 }));
    h.invoke.mockResolvedValue({ data: null, error: erro });
    const user = renderPagina();
    await enviarMensagem(user);
    await waitFor(() =>
      expect(h.toastError).toHaveBeenCalledWith("Não foi possível enviar a mensagem", {
        description: "Cliente sem email",
      })
    );
    expect(h.reportInvokeError).toHaveBeenCalledWith(erro, "send-manual-client-email");
    expect(h.toastSuccess).not.toHaveBeenCalled();
  });

  it("excluir confirma, apaga e volta para a lista", async () => {
    h.deleteCliente.mockResolvedValue(undefined);
    const user = renderPagina();
    await user.click(screen.getByRole("button", { name: "Excluir" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(screen.getByTestId("local")).toHaveTextContent("/gestao/clientes"));
    expect(h.deleteCliente).toHaveBeenCalledWith("c1");
  });

  it("falha ao excluir mantém o usuário no cliente", async () => {
    h.deleteCliente.mockRejectedValue(new Error("violates foreign key"));
    const user = renderPagina();
    await user.click(screen.getByRole("button", { name: "Excluir" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(h.deleteCliente).toHaveBeenCalled());
    expect(screen.queryByTestId("local")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ana Lima" })).toBeInTheDocument();
  });
});

describe("ClienteDetalhePage: portal do cliente", () => {
  it("verificando mostra o estado de espera", () => {
    h.detalhe = detalhe({ isLoadingPortal: true, portalStatus: undefined });
    renderPagina();
    expect(screen.getByText("Verificando...")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Criar acesso/ })).not.toBeInTheDocument();
  });

  it("criar acesso abre o diálogo de acesso com o e-mail do cadastro", async () => {
    const user = renderPagina();
    await user.click(screen.getByRole("button", { name: "Criar acesso ao portal" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent("acesso-portal:ana@seed.test");
  });

  it("coordenador também cuida do portal", () => {
    h.perm.isAdmin = false;
    h.perm.role = "coordenador";
    renderPagina();
    expect(screen.getByText("Portal do Cliente")).toBeInTheDocument();
  });

  it("com acesso: mostra quem entra e abre o diálogo para gerenciar", async () => {
    h.detalhe = detalhe({
      portalStatus: { exists: true, email: "ana@seed.test", emails: ["ana@seed.test", "maria@seed.test"] },
    });
    const user = renderPagina();
    expect(screen.getByText("2 pessoas com acesso ao portal")).toBeInTheDocument();
    expect(screen.getByText("ana@seed.test, maria@seed.test")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Gerenciar acessos" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent("acesso-portal:ana@seed.test");
  });
});

describe("ClienteDetalhePage: abas", () => {
  it("projetos: card com status, progresso, valor e previsão, linkando ao projeto", async () => {
    const user = renderPagina();
    await user.click(aba(/Projetos/));
    const link = screen.getByRole("link", { name: /Casa Ipê/ });
    expect(link).toHaveAttribute("href", "/projetos/pj1");
    expect(link).toHaveTextContent("25%");
    expect(link).toHaveTextContent("Previsão: 20/12/2026");
  });

  it("projeto sem disciplinas, valor ou previsão usa os rótulos de vazio", async () => {
    h.detalhe = detalhe({
      projetos: [{ ...PROJETO, total_disciplinas: 0, valor_contrato: null, data_previsao: null, status: "?" }],
    });
    const user = renderPagina();
    await user.click(aba(/Projetos/));
    const link = screen.getByRole("link", { name: /Casa Ipê/ });
    expect(link).toHaveTextContent("Sem valor");
    expect(link).toHaveTextContent("10/01/2026");
    expect(link).not.toHaveTextContent("Progresso");
  });

  it("propostas: card abre a lista de propostas", async () => {
    const user = renderPagina();
    await user.click(aba(/Propostas/));
    expect(screen.getByText("PRP-001")).toBeInTheDocument();
    expect(screen.getByText("01/10/2026")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Projeto executivo/ }));
    expect(screen.getByTestId("local")).toHaveTextContent("/gestao/propostas");
  });

  it("proposta com validade e valor mostra os dois", async () => {
    h.detalhe = detalhe({ propostas: [{ ...PROPOSTA, validade: "2026-11-30", valor_proposto: 5000, codigo: null }] });
    const user = renderPagina();
    await user.click(aba(/Propostas/));
    expect(screen.getByText("Validade: 30/11/2026")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s?5\.000/)).toBeInTheDocument();
  });

  it("sem projetos nem propostas mostra os vazios de cada aba", async () => {
    h.detalhe = detalhe({ projetos: [], propostas: [] });
    const user = renderPagina();
    await user.click(aba(/Projetos/));
    expect(screen.getByText("Nenhum projeto vinculado a este cliente.")).toBeInTheDocument();
    await user.click(aba(/Propostas/));
    expect(screen.getByText("Nenhuma proposta vinculada a este cliente.")).toBeInTheDocument();
    await user.click(aba(/Financeiro/));
    expect(screen.getByText("Nenhum projeto para exibir financeiro.")).toBeInTheDocument();
    await user.click(aba(/Entregas/));
    expect(screen.getByText("Nenhum projeto para exibir entregas.")).toBeInTheDocument();
  });

  it("carregando projetos/propostas não mostra vazio", async () => {
    h.detalhe = detalhe({ projetos: [], propostas: [], isLoadingProjetos: true, isLoadingPropostas: true });
    const user = renderPagina();
    for (const nome of [/Projetos/, /Propostas/, /Financeiro/, /Entregas/]) {
      await user.click(aba(nome));
      expect(screen.queryByText(/^Nenhum/)).not.toBeInTheDocument();
    }
  });

  it("financeiro: abre o projeto e carrega as receitas dele", async () => {
    h.resolve.mockImplementation((q) =>
      q.table === "receitas" ? { data: [{ id: "r1", descricao: "Parcela 1", valor: 1000 }] } : { data: [] }
    );
    const user = renderPagina();
    await user.click(aba(/Financeiro/));
    await user.click(screen.getByRole("button", { name: /Casa Ipê/ }));
    expect(await screen.findByText("Parcela 1")).toBeInTheDocument();
    const q = h.calls.find((c) => c.table === "receitas")!;
    expect(q.filters).toContainEqual(["eq", "projeto_id", "pj1"]);
    expect(q.filters).toContainEqual(["is", "deleted_at", null]);
  });

  it("financeiro: erro ao carregar receitas avisa", async () => {
    h.resolve.mockReturnValue({ data: null, error: { message: "permission denied" } });
    const user = renderPagina();
    await user.click(aba(/Financeiro/));
    await user.click(screen.getByRole("button", { name: /Casa Ipê/ }));
    await waitFor(() => expect(h.toastError).toHaveBeenCalledWith("Erro ao carregar receitas"));
  });

  it("entregas: quem pode editar cria entrega no projeto", async () => {
    const user = renderPagina();
    await user.click(aba(/Entregas/));
    await user.click(screen.getByRole("button", { name: /Casa Ipê/ }));
    expect(screen.getByText("Entregas de pj1")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Nova entrega" }));
    const dialog = screen.getByRole("dialog", { name: "Nova entrega" });
    expect(dialog).toHaveTextContent("pj1");
    await user.click(within(dialog).getByRole("button", { name: "Criar entrega" }));
    expect(screen.getByText("Entregas de pj1")).toBeInTheDocument();
  });

  it("entregas: sem permissão do portal não oferece nova entrega", async () => {
    h.perm = { isAdmin: false, edit: true, entregas: false, role: "user" };
    const user = renderPagina();
    await user.click(aba(/Entregas/));
    await user.click(screen.getByRole("button", { name: /Casa Ipê/ }));
    expect(screen.queryByRole("button", { name: "Nova entrega" })).not.toBeInTheDocument();
  });
});
