import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { FornecedorDetalhe } from "@/hooks/useFornecedorDetalhe";
import type { AvaliacaoFornecedor } from "@/hooks/useFornecedorAvaliacoes";

/**
 * Detalhe do fornecedor: estados de carregamento/erro, KPIs, cotações com
 * filtro por obra e itens expansíveis, obras e compras navegáveis. Os hooks de
 * dados são testados à parte; aqui entram já resolvidos.
 */

type Estado = { data?: FornecedorDetalhe; isLoading: boolean; isError: boolean };
const h = vi.hoisted(() => ({
  detalhe: { isLoading: false, isError: false } as Estado,
  avaliacoes: [] as AvaliacaoFornecedor[],
  detalheId: vi.fn(),
}));

vi.mock("@/hooks/useFornecedorDetalhe", () => ({
  useFornecedorDetalhe: (id: string | undefined) => {
    h.detalheId(id);
    return h.detalhe;
  },
}));
vi.mock("@/hooks/useFornecedorAvaliacoes", () => ({
  useFornecedorAvaliacoes: () => ({ data: h.avaliacoes }),
}));
vi.mock("@/hooks/usePageTitle", () => ({ usePageTitle: vi.fn() }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: () => true, isAdmin: false }) }));
vi.mock("@/components/ui/sidebar", async (orig) => ({
  ...(await orig<typeof import("@/components/ui/sidebar")>()),
  useSidebar: () => ({ state: "expanded", isMobile: false, open: true, setOpenMobile: vi.fn() }),
}));
vi.mock("@/components/ModuleChipNav", () => ({ ModuleChipNav: () => null }));

import FornecedorDetalhePage from "./[id]";

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const DETALHE: FornecedorDetalhe = {
  fornecedor: {
    id: "f1",
    nome: "Concreto Forte",
    cnpj: "11222333000181",
    contato: "Rui",
    telefone: "14999998888",
    email: "rui@concreto.test",
  } as FornecedorDetalhe["fornecedor"],
  resumo: {
    obras: 2,
    totalComprado: 3000,
    totalCotado: 5000,
    cotacoesParticipadas: 3,
    vitorias: 1,
    taxaVitoria: 1 / 3,
    ticketMedio: 1500,
    ultimaCompra: "2026-10-20",
  },
  cotacoes: [
    {
      propostaId: "pr1",
      cotacaoId: "c1",
      obraId: "o1",
      obraNome: "Residencial Aurora",
      descricao: "Concreto fck 30",
      valor: 2000,
      status: "venceu",
      itens: [{ descricao: "Concreto usinado", quantidade: 10, unidade: "m3", preco_unitario: 200, valor_total: 2000 }],
    },
    {
      propostaId: "pr2",
      cotacaoId: "c2",
      obraId: "o2",
      obraNome: "Casa Ipê",
      descricao: "Graute",
      valor: 1000,
      status: "aberta",
      itens: [],
    },
    {
      propostaId: "pr3",
      cotacaoId: "c3",
      obraId: "o2",
      obraNome: "Casa Ipê",
      descricao: "Bombeamento",
      valor: 2000,
      status: "perdeu",
      itens: [{ descricao: "Bomba lança", quantidade: null, unidade: null, preco_unitario: null, valor_total: 2000 }],
    },
  ],
  compras: [
    {
      lancamentoId: "l1",
      obraId: "o1",
      obraNome: "Residencial Aurora",
      data: "2026-10-20",
      descricao: "Concreto laje",
      valor: 3000,
      frente: null,
      comprovanteUrl: "https://files.seed.test/nf.pdf",
    },
  ],
  obras: [
    { obraId: "o1", obraNome: "Residencial Aurora", totalCotado: 2000, totalComprado: 3000, cotacoes: 1, vitorias: 1 },
    { obraId: "o2", obraNome: "Casa Ipê", totalCotado: 3000, totalComprado: 0, cotacoes: 2, vitorias: 0 },
  ],
};

function Local() {
  return <div data-testid="local">{useLocation().pathname}</div>;
}

function renderPagina(path = "/gestao/fornecedores/f1") {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/gestao/fornecedores/:id" element={<FornecedorDetalhePage />} />
        <Route path="/gestao/fornecedores" element={<FornecedorDetalhePage />} />
        <Route path="*" element={<Local />} />
      </Routes>
    </MemoryRouter>
  );
  return userEvent.setup();
}

const aba = (nome: RegExp) => screen.getByRole("tab", { name: nome });

beforeEach(() => {
  vi.clearAllMocks();
  h.detalhe = { data: DETALHE, isLoading: false, isError: false };
  h.avaliacoes = [];
});

