import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Proposta } from "@/hooks/usePropostas";

/**
 * Tela de Propostas: formulário de criar/editar, mudança de status, excluir
 * com confirmação e converter em projeto. Os hooks de dados são dublês; o
 * formulário, o detalhe e os diálogos são os reais.
 */

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    error: (...a: unknown[]) => toastError(...a),
    success: (...a: unknown[]) => toastSuccess(...a),
    info: vi.fn(),
  },
}));
vi.mock("@/lib/analytics", () => ({ analytics: { track: vi.fn() } }));

type MutateOpts = { onSuccess?: (data?: unknown) => void; onError?: (e: unknown) => void };
type Mut = { mutate: ReturnType<typeof vi.fn>; isPending: boolean };
const mut = (data?: unknown): Mut => ({
  mutate: vi.fn((_vars: unknown, opts?: MutateOpts) => opts?.onSuccess?.(data)),
  isPending: false,
});
const falharNoServidor = (m: Mut) =>
  m.mutate.mockImplementationOnce((_v: unknown, opts?: MutateOpts) => opts?.onError?.(new Error("boom")));

let propostas: Proposta[] = [];
let role = "admin";
let podeCriar = true;
let podeEditar = true;
let podeExcluir = true;
let mocks: Record<string, Mut> = {};
const navigate = vi.fn();

vi.mock("@/hooks/usePropostas", async (orig) => ({
  ...(await orig<typeof import("@/hooks/usePropostas")>()),
  usePropostas: () => ({ data: propostas, isLoading: false }),
  useCreateProposta: () => mocks.create,
  useUpdateProposta: () => mocks.update,
  useDeleteProposta: () => mocks.remove,
  useRestoreProposta: () => mocks.restore,
  useConverterProposta: () => mocks.converter,
  useSalvarPropostaDisciplinas: () => mocks.disciplinas,
  usePropostaDisciplinas: () => ({ data: [], isFetched: true }),
}));
vi.mock("@/hooks/useUserRole", () => ({ useUserRole: () => ({ data: role }) }));
vi.mock("@/hooks/useNivelConfianca", () => ({ useNivelConfianca: () => ({ isAdmin: true, limites: null }) }));
vi.mock("@/components/trial/DesbloqueioNivel", () => ({
  DesbloqueioNivel: ({ recurso, limite }: { recurso: string; limite: number | null }) => (
    <div data-testid="desbloqueio">{`${recurso}:${limite}`}</div>
  ),
}));
vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({
    can: (f: string, action?: string) => {
      if (f === "estimativa_obra") return false;
      if (action === "edit") return podeEditar;
      if (action === "delete") return podeExcluir;
      return podeCriar;
    },
    getButtonProps: () => ({ disabled: !podeCriar, title: "", "aria-disabled": !podeCriar }),
    isAdmin: role === "admin",
  }),
}));
vi.mock("@/lib/supabaseQueries", () => ({
  fetchClientesLookup: async () => [{ id: "c1", nome: "Alfa Engenharia" }],
  fetchLeadsLookup: async () => [{ id: "l1", nome: "Ana Lima" }],
}));
vi.mock("./components/TemplatesManager", () => ({ TemplatesManager: () => null }));
vi.mock("./components/GerarPropostaDialog", () => ({ GerarPropostaDialog: () => null }));
vi.mock("@/pages/propostas/components/SmartInvoiceDialog", () => ({
  SmartInvoiceDialog: ({ projetoId }: { projetoId: string }) => <div>Faturamento do projeto {projetoId}</div>,
}));
vi.mock("./components/CapacidadeSimulacao", () => ({ CapacidadeSimulacao: () => null }));
vi.mock("@/hooks/usePageTitle", () => ({ usePageTitle: vi.fn() }));
vi.mock("@/hooks/useRecentes", () => ({ useRegistrarPagina: vi.fn() }));
vi.mock("@/components/ui/sidebar", async (orig) => ({
  ...(await orig<typeof import("@/components/ui/sidebar")>()),
  useSidebar: () => ({ state: "expanded", isMobile: false, open: true, setOpenMobile: vi.fn() }),
}));
vi.mock("@/components/ModuleChipNav", () => ({ ModuleChipNav: () => null }));
vi.mock("react-router-dom", async (orig) => ({
  ...(await orig<typeof import("react-router-dom")>()),
  useNavigate: () => navigate,
}));

