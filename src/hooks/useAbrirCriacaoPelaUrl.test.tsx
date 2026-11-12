import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { useAbrirCriacaoPelaUrl } from "./useAbrirCriacaoPelaUrl";

function Pagina({ permitido, abrir }: { permitido: boolean; abrir: (v: string) => void }) {
  useAbrirCriacaoPelaUrl(permitido, abrir);
  const navigate = useNavigate();
  const { search } = useLocation();
  return (
    <>
      <div data-testid="search">{search}</div>
      <button type="button" onClick={() => navigate("/x?new=1")}>
        paleta
      </button>
    </>
  );
}

function montar(url: string, permitido = true) {
  const abrir = vi.fn();
  render(
    <MemoryRouter initialEntries={[url]}>
      <Pagina permitido={permitido} abrir={abrir} />
    </MemoryRouter>
  );
  return abrir;
}

describe("useAbrirCriacaoPelaUrl", () => {
  it("abre com o valor do param e tira só ele da URL", () => {
    const abrir = montar("/x?tab=lancamentos&new=receita");
    expect(abrir).toHaveBeenCalledWith("receita");
    expect(screen.getByTestId("search")).toHaveTextContent(/^\?tab=lancamentos$/);
  });

  it("sem o param não abre nem mexe na URL", () => {
    const abrir = montar("/x?v=lista");
    expect(abrir).not.toHaveBeenCalled();
    expect(screen.getByTestId("search")).toHaveTextContent("?v=lista");
  });

  it("sem permissão não abre, mas limpa o param", () => {
    const abrir = montar("/x?new=1", false);
    expect(abrir).not.toHaveBeenCalled();
    expect(screen.getByTestId("search")).toBeEmptyDOMElement();
  });

  it("já na página, abre quando a navegação traz o param", () => {
    const abrir = montar("/x");
    expect(abrir).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "paleta" }));
    expect(abrir).toHaveBeenCalledWith("1");
    expect(screen.getByTestId("search")).toBeEmptyDOMElement();
  });
});