describe("FornecedorDetalhePage", () => {
  it("carregando não mostra conteúdo", () => {
    h.detalhe = { isLoading: true, isError: false };
    renderPagina();
    expect(screen.queryByText("Concreto Forte")).not.toBeInTheDocument();
    expect(screen.queryByText("Fornecedor não encontrado")).not.toBeInTheDocument();
  });

  it("erro mostra 'não encontrado' e volta para a lista", async () => {
    h.detalhe = { isLoading: false, isError: true };
    const user = renderPagina();
    expect(screen.getByRole("heading", { name: "Fornecedor não encontrado" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Voltar para Fornecedores" }));
    expect(screen.getByRole("heading", { name: "Fornecedor não encontrado" })).toBeInTheDocument();
    expect(h.detalheId).toHaveBeenLastCalledWith(undefined);
  });

  it("sem dado (fornecedor removido) também cai no 'não encontrado'", () => {
    h.detalhe = { isLoading: false, isError: false };
    renderPagina();
    expect(screen.getByRole("heading", { name: "Fornecedor não encontrado" })).toBeInTheDocument();
    expect(h.detalheId).toHaveBeenCalledWith("f1");
  });

  it("mostra cadastro formatado e KPIs, com 'Sem avaliação' quando não há nota", () => {
    renderPagina();
    expect(screen.getByRole("heading", { name: "Concreto Forte" })).toBeInTheDocument();
    expect(screen.getByText("11.222.333/0001-81")).toBeInTheDocument();
    expect(screen.getByText("(14) 99999-8888")).toBeInTheDocument();
    expect(screen.getByText("33% de vitória (1)")).toBeInTheDocument();
    expect(screen.getByText("Sem avaliação")).toBeInTheDocument();
    expect(screen.getByText("20/10/2026")).toBeInTheDocument();
  });

  it("nota média aparece com o total de avaliações", () => {
    h.avaliacoes = [
      { id: "a1", nota_geral: 4 } as AvaliacaoFornecedor,
      { id: "a2", nota_geral: 5 } as AvaliacaoFornecedor,
    ];
    renderPagina();
    expect(screen.getByText("4,5")).toBeInTheDocument();
    expect(screen.getByText("2 avaliações")).toBeInTheDocument();
  });

  it("cotações: status, itens expansíveis e proposta sem itens não expande", async () => {
    const user = renderPagina();
    expect(screen.getByText("Venceu")).toBeInTheDocument();
    expect(screen.getByText("Em aberto")).toBeInTheDocument();
    expect(screen.getByText("Não venceu")).toBeInTheDocument();
    const expandir = screen.getAllByRole("button", { name: "Expandir itens" });
    expect(expandir[1]).toBeDisabled(); // Graute, sem itens
    await user.click(expandir[0]);
    expect(screen.getByText("Concreto usinado")).toBeInTheDocument();
    expect(screen.getByText("10 m3")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Recolher itens" }));
    expect(screen.queryByText("Concreto usinado")).not.toBeInTheDocument();
    // Item sem quantidade/preço mostra traço.
    await user.click(screen.getAllByRole("button", { name: "Expandir itens" })[2]);
    expect(screen.getByText("Bomba lança")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("filtro por obra aparece com mais de uma obra e restringe as cotações", () => {
    renderPagina();
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
    fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: "Casa Ipê" }));
    expect(screen.queryByText("Concreto fck 30")).not.toBeInTheDocument();
    expect(screen.getByText("Graute")).toBeInTheDocument();
    expect(screen.getByText("Bombeamento")).toBeInTheDocument();
  });

  it("clicar na obra da cotação navega para a obra", async () => {
    const user = renderPagina();
    await user.click(screen.getAllByRole("button", { name: "Residencial Aurora" })[0]);
    expect(screen.getByTestId("local")).toHaveTextContent("/obras/o1");
  });

  it("abas de obras e compras listam e navegam; comprovante abre em nova aba", async () => {
    const user = renderPagina();
    await user.click(aba(/Obras/));
    expect(screen.getByText("Casa Ipê")).toBeInTheDocument();
    await user.click(aba(/Compras/));
    expect(screen.getByText("Concreto laje")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir comprovante" })).toHaveAttribute("target", "_blank");
    await user.click(screen.getByRole("button", { name: "Residencial Aurora" }));
    expect(screen.getByTestId("local")).toHaveTextContent("/obras/o1");
  });

  it("linha da obra navega para a obra", async () => {
    const user = renderPagina();
    await user.click(aba(/Obras/));
    await user.click(screen.getByText("Casa Ipê"));
    expect(screen.getByTestId("local")).toHaveTextContent("/obras/o2");
  });

  it("sem cotações, obras ou compras mostra os vazios de cada aba", async () => {
    h.detalhe = {
      isLoading: false,
      isError: false,
      data: { ...DETALHE, cotacoes: [], compras: [], obras: [], resumo: { ...DETALHE.resumo, ultimaCompra: null } },
    };
    const user = renderPagina();
    expect(screen.getByText("Nenhuma cotação")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    await user.click(aba(/Obras/));
    expect(screen.getByText("Nenhuma obra")).toBeInTheDocument();
    await user.click(aba(/Compras/));
    expect(screen.getByText("Nenhuma compra")).toBeInTheDocument();
    await user.click(aba(/Avaliações/));
    expect(screen.getByText("Nenhuma avaliação ainda")).toBeInTheDocument();
  });
});
