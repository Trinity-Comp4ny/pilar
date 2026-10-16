import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { DataTable, type ColumnDef } from "./DataTable";

interface Row {
  id: string;
  nome: string;
  valor: number;
}

const columns: ColumnDef<Row>[] = [
  { key: "nome", header: "Nome", getSortValue: (r) => r.nome, cell: (r) => r.nome },
  {
    key: "valor",
    header: "Valor",
    align: "end",
    getSortValue: (r) => r.valor,
    cell: (r) => r.valor,
  },
];

const rows: Row[] = [
  { id: "a", nome: "Bravo", valor: 30 },
  { id: "b", nome: "Alfa", valor: Infinity }, // não-finito: deve ir para o fim
  { id: "c", nome: "Charlie", valor: 10 },
];

function bodyNames() {
  const table = screen.getByRole("table");
  const rowsEls = within(table).getAllByRole("row").slice(1); // pula o header
  return rowsEls.map((r) => within(r).getAllByRole("cell")[0].textContent);
}

describe("DataTable", () => {
  it("renderiza as linhas na ordem original quando sem ordenação ativa", () => {
    render(<DataTable columns={columns} data={{ rows }} rowKey={(r) => r.id} />);
    expect(bodyNames()).toEqual(["Bravo", "Alfa", "Charlie"]);
  });

  it("ordena por string (localeCompare) ao clicar no cabeçalho, alternando asc/desc", () => {
    render(<DataTable columns={columns} data={{ rows }} rowKey={(r) => r.id} />);
    fireEvent.click(screen.getByRole("button", { name: /Nome/ }));
    expect(bodyNames()).toEqual(["Alfa", "Bravo", "Charlie"]);
    fireEvent.click(screen.getByRole("button", { name: /Nome/ }));
    expect(bodyNames()).toEqual(["Charlie", "Bravo", "Alfa"]);
  });

  it("empurra valor não-finito para o fim, independentemente da direção", () => {
    render(<DataTable columns={columns} data={{ rows }} rowKey={(r) => r.id} />);
    const valorHeader = screen.getByRole("button", { name: /Valor/ });
    fireEvent.click(valorHeader); // asc: 10, 30, Infinity(fim)
    expect(bodyNames()).toEqual(["Charlie", "Bravo", "Alfa"]);
    fireEvent.click(valorHeader); // desc: 30, 10, Infinity ainda no fim
    expect(bodyNames()).toEqual(["Bravo", "Charlie", "Alfa"]);
  });

  it("respeita defaultSortKey/defaultSortDir", () => {
    render(
      <DataTable columns={columns} data={{ rows }} rowKey={(r) => r.id} defaultSortKey="valor" defaultSortDir="asc" />
    );
    expect(bodyNames()).toEqual(["Charlie", "Bravo", "Alfa"]);
  });

  it("mostra estado vazio, de erro e de carregamento", () => {
    const { rerender } = render(
      <DataTable columns={columns} data={{ rows: [] }} rowKey={(r) => r.id} emptyMessage="Nada aqui." />
    );
    expect(screen.getByText("Nada aqui.")).toBeInTheDocument();

    rerender(<DataTable columns={columns} data={{ rows: [], error: new Error("falhou") }} rowKey={(r) => r.id} />);
    expect(screen.getByRole("alert")).toHaveTextContent("falhou");

    rerender(<DataTable columns={columns} data={{ rows: [], isPending: true }} rowKey={(r) => r.id} loadingRows={3} />);
    // skeleton não renderiza texto de linha; a mensagem de vazio não aparece.
    expect(screen.queryByText("Nada aqui.")).not.toBeInTheDocument();
  });

  it("seleciona todas as linhas pelo checkbox mestre e notifica o consumidor", () => {
    const onSelectionChange = vi.fn();
    render(
      <DataTable
        columns={columns}
        data={{ rows }}
        rowKey={(r) => r.id}
        enableRowSelection
        onSelectionChange={onSelectionChange}
      />
    );
    const master = screen.getByLabelText("Selecionar todas as linhas");
    fireEvent.click(master);
    const lastCall = onSelectionChange.mock.calls.at(-1)?.[0] as Row[];
    expect(lastCall.map((r) => r.id).sort()).toEqual(["a", "b", "c"]);
  });

  it("renderiza footer só quando há linhas (não em vazio/erro/loading)", () => {
    const footer = (cols: ColumnDef<Row>[]) => cols.map((c) => <td key={c.key} data-testid={`foot-${c.key}`} />);

    const { rerender } = render(<DataTable columns={columns} data={{ rows }} rowKey={(r) => r.id} footer={footer} />);
    expect(screen.getByTestId("foot-valor")).toBeInTheDocument();

    rerender(<DataTable columns={columns} data={{ rows: [] }} rowKey={(r) => r.id} footer={footer} />);
    expect(screen.queryByTestId("foot-valor")).not.toBeInTheDocument();

    rerender(<DataTable columns={columns} data={{ rows: [], isPending: true }} rowKey={(r) => r.id} footer={footer} />);
    expect(screen.queryByTestId("foot-valor")).not.toBeInTheDocument();
  });

  it("esconde coluna via columnVisibility controlada", () => {
    render(<DataTable columns={columns} data={{ rows }} rowKey={(r) => r.id} columnVisibility={{ valor: false }} />);
    expect(screen.queryByRole("button", { name: /Valor/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Nome/ })).toBeInTheDocument();
  });

  describe("recursos de linha (SPEC 127)", () => {
    it("rowClassName marca só a linha pedida", () => {
      render(
        <DataTable
          columns={columns}
          data={{ rows }}
          rowKey={(r) => r.id}
          rowClassName={(r) => (r.id === "c" ? "opacity-70" : undefined)}
        />
      );
      const linhas = within(screen.getByRole("table")).getAllByRole("row").slice(1);
      expect(linhas.map((l) => l.classList.contains("opacity-70"))).toEqual([false, false, true]);
    });

    it("linha clicável é focável, tem rótulo e abre com Enter e Espaço", () => {
      const onRowClick = vi.fn();
      render(
        <DataTable
          columns={columns}
          data={{ rows }}
          rowKey={(r) => r.id}
          onRowClick={onRowClick}
          rowLabel={(r) => `Ver ${r.nome}`}
        />
      );
      const linha = screen.getByRole("row", { name: "Ver Bravo" });
      expect(linha).toHaveAttribute("tabindex", "0");
      fireEvent.keyDown(linha, { key: "Enter" });
      fireEvent.keyDown(linha, { key: " " });
      expect(onRowClick).toHaveBeenCalledTimes(2);
      expect(onRowClick).toHaveBeenCalledWith(rows[0]);
    });

    it("Enter num botão dentro da linha não abre a linha", () => {
      const onRowClick = vi.fn();
      const comBotao: ColumnDef<Row>[] = [
        ...columns,
        { key: "acao", header: "Ação", cell: () => <button type="button">Mais</button> },
      ];
      render(<DataTable columns={comBotao} data={{ rows }} rowKey={(r) => r.id} onRowClick={onRowClick} />);
      fireEvent.keyDown(screen.getAllByRole("button", { name: "Mais" })[0], { key: "Enter" });
      expect(onRowClick).not.toHaveBeenCalled();
    });

    it("sem onRowClick a linha não vira focável", () => {
      render(<DataTable columns={columns} data={{ rows }} rowKey={(r) => r.id} />);
      const linha = within(screen.getByRole("table")).getAllByRole("row")[1];
      expect(linha).not.toHaveAttribute("tabindex");
    });

    it("renderExpanded aparece só para o id expandido e devolve null sem expandir", () => {
      const { rerender } = render(
        <DataTable
          columns={columns}
          data={{ rows }}
          rowKey={(r) => r.id}
          renderExpanded={(r) => `detalhe de ${r.nome}`}
          expandedIds={new Set(["c"])}
        />
      );
      expect(screen.getByText("detalhe de Charlie")).toBeInTheDocument();
      expect(screen.queryByText("detalhe de Bravo")).not.toBeInTheDocument();

      rerender(
        <DataTable
          columns={columns}
          data={{ rows }}
          rowKey={(r) => r.id}
          renderExpanded={() => null}
          expandedIds={new Set(["c"])}
        />
      );
      expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(4);
    });
  });

  describe("densidade e linhas extras (SPEC 127, fase 2)", () => {
    it("density compact enxuga cabeçalho e células", () => {
      render(<DataTable columns={columns} data={{ rows }} rowKey={(r) => r.id} density="compact" />);
      expect(screen.getByRole("columnheader", { name: /Nome/ })).toHaveClass("h-9", "uppercase");
      expect(screen.getAllByRole("cell")[0]).toHaveClass("py-2");
    });

    it("extraRows aparece depois das linhas", () => {
      render(
        <DataTable
          columns={columns}
          data={{ rows }}
          rowKey={(r) => r.id}
          extraRows={
            <tr>
              <td colSpan={2}>nova linha</td>
            </tr>
          }
        />
      );
      const linhas = within(screen.getByRole("table")).getAllByRole("row");
      expect(linhas[linhas.length - 1]).toHaveTextContent("nova linha");
    });

    it("sem linhas, extraRows substitui a mensagem de vazio", () => {
      render(
        <DataTable
          columns={columns}
          data={{ rows: [] }}
          rowKey={(r) => r.id}
          emptyMessage="Nada aqui"
          extraRows={
            <tr>
              <td colSpan={2}>adicionar</td>
            </tr>
          }
        />
      );
      expect(screen.queryByText("Nada aqui")).not.toBeInTheDocument();
      expect(screen.getByText("adicionar")).toBeInTheDocument();
    });
  });
});