import Propostas from "./index";

const base = (p: Partial<Proposta>): Proposta => ({
  id: "p1",
  empresa_id: "e1",
  lead_id: null,
  cliente_id: "c1",
  codigo: "PROP-007",
  titulo: "Residência Almeida",
  area_m2: 320,
  localizacao: null,
  valor_proposto: 120000,
  custo_estimado: null,
  margem_estimada_pct: null,
  prazo_estimado_dias: 90,
  status: "rascunho",
  validade: "2099-12-31",
  projeto_id: null,
  dados_simulacao: null,
  observacao: null,
  contrato_enviado: false,
  contrato_assinado: false,
  contrato_recusado: false,
  created_at: "2026-10-01T10:00:00Z",
  cliente_nome: "Alfa Engenharia",
  ...p,
});

beforeEach(() => {
  vi.clearAllMocks();
  propostas = [
    base({}),
    base({ id: "p2", codigo: "PROP-008", titulo: "Galpão Logístico", status: "enviada", cliente_nome: "Beta" }),
  ];
  role = "admin";
  podeCriar = true;
  podeEditar = true;
  podeExcluir = true;
  mocks = {
    create: mut({ id: "nova" }),
    update: mut(),
    remove: mut(),
    restore: mut(),
    converter: mut("proj-9"),
    disciplinas: mut(),
  };
});

const abrir = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <Propostas />
      </MemoryRouter>
    </QueryClientProvider>
  );

const novaProposta = () => screen.getAllByRole("button", { name: /Nova proposta/ })[0];
const form = () => screen.getByRole("dialog", { name: /proposta/i });

describe("Propostas: criar", () => {
  it("sugere o próximo código, converte o valor e grava validade padrão de 30 dias", async () => {
    const user = userEvent.setup();
    abrir();

    await user.click(novaProposta());
    const f = form();
    expect(within(f).getByLabelText("Código")).toHaveValue("PROP-009");
    await user.type(within(f).getByLabelText("Título *"), "Clínica Sul");
    await user.type(within(f).getByLabelText("Valor Proposto"), "8500000");
    await user.type(within(f).getByLabelText("Prazo (dias)"), "60");
    await user.click(within(f).getByRole("button", { name: "Criar proposta" }));

    expect(mocks.create.mutate).toHaveBeenCalledTimes(1);
    const payload = mocks.create.mutate.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).toMatchObject({
      titulo: "Clínica Sul",
      codigo: "PROP-009",
      valor_proposto: 85000,
      prazo_estimado_dias: 60,
    });
    expect(payload.validade).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(payload.validade! > new Date().toISOString().slice(0, 10)).toBe(true);
    // Sem disciplinas, não chama o RPC de disciplinas.
    expect(mocks.disciplinas.mutate).not.toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalledWith("Proposta criada");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("sem título não grava (mesmo com valor preenchido)", async () => {
    const user = userEvent.setup();
    abrir();

    await user.click(novaProposta());
    const f = form();
    await user.type(within(f).getByLabelText("Valor Proposto"), "1000");
    await user.click(within(f).getByRole("button", { name: "Criar proposta" }));

    expect(toastError).toHaveBeenCalledWith("Título é obrigatório");
    expect(mocks.create.mutate).not.toHaveBeenCalled();
    expect(form()).toBeInTheDocument();
  });

  it("título só com espaços conta como vazio", async () => {
    const user = userEvent.setup();
    abrir();
    await user.click(novaProposta());
    await user.type(within(form()).getByLabelText("Título *"), "   ");
    await user.click(within(form()).getByRole("button", { name: "Criar proposta" }));
    expect(mocks.create.mutate).not.toHaveBeenCalled();
  });

  it("código já usado (qualquer caixa) avisa no campo e bloqueia", async () => {
    const user = userEvent.setup();
    abrir();
    await user.click(novaProposta());
    const f = form();
    const codigo = within(f).getByLabelText("Código");
    await user.clear(codigo);
    await user.type(codigo, "prop-007");
    await user.type(within(f).getByLabelText("Título *"), "Outra");

    expect(within(f).getByText("Já existe uma proposta com este código.")).toBeInTheDocument();
    await user.click(within(f).getByRole("button", { name: "Criar proposta" }));
    expect(toastError).toHaveBeenCalledWith("Já existe uma proposta com esse código");
    expect(mocks.create.mutate).not.toHaveBeenCalled();
  });

  it("valor e prazo não aceitam negativo", async () => {
    const user = userEvent.setup();
    abrir();
    await user.click(novaProposta());
    const f = form();
    await user.type(within(f).getByLabelText("Título *"), "X");
    await user.type(within(f).getByLabelText("Valor Proposto"), "-500");
    await user.type(within(f).getByLabelText("Prazo (dias)"), "-10");
    await user.click(within(f).getByRole("button", { name: "Criar proposta" }));

    const payload = mocks.create.mutate.mock.calls[0][0] as Record<string, unknown>;
    // Dinheiro só aceita dígitos e o prazo é travado em zero: nada negativo chega ao banco.
    expect(payload.valor_proposto).toBe(5);
    expect(payload.prazo_estimado_dias ?? 0).toBeGreaterThanOrEqual(0);
  });

  it("erro do servidor avisa e mantém o formulário com os dados", async () => {
    falharNoServidor(mocks.create);
    const user = userEvent.setup();
    abrir();
    await user.click(novaProposta());
    await user.type(within(form()).getByLabelText("Título *"), "Clínica Sul");
    await user.click(within(form()).getByRole("button", { name: "Criar proposta" }));

    expect(toastError).toHaveBeenCalledWith("Erro ao criar");
    expect(within(form()).getByLabelText("Título *")).toHaveValue("Clínica Sul");
  });

  it("vincular a lead troca o vínculo (não manda cliente junto)", async () => {
    const user = userEvent.setup();
    abrir();
    await user.click(novaProposta());
    const f = form();
    await user.type(within(f).getByLabelText("Título *"), "X");
    await user.click(within(f).getByRole("radio", { name: "Lead (prospecto)" }));
    expect(within(f).getByRole("combobox", { name: "Lead" })).toBeInTheDocument();
    expect(within(f).queryByRole("combobox", { name: "Cliente" })).not.toBeInTheDocument();
    await user.click(within(f).getByRole("button", { name: "Criar proposta" }));

    const payload = mocks.create.mutate.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.cliente_id).toBeUndefined();
  });
});

