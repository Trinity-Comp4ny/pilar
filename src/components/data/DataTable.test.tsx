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
      <DataTable
        columns={columns}
        data={{ rows }}
        rowKey={(r) => r.id}
        defaultSortKey="valor"
        defaultSortDir="asc"
      />,
    );
    expect(bodyNames()).toEqual(["Charlie", "Bravo", "Alfa"]);
  });

  it("mostra estado vazio, de erro e de carregamento", () => {
    const { rerender } = render(
      <DataTable columns={columns} data={{ rows: [] }} rowKey={(r) => r.id} emptyMessage="Nada aqui." />,
    );
    expect(screen.getByText("Nada aqui.")).toBeInTheDocument();

    rerender(
      <DataTable
        columns={columns}
        data={{ rows: [], error: new Error("falhou") }}
        rowKey={(r) => r.id}
      />,
    );
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
      />,
    );
    const master = screen.getByLabelText("Selecionar todas as linhas");
    fireEvent.click(master);
    const lastCall = onSelectionChange.mock.calls.at(-1)?.[0] as Row[];
    expect(lastCall.map((r) => r.id).sort()).toEqual(["a", "b", "c"]);
  });

  it("renderiza footer só quando há linhas (não em vazio/erro/loading)", () => {
    const footer = (cols: ColumnDef<Row>[]) =>
      cols.map((c) => <td key={c.key} data-testid={`foot-${c.key}`} />);

    const { rerender } = render(
      <DataTable columns={columns} data={{ rows }} rowKey={(r) => r.id} footer={footer} />,
    );
    expect(screen.getByTestId("foot-valor")).toBeInTheDocument();

    rerender(<DataTable columns={columns} data={{ rows: [] }} rowKey={(r) => r.id} footer={footer} />);
    expect(screen.queryByTestId("foot-valor")).not.toBeInTheDocument();

    rerender(
      <DataTable columns={columns} data={{ rows: [], isPending: true }} rowKey={(r) => r.id} footer={footer} />,
    );
    expect(screen.queryByTestId("foot-valor")).not.toBeInTheDocument();
  });

  it("esconde coluna via columnVisibility controlada", () => {
    render(
      <DataTable
        columns={columns}
        data={{ rows }}
        rowKey={(r) => r.id}
        columnVisibility={{ valor: false }}
      />,
    );
    expect(screen.queryByRole("button", { name: /Valor/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Nome/ })).toBeInTheDocument();
  });
});
