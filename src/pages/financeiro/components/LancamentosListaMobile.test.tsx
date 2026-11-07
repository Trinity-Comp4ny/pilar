import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { Lancamento } from "../hooks/useLancamentosUnified";
import { isOverdue, isPaidStatus } from "./lancamentosRows";
import { LancamentosListaMobile } from "./LancamentosListaMobile";

// Lista de lançamentos do celular: agrupamento por dia com rótulo relativo,
// texto de apoio, deslizar para revelar "Marcar pago", toque/teclado abrem o
// detalhe, estados de carregando/vazio e "Carregar mais".

function lanc(p: Partial<Lancamento>): Lancamento {
  return {
    id: "d-1",
    tipo: "despesa",
    data_vencimento: "2026-11-10",
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

type Props = Parameters<typeof LancamentosListaMobile>[0];

function setup(p: Partial<Props> = {}) {
  const props: Props = {
    items: [],
    loading: false,
    temFiltro: false,
    canEdit: true,
    isPaid: isPaidStatus,
    isOverdue,
    onOpen: vi.fn(),
    onMarkPaid: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    onLoadMore: vi.fn(),
    ...p,
  };
  render(<LancamentosListaMobile {...props} />);
  return props;
}

const nb = (s: string | null | undefined) => (s ?? "").replace(/\u00a0/g, " ");
const linha = (descricao: string) => screen.getByRole("button", { name: new RegExp(`^${descricao},`) });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 10, 12, 0));
  Element.prototype.setPointerCapture = vi.fn();
});
afterEach(() => vi.useRealTimers());

describe("LancamentosListaMobile: estados", () => {
  it("carregando sem itens mostra o loader", () => {
    setup({ loading: true });
    expect(screen.getByText("Buscando lançamentos")).toBeInTheDocument();
  });

  it("vazio de verdade convida a registrar", () => {
    setup();
    expect(screen.getByText("Nenhum lançamento ainda")).toBeInTheDocument();
  });

  it("vazio por filtro sugere mudar o período", () => {
    setup({ temFiltro: true });
    expect(screen.getByText("Nenhum lançamento com esses filtros")).toBeInTheDocument();
    expect(screen.getByText("Mude o período ou limpe os filtros para ver mais.")).toBeInTheDocument();
  });

  it("'Carregar mais' busca a próxima página", () => {
    const p = setup({ items: [lanc({})], hasNextPage: true });
    fireEvent.click(screen.getByRole("button", { name: "Carregar mais" }));
    expect(p.onLoadMore).toHaveBeenCalled();
  });
});

describe("LancamentosListaMobile: agrupamento e conteúdo", () => {
  it("agrupa dias seguidos com rótulo relativo (hoje, ontem, amanhã, dia da semana, sem data)", () => {
    setup({
      items: [
        lanc({ id: "1", descricao: "Hoje A", data_vencimento: "2026-11-10" }),
        lanc({ id: "2", descricao: "Hoje B", data_vencimento: "2026-11-10" }),
        lanc({ id: "3", descricao: "Amanhã", data_vencimento: "2026-11-11" }),
        lanc({ id: "4", descricao: "Ontem", data_vencimento: "2026-11-09" }),
        lanc({ id: "5", descricao: "Sexta", data_vencimento: "2026-11-13" }),
        lanc({ id: "6", descricao: "Sem", data_vencimento: null }),
      ],
    });
    const titulos = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(titulos).toEqual(["Hoje, 10 nov", "Amanhã, 11 nov", "Ontem, 9 nov", "sexta-feira, 13 nov", "Sem data"]);
    const hoje = screen.getByText("Hoje, 10 nov").closest("section") as HTMLElement;
    expect(within(hoje).getAllByRole("button", { name: /despesa/ })).toHaveLength(2);
  });

  it("mostra apoio, situação, parcela e sinal do valor por tipo", () => {
    setup({
      items: [
        lanc({
          id: "a",
          descricao: "Notebook",
          projeto_nome: "Torre",
          contraparte_nome: "Loja",
          parcela_numero: 2,
          parcela_total: 3,
        }),
        lanc({
          id: "b",
          tipo: "receita",
          descricao: "Honorários",
          categoria_nome: "Projetos",
          status: "Recebido",
          data_efetivacao: "2026-11-10",
          valor: 5000,
        }),
        lanc({ id: "c", tipo: "receita", descricao: "Medição", data_vencimento: "2026-11-20" }),
        lanc({ id: "d", descricao: "Luz", data_vencimento: "2026-11-01" }),
        lanc({ id: "e", tipo: "transferencia", descricao: "Reserva", conta_nome: "Itaú", valor: 700 }),
      ],
    });
    const notebook = linha("Notebook");
    expect(within(notebook).getByText("A pagar")).toBeInTheDocument();
    expect(within(notebook).getByText("Torre · Loja · 2/3")).toBeInTheDocument();
    expect(nb(notebook.textContent)).toContain("−R$ 3.000,00");

    const honor = linha("Honorários");
    expect(within(honor).getByText("Projetos · Recebido")).toBeInTheDocument();
    expect(nb(honor.textContent)).toContain("+R$ 5.000,00");
    expect(within(honor).queryByText("A receber")).not.toBeInTheDocument();

    expect(within(linha("Medição")).getByText("A receber")).toBeInTheDocument();
    expect(within(linha("Luz")).getByText("Atrasado")).toBeInTheDocument();

    const reserva = screen.getByRole("button", { name: /^Reserva, transferência/ });
    expect(within(reserva).getByText("Itaú")).toBeInTheDocument();
    expect(nb(reserva.textContent)).toContain("⇄R$ 700,00");
  });

  it("transferência, já paga ou sem permissão: sem ação de marcar", () => {
    setup({
      items: [
        lanc({ id: "a", tipo: "transferencia", descricao: "Reserva" }),
        lanc({ id: "b", status: "Pago", descricao: "Paga" }),
      ],
    });
    expect(screen.queryByText("Marcar pago")).not.toBeInTheDocument();
  });
});

