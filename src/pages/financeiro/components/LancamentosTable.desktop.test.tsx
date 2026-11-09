import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { sb } from "../testing/supabaseMock";
import type { Lancamento } from "../hooks/useLancamentosUnified";
import type { GrupoParcelaResumo } from "../hooks/useGruposParcelaResumo";
import { defaultFilters, type LancamentosFilters } from "./lancamentosFilters";

// Tabela de lançamentos no desktop (virtualizada): linhas de item e de grupo de
// parcelas, ordenação pelo cabeçalho, seleção e ações em massa, troca de status
// pelo badge, editar/excluir pela linha, estados vazios e "Carregar mais".
// O virtualizador é substituído por um que entrega todas as linhas (o jsdom não
// mede altura, então o real não renderizaria nenhuma).

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("../testing/supabaseMock")).sb.client,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({ index, start: 56 + index * 56, end: 56 + (index + 1) * 56 })),
    getTotalSize: () => (count + 2) * 56,
    measureElement: () => {},
  }),
}));

const acesso = { canEdit: true };
vi.mock("@/hooks/useFeatureAccess", () => ({
  useFeatureAccess: () => ({ canView: true, canEdit: acesso.canEdit, isViewerOnly: !acesso.canEdit, isAdmin: false }),
}));

const pag = {
  itens: [] as Lancamento[],
  isLoading: false,
  hasNextPage: false,
  fetchNextPage: vi.fn(),
  args: [] as { sortKey: string; sortDir: string }[],
};
vi.mock("../hooks/useLancamentosPaginados", () => ({
  useLancamentosPaginados: (a: { sortKey: string; sortDir: string }) => {
    pag.args.push(a);
    return {
      data: pag.itens,
      isLoading: pag.isLoading,
      isFetching: false,
      isFetchingNextPage: false,
      hasNextPage: pag.hasNextPage,
      fetchNextPage: pag.fetchNextPage,
      refetch: vi.fn(),
    };
  },
}));
vi.mock("../hooks/useLancamentosFiltersData", () => ({
  useLancamentosFiltersData: () => ({
    categorias: [{ id: "c1", nome: "Aluguel" }],
    projetos: [],
    clientes: [],
    fornecedores: [],
    contas: [],
  }),
}));
let resumos = new Map<string, GrupoParcelaResumo>();
vi.mock("../hooks/useGruposParcelaResumo", () => ({ useGruposParcelaResumo: () => resumos }));
let parcelasPlano = new Map<string, Lancamento[]>();
vi.mock("../hooks/useParcelasDosGrupos", () => ({ useParcelasDosGrupos: () => parcelasPlano }));
vi.mock("./LancamentosFilterBar", () => ({
  LancamentosFilterBar: (p: {
    grouped: boolean;
    allExpanded: boolean;
    onToggleGrouped: () => void;
    onToggleExpandAll: () => void;
    onReset: () => void;
    onChange: (patch: Partial<LancamentosFilters>) => void;
  }) => (
    <div>
      <button type="button" onClick={p.onToggleGrouped}>
        {p.grouped ? "desagrupar" : "agrupar"}
      </button>
      <button type="button" onClick={p.onToggleExpandAll}>
        {p.allExpanded ? "recolher-todos" : "expandir-todos"}
      </button>
      <button type="button" onClick={p.onReset}>
        reset-filtros
      </button>
      <button type="button" onClick={() => p.onChange({ search: "x" })}>
        buscar-x
      </button>
    </div>
  ),
}));
vi.mock("./LancamentoDetailDialog", () => ({
  LancamentoDetailDialog: ({
    lancamento,
    open,
    onEditInTab,
    onOpenChange,
  }: {
    lancamento: Lancamento | null;
    open: boolean;
    onEditInTab: (l: Lancamento) => void;
    onOpenChange: (v: boolean) => void;
  }) =>
    open && lancamento ? (
      <div>
        <span>detalhe:{lancamento.descricao}</span>
        <button type="button" onClick={() => onEditInTab(lancamento)}>
          detalhe-editar
        </button>
        <button type="button" onClick={() => onOpenChange(false)}>
          detalhe-fechar
        </button>
      </div>
    ) : null,
}));
vi.mock("./LancamentoFormDialog", () => ({
  LancamentoFormDialog: ({
    lancamento,
    onSaved,
    onOpenChange,
  }: {
    lancamento: Lancamento;
    onSaved: () => void;
    onOpenChange: (v: boolean) => void;
  }) => (
    <div>
      <span>form:{lancamento.descricao}</span>
      <button type="button" onClick={onSaved}>
        form-salvar
      </button>
      <button type="button" onClick={() => onOpenChange(false)}>
        form-fechar
      </button>
    </div>
  ),
}));
vi.mock("./TransferenciaFormDialog", () => ({
  TransferenciaFormDialog: ({
    open,
    transferencia,
    onSaved,
    onOpenChange,
  }: {
    open: boolean;
    transferencia: Lancamento | null;
    onSaved: () => void;
    onOpenChange: (v: boolean) => void;
  }) =>
    open && transferencia ? (
      <div>
        <span>transf:{transferencia.descricao}</span>
        <button type="button" onClick={onSaved}>
          transf-salvar
        </button>
        <button type="button" onClick={() => onOpenChange(false)}>
          transf-fechar
        </button>
      </div>
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
    data_vencimento: "2026-11-20",
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

function setup(filters: LancamentosFilters = defaultFilters) {
  const onMutated = vi.fn();
  const onFiltersChange = vi.fn();
  const client = new QueryClient();
  const view = render(
    <QueryClientProvider client={client}>
      <LancamentosTable resumo={resumo} filters={filters} onFiltersChange={onFiltersChange} onMutated={onMutated} />
    </QueryClientProvider>
  );
  return { onMutated, onFiltersChange, view };
}

const linha = (texto: string) => screen.getByText(texto).closest("tr") as HTMLTableRowElement;
const nb = (s: string | null | undefined) => (s ?? "").replace(/\u00a0/g, " ");

const despesa = lanc({ id: "d-1", descricao: "Aluguel", contraparte_nome: "Imobiliária", categoria_nome: "Fixas" });
const receita = lanc({
  id: "r-1",
  tipo: "receita",
  descricao: "Honorários",
  valor: 5000,
  projeto_nome: "Torre A",
  data_vencimento: "2026-11-01",
});
const transf = lanc({
  id: "t-1",
  tipo: "transferencia",
  descricao: "Reserva",
  conta_nome: "Itaú",
  conta_id: "c-o",
  contraparte_id: "c-d",
  contraparte_nome: null,
  valor: 700,
});
const parcela = (n: number, p: Partial<Lancamento> = {}) =>
  lanc({
    id: `p-${n}`,
    descricao: `Notebook (${n}/3)`,
    valor: 1000,
    grupo_parcela: "g1",
    parcela_numero: n,
    parcela_total: 3,
    contraparte_nome: "Loja",
    data_vencimento: `2026-1${n - 1 > 1 ? 1 : n - 1}-15`,
    ...p,
  });

beforeEach(() => {
  vi.clearAllMocks();
  sb.reset();
  acesso.canEdit = true;
  pag.itens = [];
  pag.isLoading = false;
  pag.hasNextPage = false;
  pag.args = [];
  resumos = new Map();
  parcelasPlano = new Map();
  localStorage.clear();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 10, 12, 0));
  sb.resultado("despesas.update", { data: null, error: null });
  sb.resultado("receitas.update", { data: null, error: null });
});
afterEach(() => vi.useRealTimers());

describe("LancamentosTable desktop: linhas", () => {
  it("renderiza receita, despesa e transferência com sinal, contraparte e atraso", () => {
    pag.itens = [despesa, receita, transf];
    setup();
    const d = linha("Aluguel");
    expect(within(d).getByTitle("Despesa")).toBeInTheDocument();
    expect(within(d).getByText("Imobiliária")).toBeInTheDocument();
    expect(within(d).getByText("Fixas")).toBeInTheDocument();
    expect(nb(d.textContent)).toContain("− R$ 3.000,00");

    const r = linha("Honorários");
    expect(within(r).getByTitle("Receita")).toBeInTheDocument();
    expect(within(r).getByText("atrasado")).toBeInTheDocument();
    expect(within(r).getByRole("button", { name: "Status: Atrasado. Alterar" })).toBeInTheDocument();
    expect(within(r).getByText("Torre A")).toBeInTheDocument();
    expect(nb(r.textContent)).toContain("+ R$ 5.000,00");

    const t = linha("Reserva");
    expect(within(t).getByTitle("Transferência")).toBeInTheDocument();
    expect(within(t).getByText("(Itaú)")).toBeInTheDocument();
    expect(nb(t.textContent)).toContain("⇄ R$ 700,00");
  });

  it("sem permissão: sem checkboxes, sem ações e status sem menu", () => {
    acesso.canEdit = false;
    pag.itens = [despesa];
    setup();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar lançamento" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Status:/ })).not.toBeInTheDocument();
    expect(within(linha("Aluguel")).getByText("Pendente")).toBeInTheDocument();
  });

  it("clicar na linha abre o detalhe; transferência abre o formulário de transferência", () => {
    pag.itens = [despesa, transf];
    setup();
    fireEvent.click(linha("Aluguel"));
    expect(screen.getByText("detalhe:Aluguel")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "detalhe-editar" }));
    expect(screen.queryByText("detalhe:Aluguel")).not.toBeInTheDocument();
    expect(screen.getByText("form:Aluguel")).toBeInTheDocument();

    fireEvent.click(linha("Reserva"));
    expect(screen.getByText("transf:Reserva")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "transf-fechar" }));
    expect(screen.queryByText("transf:Reserva")).not.toBeInTheDocument();
  });

  it("editar pela linha: despesa abre o formulário e salvar recarrega; transferência abre o dela", async () => {
    pag.itens = [despesa, transf];
    const { onMutated } = setup();
    fireEvent.click(within(linha("Aluguel")).getByRole("button", { name: "Editar lançamento" }));
    fireEvent.click(screen.getByRole("button", { name: "form-salvar" }));
    expect(onMutated).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("form:Aluguel")).not.toBeInTheDocument();

    fireEvent.click(within(linha("Aluguel")).getByRole("button", { name: "Editar lançamento" }));
    fireEvent.click(screen.getByRole("button", { name: "form-fechar" }));
    expect(screen.queryByText("form:Aluguel")).not.toBeInTheDocument();

    fireEvent.click(within(linha("Reserva")).getByRole("button", { name: "Editar lançamento" }));
    fireEvent.click(screen.getByRole("button", { name: "transf-salvar" }));
    expect(onMutated).toHaveBeenCalledTimes(2);
  });

  it("excluir pela linha pede confirmação e exclui a transferência pela RPC", async () => {
    pag.itens = [transf];
    const { onMutated } = setup();
    fireEvent.click(within(linha("Reserva")).getByRole("button", { name: "Excluir lançamento" }));
    const dlg = screen.getByRole("alertdialog");
    expect(within(dlg).getByText("Excluir transferência")).toBeInTheDocument();
    fireEvent.click(within(dlg).getByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(onMutated).toHaveBeenCalled());
    expect(sb.argsRpc("rpc_excluir_transferencia")).toEqual({ p_id: "t-1" });
    expect(toast.success).toHaveBeenCalledWith("Transferência excluída");
  });

  it("falha ao excluir transferência avisa 'Não foi possível excluir'", async () => {
    sb.rpcResultado("rpc_excluir_transferencia", { data: null, error: { message: "x" } });
    pag.itens = [transf];
    setup();
    fireEvent.click(within(linha("Reserva")).getByRole("button", { name: "Excluir lançamento" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Não foi possível excluir", expect.anything()));
  });

  it("receita: título de exclusão fala em receita", () => {
    pag.itens = [receita];
    setup();
    fireEvent.click(within(linha("Honorários")).getByRole("button", { name: "Excluir lançamento" }));
    expect(within(screen.getByRole("alertdialog")).getByText("Excluir receita")).toBeInTheDocument();
  });
});

describe("LancamentosTable desktop: status pelo badge", () => {
  it("voltar despesa paga para Pendente grava direto, limpando a data", async () => {
    const user = userEvent.setup();
    pag.itens = [lanc({ status: "Pago", data_efetivacao: "2026-11-02" })];
    const { onMutated } = setup();
    await user.click(screen.getByRole("button", { name: "Status: Pago. Alterar" }));
    await user.click(await screen.findByRole("menuitem", { name: "Pendente" }));
    await waitFor(() => expect(onMutated).toHaveBeenCalled());
    expect(sb.de("despesas", "update")[0].args[0]).toEqual({ status: "Pendente", data_pagamento: null });
  });

  it("erro ao gravar status direto avisa e não recarrega", async () => {
    sb.resultado("receitas.update", { data: null, error: { message: "denied" } });
    const user = userEvent.setup();
    pag.itens = [lanc({ id: "r-9", tipo: "receita", status: "Recebido", descricao: "Medição" })];
    const { onMutated } = setup();
    await user.click(screen.getByRole("button", { name: "Status: Recebido. Alterar" }));
    await user.click(await screen.findByRole("menuitem", { name: "Pendente" }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Não foi possível atualizar o status", expect.anything())
    );
    expect(sb.de("receitas", "update")[0].args[0]).toEqual({ status: "Pendente", data_recebimento: null });
    expect(onMutated).not.toHaveBeenCalled();
  });

  it("marcar Pago pelo menu pede a data antes de gravar", async () => {
    const user = userEvent.setup();
    pag.itens = [despesa];
    setup();
    await user.click(screen.getByRole("button", { name: "Status: Pendente. Alterar" }));
    await user.click(await screen.findByRole("menuitem", { name: "Pago" }));
    expect(await screen.findByRole("heading", { name: "Confirmar recebimento/pagamento" })).toBeInTheDocument();
    expect(sb.de("despesas", "update")).toHaveLength(0);
  });

  it("transferência troca status pela RPC de edição", async () => {
    const user = userEvent.setup();
    pag.itens = [transf];
    const { onMutated } = setup();
    await user.click(screen.getByRole("button", { name: "Status: Pendente. Alterar" }));
    await user.click(await screen.findByRole("menuitem", { name: "Concluída" }));
    await waitFor(() => expect(onMutated).toHaveBeenCalled());
    expect(sb.argsRpc("rpc_editar_transferencia")).toEqual({
      p_id: "t-1",
      p_conta_origem_id: "c-o",
      p_conta_destino_id: "c-d",
      p_valor: 700,
      p_data: "2026-11-20",
      p_descricao: "Reserva",
      p_status: "Concluída",
      p_observacao: null,
    });
    expect(toast.success).toHaveBeenCalledWith("Status atualizado");
  });

  it("erro na RPC de transferência avisa e não recarrega", async () => {
    sb.rpcResultado("rpc_editar_transferencia", { data: null, error: { message: "x" } });
    const user = userEvent.setup();
    pag.itens = [transf];
    const { onMutated } = setup();
    await user.click(screen.getByRole("button", { name: "Status: Pendente. Alterar" }));
    await user.click(await screen.findByRole("menuitem", { name: "Concluída" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Falha ao atualizar status", expect.anything()));
    expect(onMutated).not.toHaveBeenCalled();
  });
});

describe("LancamentosTable desktop: ordenação", () => {
  it("clicar no cabeçalho ordena desc; clicar de novo inverte; outra coluna volta a desc", () => {
    pag.itens = [despesa];
    setup();
    expect(pag.args.at(-1)).toEqual(expect.objectContaining({ sortKey: "data", sortDir: "desc" }));
    fireEvent.click(screen.getByText("Valor"));
    expect(pag.args.at(-1)).toEqual(expect.objectContaining({ sortKey: "valor", sortDir: "desc" }));
    fireEvent.click(screen.getByText("Valor"));
    expect(pag.args.at(-1)).toEqual(expect.objectContaining({ sortKey: "valor", sortDir: "asc" }));
    fireEvent.click(screen.getByText("Descrição"));
    expect(pag.args.at(-1)).toEqual(expect.objectContaining({ sortKey: "descricao", sortDir: "desc" }));
  });
});

describe("LancamentosTable desktop: seleção e ações em massa", () => {
  it("selecionar todos e marcar pago: grava receitas e despesas pendentes com a data escolhida", async () => {
    pag.itens = [despesa, receita, lanc({ id: "d-2", descricao: "Luz", status: "Pago" })];
    const { onMutated } = setup();
    fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar todos" }));
    expect(screen.getByText("3 selecionados")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Marcar pago\/recebido/ }));
    expect(screen.getByRole("heading", { name: "Marcar 3 lançamento(s) como pago/recebido" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(onMutated).toHaveBeenCalled());
    expect(sb.de("receitas", "update")[0].args[0]).toEqual({ status: "Recebido", data_recebimento: "2026-11-10" });
    expect(sb.de("receitas", "in")[0].args).toEqual(["id", ["r-1"]]);
    expect(sb.de("despesas", "in")[0].args).toEqual(["id", ["d-1"]]);
    expect(toast.success).toHaveBeenCalledWith("2 marcado(s) como pago/recebido");
    expect(screen.queryByText(/selecionado/)).not.toBeInTheDocument();
  });

  it("só já efetivados: avisa que não há nada a marcar", async () => {
    pag.itens = [lanc({ status: "Pago" })];
    setup();
    fireEvent.click(within(linha("Aluguel")).getByRole("checkbox", { name: "Selecionar linha" }));
    expect(screen.getByText("1 selecionado")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Marcar pago\/recebido/ }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(toast.info).toHaveBeenCalledWith("Nada a marcar — já efetivados"));
    expect(sb.de("despesas", "update")).toHaveLength(0);
  });

  it("erro em parte do lote avisa falha e não recarrega", async () => {
    sb.resultado("despesas.update", { data: null, error: { message: "x" } });
    pag.itens = [despesa];
    const { onMutated } = setup();
    fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar todos" }));
    fireEvent.click(screen.getByRole("button", { name: /Marcar pago\/recebido/ }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Falha em alguns registros"));
    expect(onMutated).not.toHaveBeenCalled();
  });

  it("desmarcar linha e limpar seleção; clicar 'todos' com tudo marcado desmarca", () => {
    pag.itens = [despesa, receita];
    setup();
    const cb = within(linha("Aluguel")).getByRole("checkbox", { name: "Selecionar linha" });
    fireEvent.click(cb);
    fireEvent.click(cb);
    expect(screen.queryByText(/selecionado/)).not.toBeInTheDocument();
    fireEvent.click(cb);
    fireEvent.click(screen.getByRole("button", { name: /Limpar seleção/ }));
    expect(screen.queryByText(/selecionado/)).not.toBeInTheDocument();
    const todos = screen.getByRole("checkbox", { name: "Selecionar todos" });
    fireEvent.click(todos);
    expect(screen.getByText("2 selecionados")).toBeInTheDocument();
    fireEvent.click(todos);
    expect(screen.queryByText(/selecionado/)).not.toBeInTheDocument();
  });

  it("mudar o filtro limpa a seleção", () => {
    pag.itens = [despesa];
    const { view } = setup();
    fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar todos" }));
    expect(screen.getByText("1 selecionado")).toBeInTheDocument();
    view.rerender(
      <QueryClientProvider client={new QueryClient()}>
        <LancamentosTable
          resumo={resumo}
          filters={{ ...defaultFilters, search: "a" }}
          onFiltersChange={vi.fn()}
          onMutated={vi.fn()}
        />
      </QueryClientProvider>
    );
    expect(screen.queryByText(/selecionado/)).not.toBeInTheDocument();
  });

  it("excluir em massa: confirma e exclui todos", async () => {
    pag.itens = [despesa, receita];
    const { onMutated } = setup();
    fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar todos" }));
    fireEvent.click(screen.getByRole("button", { name: /^Excluir$/ }));
    const dlg = screen.getByRole("alertdialog");
    expect(within(dlg).getByText("Excluir 2 lançamento(s)?")).toBeInTheDocument();
    fireEvent.click(within(dlg).getByRole("button", { name: "Excluir todos" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("2 excluído(s)"));
    expect(onMutated).toHaveBeenCalled();
    expect(sb.client.rpc).toHaveBeenCalledWith("rpc_soft_delete", { p_tabela: "despesas", p_id: "d-1" });
    expect(sb.client.rpc).toHaveBeenCalledWith("rpc_soft_delete", { p_tabela: "receitas", p_id: "r-1" });
  });

  it("excluir em massa com falha parcial avisa quantos falharam", async () => {
    sb.rpcResultado("rpc_soft_delete", [
      { data: null, error: null },
      { data: null, error: { message: "denied" } },
    ]);
    pag.itens = [despesa, receita];
    const { onMutated } = setup();
    fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar todos" }));
    fireEvent.click(screen.getByRole("button", { name: /^Excluir$/ }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Excluir todos" }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Falha ao excluir 1 de 2 lançamento(s)", expect.anything())
    );
    expect(onMutated).toHaveBeenCalled();
  });
});

describe("LancamentosTable desktop: grupos de parcelas", () => {
  it("agrupa parcelas numa linha-resumo (fallback sem resumo do plano) e expande o plano inteiro", () => {
    pag.itens = [despesa, parcela(1, { status: "Pago" }), parcela(2)];
    parcelasPlano = new Map([["g1", [parcela(3)]]]);
    setup();
    const g = linha("Notebook");
    expect(within(g).getByText("1 de 3 pagas")).toBeInTheDocument();
    expect(within(g).getByText("Parcial")).toBeInTheDocument();
    expect(within(g).getByText("—")).toBeInTheDocument();
    expect(nb(g.textContent)).toContain("− R$ 2.000,00");
    expect(nb(g.textContent)).toContain("falta R$ 1.000,00");
    expect(screen.queryByText("Notebook (3/3)")).not.toBeInTheDocument();

    fireEvent.click(g);
    expect(screen.getByText("Notebook (1/3)")).toBeInTheDocument();
    expect(screen.getByText("Notebook (3/3)")).toBeInTheDocument();
    expect(within(linha("Notebook (2/3)")).getByText("2/3")).toBeInTheDocument();

    fireEvent.click(linha("Notebook"));
    expect(screen.queryByText("Notebook (2/3)")).not.toBeInTheDocument();
  });

  it("usa o resumo do plano quando chega: quitado, sem saldo pendente", () => {
    pag.itens = [parcela(1, { tipo: "receita" })];
    pag.itens.push(parcela(2, { tipo: "receita" }));
    resumos = new Map([
      [
        "g1",
        {
          totalOriginal: 9000,
          totalPago: 9000,
          saldo: 0,
          pagas: 3,
          totalParcelas: 3,
          proximaVenc: null,
          proximaValor: null,
          status: "quitado",
        },
      ],
    ]);
    setup();
    const g = linha("Notebook");
    expect(within(g).getByText("Quitado")).toBeInTheDocument();
    expect(within(g).getByText("quitado")).toBeInTheDocument();
    expect(within(g).getByText("3 de 3 pagas")).toBeInTheDocument();
    expect(nb(g.textContent)).toContain("+ R$ 9.000,00");
    expect(nb(g.textContent)).not.toContain("falta");
  });

  it("plano em aberto mostra o próximo vencimento", () => {
    pag.itens = [parcela(1), parcela(2)];
    resumos = new Map([
      [
        "g1",
        {
          totalOriginal: 3000,
          totalPago: 0,
          saldo: 3000,
          pagas: 0,
          totalParcelas: 3,
          proximaVenc: "2026-12-15",
          proximaValor: 1000,
          status: "aberto",
        },
      ],
    ]);
    setup();
    const g = linha("Notebook");
    expect(within(g).getByText("Em aberto")).toBeInTheDocument();
    expect(within(g).getByText("vence 15/12/2026")).toBeInTheDocument();
  });

  it("expandir/recolher todos e desagrupar pela barra", () => {
    pag.itens = [parcela(1), parcela(2)];
    setup();
    fireEvent.click(screen.getByRole("button", { name: "expandir-todos" }));
    expect(screen.getByText("Notebook (1/3)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "recolher-todos" }));
    expect(screen.queryByText("Notebook (1/3)")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "desagrupar" }));
    expect(localStorage.getItem("lancamentos.grouped")).toBe("false");
    expect(screen.getByText("Notebook (1/3)")).toBeInTheDocument();
    expect(screen.getByText("Notebook (2/3)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "agrupar" })).toBeInTheDocument();
  });

  it("checkbox do grupo seleciona e desseleciona todas as parcelas do período", () => {
    pag.itens = [parcela(1), parcela(2)];
    setup();
    const cb = within(linha("Notebook")).getByRole("checkbox", { name: "Selecionar grupo" });
    fireEvent.click(cb);
    expect(screen.getByText("2 selecionados")).toBeInTheDocument();
    fireEvent.click(cb);
    expect(screen.queryByText(/selecionado/)).not.toBeInTheDocument();
  });

  it("grupo parcialmente selecionado fica indeterminado", () => {
    pag.itens = [parcela(1), parcela(2)];
    setup();
    fireEvent.click(linha("Notebook"));
    fireEvent.click(within(linha("Notebook (1/3)")).getByRole("checkbox", { name: "Selecionar linha" }));
    expect(within(linha("Notebook")).getByRole("checkbox", { name: "Selecionar grupo" })).toHaveAttribute(
      "data-state",
      "indeterminate"
    );
  });

  it("menu do grupo: marcar todas como pagas abre a confirmação de lote", async () => {
    const user = userEvent.setup();
    pag.itens = [parcela(1), parcela(2)];
    const { onMutated } = setup();
    await user.click(within(linha("Notebook")).getByRole("button", { name: "Mais opções" }));
    await user.click(await screen.findByRole("menuitem", { name: /Marcar todas como pagas/ }));
    expect(
      await screen.findByRole("heading", { name: "Marcar 2 lançamento(s) como pago/recebido" })
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(onMutated).toHaveBeenCalled());
    expect(sb.de("despesas", "in")[0].args).toEqual(["id", ["p-1", "p-2"]]);
  });

  it("menu do grupo: excluir grupo inteiro pede confirmação e exclui cada parcela", async () => {
    const user = userEvent.setup();
    pag.itens = [parcela(1), parcela(2)];
    setup();
    await user.click(within(linha("Notebook")).getByRole("button", { name: "Mais opções" }));
    await user.click(await screen.findByRole("menuitem", { name: /Excluir grupo inteiro/ }));
    const dlg = await screen.findByRole("alertdialog");
    expect(within(dlg).getByText("Excluir grupo inteiro (2 parcelas)?")).toBeInTheDocument();
    await user.click(within(dlg).getByRole("button", { name: "Excluir grupo" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("2 excluído(s)"));
    expect(sb.client.rpc).toHaveBeenCalledWith("rpc_soft_delete", { p_tabela: "despesas", p_id: "p-1" });
    expect(sb.client.rpc).toHaveBeenCalledWith("rpc_soft_delete", { p_tabela: "despesas", p_id: "p-2" });
  });

  it("grupo de receita sem permissão: sem checkbox nem menu", () => {
    acesso.canEdit = false;
    pag.itens = [parcela(1, { tipo: "receita" }), parcela(2, { tipo: "receita" })];
    setup();
    const g = linha("Notebook");
    expect(within(g).queryByRole("checkbox")).not.toBeInTheDocument();
    expect(within(g).queryByRole("button", { name: "Mais opções" })).not.toBeInTheDocument();
    expect(within(g).getByText("Em aberto")).toBeInTheDocument();
  });
});

describe("LancamentosTable desktop: carregando, vazio e paginação", () => {
  it("carregando sem itens mostra o loader", () => {
    pag.isLoading = true;
    setup();
    expect(screen.getByText("Carregando lançamentos")).toBeInTheDocument();
  });

  it("vazio sem filtro: convida a criar o primeiro", () => {
    setup({ ...defaultFilters, periodo: "tudo" });
    expect(screen.getByText("Nenhum lançamento ainda")).toBeInTheDocument();
    expect(screen.queryByText("Limpar filtros")).not.toBeInTheDocument();
  });

  it("vazio com período: oferece ver todo o período", () => {
    const { onFiltersChange } = setup();
    expect(screen.getByText("Nenhum lançamento com esses filtros")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver todo o período" }));
    expect(onFiltersChange).toHaveBeenCalledWith({
      ...defaultFilters,
      periodo: "tudo",
      customFrom: null,
      customTo: null,
    });
  });

  it("vazio com outro filtro: oferece limpar filtros; a barra repassa patch e reset", () => {
    const filtros = { ...defaultFilters, periodo: "tudo" as const, valorMin: "10" };
    const { onFiltersChange } = setup(filtros);
    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(onFiltersChange).toHaveBeenLastCalledWith(defaultFilters);
    fireEvent.click(screen.getByRole("button", { name: "buscar-x" }));
    expect(onFiltersChange).toHaveBeenLastCalledWith({ ...filtros, search: "x" });
    fireEvent.click(screen.getByRole("button", { name: "reset-filtros" }));
    expect(onFiltersChange).toHaveBeenLastCalledWith(defaultFilters);
  });

  it("com próxima página: 'Carregar mais' busca a seguinte", () => {
    pag.itens = [despesa];
    pag.hasNextPage = true;
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Carregar mais" }));
    expect(pag.fetchNextPage).toHaveBeenCalled();
  });

  it("o detalhe fecha pelo próprio diálogo", () => {
    pag.itens = [despesa];
    setup();
    fireEvent.click(linha("Aluguel"));
    fireEvent.click(screen.getByRole("button", { name: "detalhe-fechar" }));
    expect(screen.queryByText("detalhe:Aluguel")).not.toBeInTheDocument();
  });
});
