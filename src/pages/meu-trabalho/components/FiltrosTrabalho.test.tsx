import { beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { FiltroPessoa } from "./FiltrosTrabalho";

const pessoas = [
  { id: "p2", nome: "Ana Souza" },
  { id: "p1", nome: "Matheus Rezende" },
];

beforeAll(() => {
  // cmdk (Command) mede a lista com ResizeObserver e rola o item ativo; o jsdom não tem nenhum dos dois.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView ??= () => {};
});

describe("FiltroPessoa", () => {
  it("lista a própria pessoa uma vez só, no topo, e não oferece 'Eu'", () => {
    render(<FiltroPessoa value={[]} pessoas={pessoas} minhaPessoaId="p1" onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Filtrar por pessoa" }));
    const itens = screen.getAllByRole("option").map((o) => o.textContent);
    expect(itens[0]).toContain("Matheus Rezende");
    expect(itens[0]).toContain("(você)");
    expect(itens.filter((t) => t?.includes("Matheus Rezende"))).toHaveLength(1);
    expect(itens.some((t) => t?.trim() === "Eu")).toBe(false);
  });

  it("marca e desmarca pela própria pessoa", () => {
    const onChange = vi.fn();
    render(<FiltroPessoa value={[]} pessoas={pessoas} minhaPessoaId="p1" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Filtrar por pessoa" }));
    fireEvent.click(screen.getByText("Matheus Rezende"));
    expect(onChange).toHaveBeenCalledWith(["p1"]);
  });

  it("valor antigo 'eu' (link salvo) conta como a própria pessoa", () => {
    render(<FiltroPessoa value={["eu"]} pessoas={pessoas} minhaPessoaId="p1" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Filtrar por pessoa" })).toHaveTextContent("Matheus Rezende");
  });
});