describe("Propostas: detalhe, editar, status e excluir", () => {
  const abrirDetalhe = async (user: ReturnType<typeof userEvent.setup>, titulo: string) => {
    await user.click(screen.getAllByText(titulo)[0]);
    return screen.getByRole("dialog");
  };

  it("editar abre o formulário preenchido e salva pelo id", async () => {
    const user = userEvent.setup();
    abrir();
    const det = await abrirDetalhe(user, "Residência Almeida");
    await user.click(within(det).getByRole("button", { name: "Editar" }));

    const f = form();
    expect(within(f).getByLabelText("Título *")).toHaveValue("Residência Almeida");
    await user.clear(within(f).getByLabelText("Título *"));
    await user.type(within(f).getByLabelText("Título *"), "Residência Almeida II");
    await user.click(within(f).getByRole("button", { name: "Salvar alterações" }));

    expect(mocks.update.mutate.mock.calls[0][0]).toMatchObject({
      id: "p1",
      titulo: "Residência Almeida II",
      codigo: "PROP-007",
      valor_proposto: 120000,
    });
    // Em edição, as disciplinas são sempre regravadas (para refletir remoções).
    expect(mocks.disciplinas.mutate).toHaveBeenCalledWith({ propostaId: "p1", disciplinas: [] }, expect.anything());
    expect(toastSuccess).toHaveBeenCalledWith("Proposta atualizada");
  });

  it("editar apagando o título não grava", async () => {
    const user = userEvent.setup();
    abrir();
    const det = await abrirDetalhe(user, "Residência Almeida");
    await user.click(within(det).getByRole("button", { name: "Editar" }));
    await user.clear(within(form()).getByLabelText("Título *"));
    await user.click(within(form()).getByRole("button", { name: "Salvar alterações" }));
    expect(mocks.update.mutate).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("Título é obrigatório");
  });

  it("falha ao gravar as disciplinas avisa mas a proposta conta como salva", async () => {
    falharNoServidor(mocks.disciplinas);
    const user = userEvent.setup();
    abrir();
    const det = await abrirDetalhe(user, "Residência Almeida");
    await user.click(within(det).getByRole("button", { name: "Editar" }));
    await user.click(within(form()).getByRole("button", { name: "Salvar alterações" }));
    expect(toastError).toHaveBeenCalledWith("Proposta salva, mas houve erro ao salvar as disciplinas");
    expect(toastSuccess).toHaveBeenCalledWith("Proposta atualizada");
  });

  it("enviar manualmente muda o status para enviada", async () => {
    const user = userEvent.setup();
    abrir();
    const det = await abrirDetalhe(user, "Residência Almeida");
    await user.click(within(det).getByRole("button", { name: "Enviei manualmente" }));
    expect(mocks.update.mutate).toHaveBeenCalledWith({ id: "p1", status: "enviada" }, expect.anything());
    expect(toastSuccess).toHaveBeenCalledWith("Proposta Enviada");
  });

  it("aceitar proposta enviada muda para aceita; recusar pede confirmação", async () => {
    const user = userEvent.setup();
    abrir();
    const det = await abrirDetalhe(user, "Galpão Logístico");

    await user.click(within(det).getByRole("button", { name: "Recusada" }));
    expect(mocks.update.mutate).not.toHaveBeenCalled();
    const confirm = screen.getByRole("alertdialog");
    await user.click(within(confirm).getByRole("button", { name: "Marcar recusada" }));
    expect(mocks.update.mutate).toHaveBeenCalledWith({ id: "p2", status: "recusada" }, expect.anything());

    await user.click(within(det).getByRole("button", { name: "Aceita" }));
    expect(mocks.update.mutate).toHaveBeenCalledWith({ id: "p2", status: "aceita" }, expect.anything());
  });

  it("erro ao mudar status avisa", async () => {
    falharNoServidor(mocks.update);
    const user = userEvent.setup();
    abrir();
    const det = await abrirDetalhe(user, "Residência Almeida");
    await user.click(within(det).getByRole("button", { name: "Enviei manualmente" }));
    expect(toastError).toHaveBeenCalledWith("Erro");
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("excluir pede confirmação e oferece desfazer", async () => {
    const user = userEvent.setup();
    abrir();
    const det = await abrirDetalhe(user, "Residência Almeida");
    await user.click(within(det).getByRole("button", { name: "Excluir" }));
    expect(mocks.remove.mutate).not.toHaveBeenCalled();

    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Excluir" }));

    expect(mocks.remove.mutate).toHaveBeenCalledWith("p1", expect.anything());
    const [titulo, opts] = toastSuccess.mock.calls.at(-1) as [string, { action: { onClick: () => void } }];
    expect(titulo).toBe("Proposta removida");
    opts.action.onClick();
    expect(mocks.restore.mutate).toHaveBeenCalledWith("p1", expect.anything());
  });

  it("erro ao excluir avisa", async () => {
    falharNoServidor(mocks.remove);
    const user = userEvent.setup();
    abrir();
    const det = await abrirDetalhe(user, "Residência Almeida");
    await user.click(within(det).getByRole("button", { name: "Excluir" }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Excluir" }));
    expect(toastError).toHaveBeenCalledWith("Erro ao remover");
  });
});

describe("Propostas: converter em projeto", () => {
  it("aceitar e criar projeto chama o RPC e abre o faturamento do projeto novo", async () => {
    const user = userEvent.setup();
    abrir();
    await user.click(screen.getAllByText("Galpão Logístico")[0]);
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Aceitar e criar projeto" }));

    const dlg = screen.getByRole("dialog", { name: /Converter em Projeto/ });
    await user.click(within(dlg).getByRole("button", { name: "Criar projeto" }));

    expect(mocks.converter.mutate).toHaveBeenCalledWith("p2", expect.anything());
    expect(toastSuccess).toHaveBeenCalledWith("Projeto criado!", expect.anything());
    expect(screen.getByText("Faturamento do projeto proj-9")).toBeInTheDocument();
  });

  it("erro na conversão avisa e não abre o faturamento", async () => {
    falharNoServidor(mocks.converter);
    const user = userEvent.setup();
    abrir();
    await user.click(screen.getAllByText("Galpão Logístico")[0]);
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Aceitar e criar projeto" }));
    await user.click(
      within(screen.getByRole("dialog", { name: /Converter em Projeto/ })).getByRole("button", {
        name: "Criar projeto",
      })
    );

    expect(toastError).toHaveBeenCalledWith("Erro na conversão");
    expect(screen.queryByText(/Faturamento do projeto/)).not.toBeInTheDocument();
  });

  it("no limite de projetos do plano abre o diálogo de limite, não o erro genérico", async () => {
    mocks.converter.mutate.mockImplementationOnce((_v: unknown, opts?: MutateOpts) =>
      opts?.onError?.({ message: "capacidade:projetos", hint: "10" })
    );
    const user = userEvent.setup();
    abrir();
    await user.click(screen.getAllByText("Galpão Logístico")[0]);
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Aceitar e criar projeto" }));
    await user.click(
      within(screen.getByRole("dialog", { name: /Converter em Projeto/ })).getByRole("button", {
        name: "Criar projeto",
      })
    );

    expect(toastError).not.toHaveBeenCalledWith("Erro na conversão");
    expect(screen.getByTestId("desbloqueio")).toHaveTextContent("projetos:10");
  });
});

describe("Propostas: lista, filtros e permissão", () => {
  it("sem propostas mostra o vazio", () => {
    propostas = [];
    abrir();
    expect(screen.getByText("Nenhuma proposta cadastrada")).toBeInTheDocument();
  });

  it("busca ignora acento e caixa; sem resultado oferece limpar", async () => {
    const user = userEvent.setup();
    abrir();
    const busca = screen.getAllByPlaceholderText("Buscar por título ou cliente")[0];

    await user.type(busca, "GALPAO");
    expect(screen.getAllByText("Galpão Logístico").length).toBeGreaterThan(0);
    expect(screen.queryByText("Residência Almeida")).not.toBeInTheDocument();

    await user.clear(busca);
    await user.type(busca, "zzz");
    expect(screen.getByText("Nenhuma proposta encontrada")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(screen.getAllByText("Residência Almeida").length).toBeGreaterThan(0);
  });

  it("proposta com validade vencida aparece como expirada", () => {
    propostas = [base({ validade: "2020-01-01" })];
    abrir();
    expect(screen.getAllByText("Expirada").length).toBeGreaterThan(0);
  });

  it("sem permissão de edição no módulo não edita, não muda status nem exclui pelo detalhe", async () => {
    podeEditar = false;
    podeExcluir = false;
    const user = userEvent.setup();
    abrir();
    await user.click(screen.getAllByText("Residência Almeida")[0]);
    const det = screen.getByRole("dialog");
    expect(within(det).queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
    expect(within(det).queryByRole("button", { name: "Excluir" })).not.toBeInTheDocument();
    expect(within(det).queryByRole("button", { name: "Enviei manualmente" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mais opções" })).not.toBeInTheDocument();
  });

  it("sem permissão de edição, proposta enviada não oferece Aceita/Recusada", async () => {
    podeEditar = false;
    const user = userEvent.setup();
    abrir();
    await user.click(screen.getAllByText("Galpão Logístico")[0]);
    const det = screen.getByRole("dialog");
    expect(within(det).queryByRole("button", { name: "Aceita" })).not.toBeInTheDocument();
    expect(within(det).queryByRole("button", { name: "Recusada" })).not.toBeInTheDocument();
    expect(mocks.update.mutate).not.toHaveBeenCalled();
  });

  it("permissão segue o módulo, não o role: membro com edição muda status", async () => {
    role = "membro";
    const user = userEvent.setup();
    abrir();
    await user.click(screen.getAllByText("Residência Almeida")[0]);
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Enviei manualmente" }));
    expect(mocks.update.mutate).toHaveBeenCalledWith({ id: "p1", status: "enviada" }, expect.anything());
  });

  it("edita mas não exclui: Excluir some do detalhe e do menu da linha", async () => {
    podeExcluir = false;
    const user = userEvent.setup();
    abrir();
    expect(screen.queryByRole("button", { name: "Mais opções" })).not.toBeInTheDocument();
    await user.click(screen.getAllByText("Residência Almeida")[0]);
    const det = screen.getByRole("dialog");
    expect(within(det).getByRole("button", { name: "Editar" })).toBeInTheDocument();
    expect(within(det).queryByRole("button", { name: "Excluir" })).not.toBeInTheDocument();
  });

  it("sem permissão no módulo, Nova proposta fica travada", () => {
    podeCriar = false;
    abrir();
    expect(novaProposta()).toBeDisabled();
  });
});
