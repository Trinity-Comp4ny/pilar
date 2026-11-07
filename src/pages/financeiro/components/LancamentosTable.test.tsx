import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { sb } from "../testing/supabaseMock";
import type { Lancamento } from "../hooks/useLancamentosUnified";
import { defaultFilters } from "./lancamentosFilters";

// Ações sobre lançamentos na lista (layout mobile, que não é virtualizado):
// marcar como pago/recebido com a data real, excluir com confirmação, erro do
// servidor e quem não pode editar.

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("../testing/supabaseMock")).sb.client,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => true }));

const acesso = { canEdit: true };
vi.mock("@/hooks/useFeatureAccess", () => ({
  useFeatureAccess: () => ({ canView: true, canEdit: acesso.canEdit, isViewerOnly: !acesso.canEdit, isAdmin: false }),
}));

let itens: Lancamento[] = [];
vi.mock("../hooks/useLancamentosPaginados", () => ({
  useLancamentosPaginados: () => ({
    data: itens,
    isLoading: false,
    isFetching: false,
    isFetchingNextPage: false,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
  }),
}));
vi.mock("../hooks/useLancamentosFiltersData", () => ({
  useLancamentosFiltersData: () => ({ categorias: [], projetos: [], clientes: [], fornecedores: [], contas: [] }),
}));
vi.mock("../hooks/useGruposParcelaResumo", () => ({ useGruposParcelaResumo: () => new Map() }));
vi.mock("../hooks/useParcelasDosGrupos", () => ({ useParcelasDosGrupos: () => new Map() }));
vi.mock("./LancamentosFilterBar", () => ({ LancamentosFilterBar: () => null }));
// Detalhe simplificado: expõe o "Excluir" que a tabela recebe.
vi.mock("./LancamentoDetailDialog", () => ({
  LancamentoDetailDialog: ({
    lancamento,
    open,
    onDelete,
  }: {
    lancamento: Lancamento | null;
    open: boolean;
    onDelete: (l: Lancamento) => void;
  }) =>
    open && lancamento ? (
      <button type="button" onClick={() => onDelete(lancamento)}>
        detalhe-excluir
      </button>
    ) : null,
}));

import { toast } from "sonner";
import { LancamentosTable } from "./LancamentosTable";

const TZ_ORIGINAL = process.env.TZ;
beforeAll(() => {
  process.env.TZ = "America/Sao_Paulo";
});
afterAll(() => {
  process.env.TZ = TZ_ORIGINAL;
});

function lanc(p: Partial<Lancamento>): Lancamento {
  return {
    id: "d-1",
    tipo: "despesa",
    data_vencimento: "2026-11-05",
    data_efetivacao: null,
    data_competencia: null,
    descricao: "Aluguel",
    valor: 3000,
    status: "Pendente",
    categoria_id: null,
    categoria_nome: null,
    projeto_id: null,
    projeto_nome: null,
    centro_custo_id: null,
    conta_id: null,
    conta_nome: null,
    contraparte_id: null,
    contraparte_tipo: null,
    contraparte_nome: null,
    forma_pagamento: null,
    cartao_id: null,
    parcela_numero: null,
    parcela_total: null,
    grupo_parcela: null,
    grupo_tipo: null,
    grupo_status: null,
    grupo_total_original: null,
    tags: null,
    transferencia_par_id: null,
    ...p,
  };
}

const resumo = {
  totalCount: 0,
  recebido: 0,
  aReceber: 0,
  pago: 0,
  aPagar: 0,
  receitas: 0,
  despesas: 0,
  saldo: 0,
  atrasadosCount: 0,
};

function setup() {
  const onMutated = vi.fn();
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <LancamentosTable resumo={resumo} filters={defaultFilters} onFiltersChange={vi.fn()} onMutated={onMutated} />
    </QueryClientProvider>
  );
  return { onMutated };
}

// A ação fica aria-hidden até a linha ser deslizada; localiza pelo texto.
const botaoMarcar = (nome: string) => screen.getByText(nome).closest("button") as HTMLButtonElement;

beforeEach(() => {
  vi.clearAllMocks();
  sb.reset();
  acesso.canEdit = true;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 10, 22, 30)); // 22h30 em SP: em UTC já é dia 11
  sb.resultado("despesas.update", { data: null, error: null });
  sb.resultado("receitas.update", { data: null, error: null });
  sb.resultado("despesas.delete", { data: null, error: null });
  sb.resultado("receitas.delete", { data: null, error: null });
});
afterEach(() => vi.useRealTimers());

