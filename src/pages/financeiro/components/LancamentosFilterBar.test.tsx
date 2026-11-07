import { beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { format } from "date-fns";
import { PageSlotsContext } from "@/components/pageSlotsContext";
import { defaultFilters, type LancamentosFilters } from "./lancamentosFilters";

// Barra de filtros de Lançamentos: busca, tipo, atalhos de status, filtros por
// lista (projeto/categoria/cliente/fornecedor), forma de pagamento, faixa de
// valor, chips removíveis e agrupamento de parcelas.

import { LancamentosFilterBar } from "./LancamentosFilterBar";

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const opcoes = {
  categorias: [
    { value: "cat-1", label: "Material" },
    { value: "cat-2", label: "Mão de obra" },
  ],
  projetos: [{ value: "proj-1", label: "Casa Verde" }],
  clientes: [{ value: "cli-1", label: "Construtora Alfa" }],
  fornecedores: [{ value: "forn-1", label: "Votoran" }],
};

function setup(over: Partial<LancamentosFilters> = {}, props: Record<string, unknown> = {}) {
  const toolbar = document.createElement("div");
  document.body.appendChild(toolbar);
  const handlers = {
    onChange: vi.fn(),
    onReset: vi.fn(),
    onToggleGrouped: vi.fn(),
    onToggleExpandAll: vi.fn(),
  };
  render(
    <PageSlotsContext.Provider value={{ toolbarEl: toolbar, tabsEl: null }}>
      <LancamentosFilterBar
        filters={{ ...defaultFilters, ...over }}
        {...opcoes}
        total={40}
        visible={25}
        grouped={false}
        allGroupIds={[]}
        allExpanded={false}
        {...handlers}
        {...props}
      />
    </PageSlotsContext.Provider>
  );
  return handlers;
}

const abrirFiltros = () => fireEvent.click(screen.getByRole("button", { name: "Filtros" }));
const popover = () => screen.getByRole("dialog");

describe("LancamentosFilterBar: barra", () => {
  it("sem PageLayout (slot) não renderiza a toolbar", () => {
    render(
      <LancamentosFilterBar
        filters={defaultFilters}
        {...opcoes}
        total={0}
        visible={0}
        grouped={false}
        allGroupIds={[]}
        allExpanded={false}
        onChange={vi.fn()}
        onReset={vi.fn()}
        onToggleGrouped={vi.fn()}
        onToggleExpandAll={vi.fn()}
      />
    );
    expect(screen.queryByPlaceholderText("Buscar lançamento")).not.toBeInTheDocument();
  });

  it("filtros padrão: contador, sem chips e sem Limpar", () => {
    setup();
    expect(screen.getByText("25 de 40")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Limpar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Remover / })).not.toBeInTheDocument();
  });

  it("busca digitada e limpar busca", () => {
    const { onChange } = setup({ search: "cimento" });
    fireEvent.change(screen.getByPlaceholderText("Buscar lançamento"), { target: { value: "areia" } });
    expect(onChange).toHaveBeenLastCalledWith({ search: "areia" });
    fireEvent.click(screen.getByRole("button", { name: "Limpar busca" }));
    expect(onChange).toHaveBeenLastCalledWith({ search: "" });
  });

  it("tipo pelo seletor de visualização", () => {
    const { onChange } = setup();
    const grupo = screen.getByRole("group", { name: "Tipo de lançamento" });
    expect(within(grupo).getByRole("button", { name: /Todos/ })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(within(grupo).getByRole("button", { name: /Despesas/ }));
    expect(onChange).toHaveBeenLastCalledWith({ tipo: "despesa" });
  });

  it("filtro ativo mostra Limpar que reseta tudo", () => {
    const { onReset } = setup({ tipo: "receita" });
    fireEvent.click(screen.getByRole("button", { name: /Limpar/ }));
    expect(onReset).toHaveBeenCalled();
  });

  it("agrupar parcelas e expandir todos", () => {
    const h = setup({}, { grouped: true, allGroupIds: ["g1"], allExpanded: true });
    fireEvent.click(screen.getByTitle("Desagrupar parcelas"));
    expect(h.onToggleGrouped).toHaveBeenCalled();
    fireEvent.click(screen.getByTitle("Recolher todos"));
    expect(h.onToggleExpandAll).toHaveBeenCalled();
  });

  it("sem grupos não oferece expandir", () => {
    setup({}, { grouped: true, allGroupIds: [] });
    expect(screen.queryByTitle("Expandir todos")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Recolher todos")).not.toBeInTheDocument();
  });
});

describe("LancamentosFilterBar: chips", () => {
  it("mostra um chip por filtro com o rótulo e remove só aquele item", () => {
    const { onChange } = setup({
      projetos: ["proj-1"],
      categorias: ["cat-1", "cat-2"],
      clientes: ["cli-1"],
      fornecedores: ["forn-x"],
      formasPagamento: ["PIX"],
    });
    expect(screen.getByText("Proj: Casa Verde")).toBeInTheDocument();
    expect(screen.getByText("Cli: Construtora Alfa")).toBeInTheDocument();
    // id sem opção conhecida cai no próprio id
    expect(screen.getByText("Forn: forn-x")).toBeInTheDocument();
    expect(screen.getByText("Pgto: PIX")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remover Cat: Material" }));
    expect(onChange).toHaveBeenLastCalledWith({ categorias: ["cat-2"] });
    fireEvent.click(screen.getByRole("button", { name: "Remover Proj: Casa Verde" }));
    expect(onChange).toHaveBeenLastCalledWith({ projetos: [] });
    fireEvent.click(screen.getByRole("button", { name: "Remover Cli: Construtora Alfa" }));
    expect(onChange).toHaveBeenLastCalledWith({ clientes: [] });
    fireEvent.click(screen.getByRole("button", { name: "Remover Forn: forn-x" }));
    expect(onChange).toHaveBeenLastCalledWith({ fornecedores: [] });
    fireEvent.click(screen.getByRole("button", { name: "Remover Pgto: PIX" }));
    expect(onChange).toHaveBeenLastCalledWith({ formasPagamento: [] });
  });

  it.each([
    [{ valorMin: "R$ 10,00", valorMax: "R$ 50,00" }, "Valor R$ 10,00 → R$ 50,00"],
    [{ valorMin: "R$ 10,00" }, "Valor ≥ R$ 10,00"],
    [{ valorMax: "R$ 50,00" }, "Valor ≤ R$ 50,00"],
  ])("faixa de valor %o vira chip %s e remove as duas pontas", (filtro, rotulo) => {
    const { onChange } = setup(filtro);
    fireEvent.click(screen.getByRole("button", { name: `Remover ${rotulo}` }));
    expect(onChange).toHaveBeenLastCalledWith({ valorMin: "", valorMax: "" });
  });

  it("atalho ativo vira chip; remover volta ao padrão", () => {
    const { onChange } = setup({ status: "atrasados", periodo: "tudo" });
    fireEvent.click(screen.getByRole("button", { name: "Remover Atrasados" }));
    expect(onChange).toHaveBeenLastCalledWith({
      status: "todos",
      periodo: "mes-atual",
      customFrom: null,
      customTo: null,
    });
  });
});

describe("LancamentosFilterBar: popover de filtros", () => {
  it("badge conta status, listas e faixa de valor", () => {
    setup({ status: "pagos", projetos: ["proj-1"], categorias: ["cat-1", "cat-2"], valorMin: "R$ 1,00" });
    expect(screen.getByRole("button", { name: "Filtros" })).toHaveTextContent("5");
  });

  it("atalhos de status aplicam status + período", () => {
    const { onChange } = setup();
    abrirFiltros();
    fireEvent.click(within(popover()).getByRole("button", { name: "Em aberto" }));
    expect(onChange).toHaveBeenLastCalledWith({ status: "pendentes", periodo: "tudo", customFrom: null, customTo: null });
    fireEvent.click(within(popover()).getByRole("button", { name: "Vence esta semana" }));
    const hoje = format(new Date(), "yyyy-MM-dd");
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "pendentes", periodo: "custom", customFrom: hoje })
    );
  });

  it("clicar no atalho já ativo desliga", () => {
    const { onChange } = setup({ status: "pagos", periodo: "tudo" });
    abrirFiltros();
    fireEvent.click(within(popover()).getByRole("button", { name: "Pagos" }));
    expect(onChange).toHaveBeenLastCalledWith({ status: "todos", periodo: "mes-atual", customFrom: null, customTo: null });
  });

  it("seção de lista: abre, busca, sem resultado e marca/desmarca", () => {
    const { onChange } = setup({ categorias: ["cat-2"] });
    abrirFiltros();
    fireEvent.click(within(popover()).getByRole("button", { name: /Categoria/ }));
    const busca = within(popover()).getByPlaceholderText("Buscar categoria…");
    fireEvent.change(busca, { target: { value: "inexistente" } });
    expect(within(popover()).getByText("Nenhum resultado")).toBeInTheDocument();
    fireEvent.change(busca, { target: { value: "mat" } });
    fireEvent.click(within(popover()).getByRole("checkbox"));
    expect(onChange).toHaveBeenLastCalledWith({ categorias: ["cat-2", "cat-1"] });
    fireEvent.change(busca, { target: { value: "" } });
    fireEvent.click(within(popover()).getAllByRole("checkbox")[1]);
    expect(onChange).toHaveBeenLastCalledWith({ categorias: [] });
  });

  it("projeto: seleciona sem mexer no tipo", () => {
    const { onChange } = setup();
    abrirFiltros();
    fireEvent.click(within(popover()).getByRole("button", { name: /Projeto/ }));
    fireEvent.click(within(popover()).getByRole("checkbox"));
    expect(onChange).toHaveBeenLastCalledWith({ projetos: ["proj-1"] });
  });

  it("cliente força tipo receita; fornecedor força despesa", () => {
    const { onChange } = setup();
    abrirFiltros();
    fireEvent.click(within(popover()).getByRole("button", { name: /Cliente/ }));
    fireEvent.click(within(popover()).getByRole("checkbox"));
    expect(onChange).toHaveBeenLastCalledWith({ clientes: ["cli-1"], tipo: "receita" });
    fireEvent.click(within(popover()).getByRole("button", { name: /Cliente/ }));
    fireEvent.click(within(popover()).getByRole("button", { name: /Fornecedor/ }));
    fireEvent.click(within(popover()).getByRole("checkbox"));
    expect(onChange).toHaveBeenLastCalledWith({ fornecedores: ["forn-1"], tipo: "despesa" });
  });

  it("cliente com tipo já receita não repete o tipo; desmarcar tudo não força tipo", () => {
    const { onChange } = setup({ tipo: "receita", clientes: ["cli-1"] });
    abrirFiltros();
    fireEvent.click(within(popover()).getByRole("button", { name: /Cliente/ }));
    fireEvent.click(within(popover()).getByRole("checkbox"));
    expect(onChange).toHaveBeenLastCalledWith({ clientes: [] });
  });

  it("forma de pagamento alterna", () => {
    const { onChange } = setup({ formasPagamento: ["PIX"] });
    abrirFiltros();
    fireEvent.click(within(popover()).getByRole("button", { name: "Boleto" }));
    expect(onChange).toHaveBeenLastCalledWith({ formasPagamento: ["PIX", "Boleto"] });
    fireEvent.click(within(popover()).getByRole("button", { name: "PIX" }));
    expect(onChange).toHaveBeenLastCalledWith({ formasPagamento: [] });
  });

  it("faixa de valor aplica máscara de moeda", () => {
    const { onChange } = setup();
    abrirFiltros();
    fireEvent.change(within(popover()).getByPlaceholderText("Mínimo"), { target: { value: "1050" } });
    expect(onChange).toHaveBeenLastCalledWith({ valorMin: expect.stringMatching(/R\$\s?10,50/) });
    fireEvent.change(within(popover()).getByPlaceholderText("Máximo"), { target: { value: "abc" } });
    expect(onChange).toHaveBeenLastCalledWith({ valorMax: expect.any(String) });
  });

  it("limpar tudo do popover zera status, período, listas e valores (mantém busca e tipo)", () => {
    const { onChange } = setup({ status: "pagos", projetos: ["proj-1"], search: "x", tipo: "despesa" });
    abrirFiltros();
    fireEvent.click(within(popover()).getByRole("button", { name: "Limpar tudo" }));
    const patch = onChange.mock.lastCall?.[0] as Partial<LancamentosFilters>;
    expect(patch).toEqual({
      status: "todos",
      periodo: "mes-atual",
      customFrom: null,
      customTo: null,
      projetos: [],
      categorias: [],
      clientes: [],
      fornecedores: [],
      formasPagamento: [],
      valorMin: "",
      valorMax: "",
    });
    expect(patch).not.toHaveProperty("search");
    expect(patch).not.toHaveProperty("tipo");
  });
});
