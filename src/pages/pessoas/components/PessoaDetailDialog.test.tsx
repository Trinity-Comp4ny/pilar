import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ChainQuery, ChainResult } from "@/test/supabaseChain";
import type { Pessoa } from "../types";
import { PessoaDetailDialog } from "./PessoaDetailDialog";

/**
 * Detalhe da pessoa: PII (CPF, salário, contas) só aparece para quem pode ver
 * folha; metas vêm da tabela e o progresso calculado do RPC tem precedência.
 */

const h = vi.hoisted(() => ({
  resolve: vi.fn<(q: ChainQuery) => ChainResult>(),
  rpc: vi.fn(),
  calls: [] as ChainQuery[],
}));

vi.mock("@/integrations/supabase/client", async () => {
  const { createSupabaseFrom } = await import("@/test/supabaseChain");
  const chain = createSupabaseFrom((q) => h.resolve(q));
  h.calls = chain.calls;
  return { supabase: { from: chain.from, rpc: h.rpc } };
});
// Acesso à Pilar tem teste próprio (PessoaAcessoSecao.test.tsx).
vi.mock("./PessoaAcessoSecao", () => ({ PessoaAcessoSecao: () => null }));

const RITA: Pessoa = {
  id: "p1",
  nome: "Rita Alves",
  cpf: "529.982.247-25",
  rg: "12.345.678-9",
  tipo_contrato: "clt",
  cargo: "Arquiteta",
  telefone: "(11) 90000-0000",
  email: "rita@seed.test",
  data_nascimento: "1990-03-15",
  data_admissao: "2024-01-02",
  salario_fixo: 8500,
  pis_nit: "123.45678.90-1",
  contas_bancarias: [
    { banco: "Banco Seed", agencia: "0001", conta: "12345-6", tipo: "corrente", is_primary: true },
    { banco: "Outro Banco", agencia: "0002", conta: "999-0", tipo: "poupanca", is_primary: false },
  ],
  pode_ver_sensivel: true,
};

function renderDialog(props: Partial<Parameters<typeof PessoaDetailDialog>[0]> = {}) {
  const handlers = { onEdit: vi.fn(), onDelete: vi.fn(), onOpenChange: vi.fn() };
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const utils = render(
    <QueryClientProvider client={qc}>
      <PessoaDetailDialog open pessoa={RITA} isAdmin={false} {...handlers} {...props} />
    </QueryClientProvider>
  );
  return { ...handlers, ...utils, user: userEvent.setup() };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.calls.length = 0;
  h.resolve.mockReturnValue({ data: [] });
  h.rpc.mockResolvedValue({ data: [], error: null });
});

describe("PessoaDetailDialog", () => {
  it("sem pessoa não renderiza nada", () => {
    const { container } = renderDialog({ pessoa: null });
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("quem pode ver folha revela o CPF sob ação e vê salário e contas", async () => {
    const { user } = renderDialog();
    expect(screen.getByText("***.***.***-25")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Mostrar CPF" }));
    expect(screen.getByText("529.982.247-25")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ocultar CPF" }));
    expect(screen.queryByText("529.982.247-25")).not.toBeInTheDocument();

    expect(screen.getByText("R$ 8.500,00")).toBeInTheDocument();
    expect(screen.getByText("Banco Seed")).toBeInTheDocument();
    expect(screen.getByText("Principal")).toBeInTheDocument();
    expect(screen.getByText("15/03/1990")).toBeInTheDocument();
    expect(screen.getByText("Dados CLT")).toBeInTheDocument();
    // Valor m² ausente vira traço.
    expect(screen.getAllByText("-").length).toBeGreaterThan(0);
  });

  it("sem permissão de folha: CPF não pode ser revelado e salário/contas somem", () => {
    renderDialog({ pessoa: { ...RITA, pode_ver_sensivel: false } });
    expect(screen.getByText("***.***.***-25")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mostrar CPF" })).not.toBeInTheDocument();
    expect(screen.queryByText("Salário Fixo")).not.toBeInTheDocument();
    expect(screen.queryByText("Contas Bancárias")).not.toBeInTheDocument();
  });

  it("PJ mostra dados da empresa; conta vazia mostra o estado vazio", () => {
    renderDialog({
      pessoa: {
        ...RITA,
        tipo_contrato: "pj",
        cpf: "",
        cnpj: "11.222.333/0001-81",
        razao_social: "Rita Arquitetura",
        contas_bancarias: [],
        data_demissao: "2026-05-31",
        status: "inativo",
      },
    });
    expect(screen.getByText("Dados PJ")).toBeInTheDocument();
    expect(screen.getByText("Rita Arquitetura")).toBeInTheDocument();
    expect(screen.queryByText("Dados CLT")).not.toBeInTheDocument();
    expect(screen.getByText("31/05/2026")).toBeInTheDocument();
    expect(screen.getByText("Nenhuma conta bancária cadastrada")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /CPF/ })).not.toBeInTheDocument();
  });

  it("metas da pessoa usam o progresso do RPC quando existe", async () => {
    h.resolve.mockImplementation((q) =>
      q.table === "metas"
        ? {
            data: [
              {
                id: "m1",
                nome: "Entregas",
                alvo: 10,
                atual: 1,
                prazo: "2026-12-31",
                unidade: "quantity",
                unidade_rotulo: "entregas",
                indicador: null,
              },
              {
                id: "m2",
                nome: "Receita",
                alvo: 1000,
                atual: 1000,
                prazo: null,
                unidade: "currency",
                unidade_rotulo: null,
                indicador: null,
              },
            ],
          }
        : { data: [] }
    );
    h.rpc.mockResolvedValue({ data: [{ meta_id: "m1", atual: 5 }], error: null });
    renderDialog();
    expect(await screen.findByText("Entregas")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("50%")).toBeInTheDocument());
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getByText("Prazo: 31/12/2026")).toBeInTheDocument();
    const metas = h.calls.find((c) => c.table === "metas")!;
    expect(metas.filters).toContainEqual(["eq", "pessoa_id", "p1"]);
    expect(metas.filters).toContainEqual(["is", "deleted_at", null]);
  });

  it("erro ao carregar metas cai no estado vazio sem quebrar o diálogo", async () => {
    h.resolve.mockReturnValue({ data: null, error: { message: "permission denied for table metas" } });
    h.rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    renderDialog();
    await waitFor(() => expect(h.calls.some((c) => c.table === "metas")).toBe(true));
    expect(screen.getByText("Nenhuma meta para esta pessoa")).toBeInTheDocument();
    expect(screen.getByText("Rita Alves")).toBeInTheDocument();
  });

  it("fechado não consulta metas", () => {
    renderDialog({ open: false });
    expect(h.calls).toHaveLength(0);
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("ações de editar/excluir só para admin", async () => {
    const { user, onEdit, onDelete, unmount } = renderDialog({ isAdmin: true });
    await user.click(screen.getByRole("button", { name: "Editar" }));
    expect(onEdit).toHaveBeenCalledWith(RITA);
    await user.click(screen.getByRole("button", { name: "Excluir" }));
    expect(onDelete).toHaveBeenCalledWith("p1");
    unmount();
    renderDialog({ isAdmin: false });
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
  });
});