describe("LancamentosTable: marcar pago/recebido", () => {
  it("despesa: pede a data (hoje local) e grava Pago com a data de pagamento", async () => {
    itens = [lanc({})];
    const { onMutated } = setup();
    fireEvent.click(botaoMarcar("Marcar pago"));
    expect(screen.getByRole("heading", { name: "Confirmar recebimento/pagamento" })).toBeInTheDocument();
    expect(sb.de("despesas", "update")).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(onMutated).toHaveBeenCalled());
    expect(sb.de("despesas", "update")[0].args[0]).toEqual({ status: "Pago", data_pagamento: "2026-11-10" });
    expect(sb.de("despesas", "eq")[0].args).toEqual(["id", "d-1"]);
    expect(toast.success).toHaveBeenCalledWith("Status atualizado");
  });

  it("receita: grava Recebido com a data de recebimento", async () => {
    itens = [lanc({ id: "r-1", tipo: "receita", descricao: "Honorários" })];
    const { onMutated } = setup();
    fireEvent.click(botaoMarcar("Marcar recebido"));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(onMutated).toHaveBeenCalled());
    expect(sb.de("receitas", "update")[0].args[0]).toEqual({ status: "Recebido", data_recebimento: "2026-11-10" });
  });

  it("cancelar a confirmação não grava", () => {
    itens = [lanc({})];
    setup();
    fireEvent.click(botaoMarcar("Marcar pago"));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(sb.de("despesas", "update")).toHaveLength(0);
  });

  it("erro do servidor avisa e mantém a confirmação aberta", async () => {
    sb.resultado("despesas.update", { data: null, error: { message: "permission denied" } });
    itens = [lanc({})];
    const { onMutated } = setup();
    fireEvent.click(botaoMarcar("Marcar pago"));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Não foi possível atualizar o status", expect.anything())
    );
    expect(onMutated).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Confirmar recebimento/pagamento" })).toBeInTheDocument();
  });

  it("já pago, transferência ou sem permissão: não oferece marcar", () => {
    itens = [
      lanc({ id: "a", status: "Pago", data_efetivacao: "2026-11-01" }),
      lanc({ id: "b", tipo: "transferencia", descricao: "Reserva" }),
    ];
    setup();
    expect(screen.queryByText("Marcar pago")).not.toBeInTheDocument();
  });

  it("sem permissão de edição não oferece marcar", () => {
    acesso.canEdit = false;
    itens = [lanc({})];
    setup();
    expect(screen.queryByText("Marcar pago")).not.toBeInTheDocument();
  });
});

describe("LancamentosTable: excluir", () => {
  function abrirExclusao(descricao: string) {
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${descricao},`) }));
    fireEvent.click(screen.getByRole("button", { name: "detalhe-excluir" }));
    return screen.getByRole("alertdialog");
  }

  it("despesa: confirma e exclui pelo id", async () => {
    itens = [lanc({})];
    const { onMutated } = setup();
    const dlg = abrirExclusao("Aluguel");
    expect(within(dlg).getByText("Excluir despesa")).toBeInTheDocument();
    expect(sb.de("despesas", "delete")).toHaveLength(0);
    fireEvent.click(within(dlg).getByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(onMutated).toHaveBeenCalled());
    expect(sb.de("despesas", "eq")[0].args).toEqual(["id", "d-1"]);
    expect(toast.success).toHaveBeenCalledWith("Lançamento excluído");
  });

  it("parcela avisa que só ela será excluída", () => {
    itens = [lanc({ grupo_parcela: "g1", parcela_numero: 2, parcela_total: 3 })];
    setup();
    const dlg = abrirExclusao("Aluguel");
    expect(
      within(dlg).getByText("Esta é uma parcela de um grupo. Apenas esta parcela será excluída.")
    ).toBeInTheDocument();
  });

  it("transferência usa a RPC de exclusão (apaga os dois lados)", async () => {
    sb.rpcResultado("rpc_excluir_transferencia", { data: null, error: null });
    itens = [lanc({ id: "t-1", tipo: "transferencia", descricao: "Reserva" })];
    const { onMutated } = setup();
    const dlg = abrirExclusao("Reserva");
    fireEvent.click(within(dlg).getByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(onMutated).toHaveBeenCalled());
    expect(sb.argsRpc("rpc_excluir_transferencia")).toEqual({ p_id: "t-1" });
    expect(sb.de("despesas", "delete")).toHaveLength(0);
  });

  it("cancelar não exclui", () => {
    itens = [lanc({})];
    setup();
    const dlg = abrirExclusao("Aluguel");
    fireEvent.click(within(dlg).getByRole("button", { name: "Cancelar" }));
    expect(sb.de("despesas", "delete")).toHaveLength(0);
  });

  it("erro do servidor avisa e não recarrega", async () => {
    sb.resultado("despesas.delete", { data: null, error: { message: "foreign key" } });
    itens = [lanc({})];
    const { onMutated } = setup();
    const dlg = abrirExclusao("Aluguel");
    fireEvent.click(within(dlg).getByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Falha ao excluir", { description: "foreign key" }));
    expect(onMutated).not.toHaveBeenCalled();
  });
});
