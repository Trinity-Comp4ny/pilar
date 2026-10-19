import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DataTable, type ColumnDef } from "./DataTable";

const mobile = vi.hoisted(() => ({ valor: true }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => mobile.valor }));

interface Row {
  id: string;
  nome: string;
  cliente: string;
  status: string;
  valor: string;
  interno: string;
}

const rows: Row[] = [
  { id: "a", nome: "Alvorada", cliente: "Construtora X", status: "Ativo", valor: "R$ 10", interno: "só tabela" },
  { id: "b", nome: "Sumaré", cliente: "Grupo Y", status: "Atenção", valor: "R$ 20", interno: "só tabela" },
];

const comPapeis: ColumnDef<Row>[] = [
  { key: "nome", header: "Projeto", mobile: "title", cell: (r) => r.nome },
  { key: "cliente", header: "Cliente", mobile: "subtitle", cell: (r) => r.cliente },
  { key: "status", header: "Status", mobile: "badge", cell: (r) => r.status },
  { key: "valor", header: "Valor", mobile: "trailing", cell: (r) => r.valor },
  { key: "interno", header: "Interno", cell: (r) => r.interno },
];

const semPapeis: ColumnDef<Row>[] = comPapeis.map(({ mobile: _mobile, ...col }) => col);

describe("DataTable no celular (SPEC 134)", () => {
  beforeEach(() => {
    mobile.valor = true;
  });

  it("renderiza cards no lugar da tabela e esconde a coluna sem papel", () => {
    render(<DataTable columns={comPapeis} data={{ rows }} rowKey={(r) => r.id} />);
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByText("Alvorada")).toBeTruthy();
    expect(screen.getByText("Construtora X")).toBeTruthy();
    expect(screen.getByText("Atenção")).toBeTruthy();
    expect(screen.getByText("R$ 20")).toBeTruthy();
    expect(screen.queryByText("só tabela")).toBeNull();
  });

  it("toque no card chama onRowClick com a linha", () => {
    const onRowClick = vi.fn();
    render(<DataTable columns={comPapeis} data={{ rows }} rowKey={(r) => r.id} onRowClick={onRowClick} />);
    fireEvent.click(screen.getByText("Sumaré"));
    expect(onRowClick).toHaveBeenCalledWith(rows[1]);
  });

  it("Enter no card focado abre a linha", () => {
    const onRowClick = vi.fn();
    render(
      <DataTable
        columns={comPapeis}
        data={{ rows }}
        rowKey={(r) => r.id}
        onRowClick={onRowClick}
        rowLabel={(r) => `Abrir ${r.nome}`}
      />
    );
    fireEvent.keyDown(screen.getByRole("button", { name: "Abrir Alvorada" }), { key: "Enter" });
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);
  });

  it("sem coluna com papel mobile a tabela continua igual", () => {
    render(<DataTable columns={semPapeis} data={{ rows }} rowKey={(r) => r.id} />);
    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.getAllByText("só tabela")).toHaveLength(2);
  });

  it("com seleção por checkbox continua tabela", () => {
    render(<DataTable columns={comPapeis} data={{ rows }} rowKey={(r) => r.id} enableRowSelection />);
    expect(screen.getByRole("table")).toBeTruthy();
  });

  it("no desktop continua tabela mesmo com papéis declarados", () => {
    mobile.valor = false;
    render(<DataTable columns={comPapeis} data={{ rows }} rowKey={(r) => r.id} />);
    expect(screen.getByRole("table")).toBeTruthy();
  });

  it("vazio mostra o estado de vazio e erro mostra o que houve", () => {
    const { rerender } = render(
      <DataTable columns={comPapeis} data={{ rows: [] }} rowKey={(r) => r.id} emptyMessage="Nada por aqui" />
    );
    expect(screen.getByText("Nada por aqui")).toBeTruthy();
    rerender(
      <DataTable
        columns={comPapeis}
        data={{ rows: [], error: new Error("Falhou") }}
        rowKey={(r) => r.id}
        errorTitle="Não foi possível carregar"
      />
    );
    expect(screen.getByRole("alert").textContent).toContain("Não foi possível carregar");
  });

  it("carregando mostra esqueleto e o texto do que está vindo", () => {
    render(
      <DataTable
        columns={comPapeis}
        data={{ rows: [], isPending: true }}
        rowKey={(r) => r.id}
        loadingLabel="Buscando lançamentos"
      />
    );
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByText("Buscando lançamentos")).toBeTruthy();
  });
});
