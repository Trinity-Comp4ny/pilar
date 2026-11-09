import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { FilterBar, FilterClear, FilterPopover, FilterSelect } from "./FilterBar";

const OPCOES = [
  { value: "todos", label: "Todos" },
  { value: "pago", label: "Pago" },
];

describe("FilterSelect", () => {
  it("no valor vazio mostra só o rótulo e não fica verde", () => {
    render(<FilterSelect label="Status" value="todos" emptyValue="todos" onChange={() => {}} options={OPCOES} />);
    const gatilho = screen.getByRole("button", { name: "Status" });
    expect(gatilho).toHaveTextContent("Status");
    expect(gatilho).not.toHaveClass("bg-brand");
  });

  it("ativo mostra Rótulo: opção, fica verde e limpa pelo x", () => {
    const onChange = vi.fn();
    render(<FilterSelect label="Status" value="pago" emptyValue="todos" onChange={onChange} options={OPCOES} />);
    const gatilho = screen.getByRole("button", { name: "Status" });
    expect(gatilho).toHaveTextContent("Status: Pago");
    expect(gatilho).toHaveClass("bg-brand", "text-ink");
    fireEvent.click(screen.getByRole("button", { name: "Limpar filtro Status" }));
    expect(onChange).toHaveBeenCalledWith("todos");
  });
});

describe("FilterClear", () => {
  it("não renderiza sem filtro ativo", () => {
    const { container } = render(<FilterClear count={0} onClick={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("mostra a contagem e dispara a limpeza", () => {
    const onClick = vi.fn();
    render(<FilterClear count={2} onClick={onClick} />);
    fireEvent.click(screen.getByRole("button", { name: /Limpar/ }));
    expect(onClick).toHaveBeenCalled();
  });
});

describe("FilterPopover", () => {
  it("com filtros ativos o gatilho fica verde e mostra a contagem", () => {
    render(
      <FilterPopover count={3} onClear={() => {}}>
        <div />
      </FilterPopover>
    );
    const gatilho = screen.getByRole("button", { name: "Filtros" });
    expect(gatilho).toHaveClass("bg-brand");
    expect(gatilho).toHaveTextContent("3");
  });
});

describe("FilterBar", () => {
  it("é uma toolbar e coloca `end` à direita", () => {
    render(<FilterBar end={<span>fim</span>}>miolo</FilterBar>);
    expect(screen.getByRole("toolbar", { name: "Filtros" })).toHaveTextContent("miolofim");
  });
});