describe("LancamentosListaMobile: toque, teclado e deslizar", () => {
  it("toque e Enter/Espaço abrem o detalhe; outra tecla não", () => {
    const l = lanc({});
    const p = setup({ items: [l] });
    fireEvent.click(linha("Aluguel"));
    fireEvent.keyDown(linha("Aluguel"), { key: "Enter" });
    fireEvent.keyDown(linha("Aluguel"), { key: " " });
    fireEvent.keyDown(linha("Aluguel"), { key: "a" });
    expect(p.onOpen).toHaveBeenCalledTimes(3);
    expect(p.onOpen).toHaveBeenCalledWith(l);
  });

  it("deslizar para a esquerda revela a ação; tocar nela marca e fecha", () => {
    const l = lanc({});
    const p = setup({ items: [l] });
    const row = linha("Aluguel");
    const acao = screen.getByText("Marcar pago").closest("button") as HTMLButtonElement;
    expect(acao).toHaveAttribute("aria-hidden", "true");

    fireEvent.pointerDown(row, { clientX: 200, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(row, { clientX: 100, clientY: 12, pointerId: 1 });
    expect(row.style.transform).toBe("translateX(-100px)");
    fireEvent.pointerUp(row, { clientX: 100, clientY: 12, pointerId: 1 });
    expect(row.style.transform).toBe("translateX(-112px)");
    expect(acao).toHaveAttribute("aria-hidden", "false");
    // O clique que segue o arraste não abre o detalhe.
    fireEvent.click(row);
    expect(p.onOpen).not.toHaveBeenCalled();

    fireEvent.click(acao);
    expect(p.onMarkPaid).toHaveBeenCalledWith(l);
    expect(row.style.transform).toBe("translateX(0px)");
  });

  it("deslize curto volta ao lugar; toque com a linha aberta só fecha", () => {
    const p = setup({ items: [lanc({})] });
    const row = linha("Aluguel");
    fireEvent.pointerDown(row, { clientX: 200, clientY: 10 });
    fireEvent.pointerMove(row, { clientX: 170, clientY: 10 });
    fireEvent.pointerUp(row);
    expect(row.style.transform).toBe("translateX(0px)");
    fireEvent.click(row); // consome o "moveu"

    // Abre de novo e depois toca: fecha sem abrir o detalhe.
    fireEvent.pointerDown(row, { clientX: 200, clientY: 10 });
    fireEvent.pointerMove(row, { clientX: 50, clientY: 10 });
    fireEvent.pointerCancel(row);
    expect(row.style.transform).toBe("translateX(-112px)");
    fireEvent.click(row); // consome o "moveu" do arraste
    fireEvent.click(row);
    expect(row.style.transform).toBe("translateX(0px)");
    expect(p.onOpen).not.toHaveBeenCalled();
  });

  it("movimento vertical ou pequeno é rolagem/toque, não arraste", () => {
    const p = setup({ items: [lanc({})] });
    const row = linha("Aluguel");
    fireEvent.pointerMove(row, { clientX: 0, clientY: 0 }); // sem pointerdown: ignora
    fireEvent.pointerUp(row); // sem pointerdown: ignora
    fireEvent.pointerDown(row, { clientX: 200, clientY: 10 });
    fireEvent.pointerMove(row, { clientX: 197, clientY: 10 });
    fireEvent.pointerMove(row, { clientX: 180, clientY: 80 });
    fireEvent.pointerUp(row);
    expect(row.style.transform).toBe("translateX(0px)");
    fireEvent.click(row);
    expect(p.onOpen).toHaveBeenCalledTimes(1);
  });
});
