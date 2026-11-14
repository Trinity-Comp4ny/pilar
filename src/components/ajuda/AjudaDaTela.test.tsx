import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AjudaDaTela } from "./AjudaDaTela";
import { DentroDoMainProvider } from "@/components/mainLandmark";
import { EVENTO_ABRIR_AGENTE } from "@/lib/agenteAjudaEvento";

function em(rota: string) {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <AjudaDaTela />
    </MemoryRouter>
  );
}

describe("AjudaDaTela (SPEC 154)", () => {
  it("um artigo da tela abre direto", () => {
    em("/gestao/propostas");
    expect(screen.getByRole("link", { name: "Ajuda desta tela" })).toHaveAttribute(
      "href",
      "/ajuda/criar-e-enviar-proposta"
    );
  });

  it("mais de um artigo abre a lista da tela", () => {
    em("/gestao/leads");
    expect(screen.getByRole("link", { name: "Ajuda desta tela" })).toHaveAttribute(
      "href",
      "/ajuda?tela=%2Fgestao%2Fleads"
    );
  });

  it("tela sem artigo e a própria central não mostram o botão", () => {
    em("/inicio");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("dentro do app, abre o painel Dúvidas, mesmo em tela sem artigo", () => {
    const ouvinte = vi.fn();
    window.addEventListener(EVENTO_ABRIR_AGENTE, ouvinte);
    render(
      <MemoryRouter initialEntries={["/inicio"]}>
        <DentroDoMainProvider value>
          <AjudaDaTela />
        </DentroDoMainProvider>
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole("button", { name: "Dúvidas sobre esta tela" }));
    expect(ouvinte).toHaveBeenCalledTimes(1);
    window.removeEventListener(EVENTO_ABRIR_AGENTE, ouvinte);
  });

  it("fora de um router não quebra", () => {
    const { container } = render(<AjudaDaTela />);
    expect(container).toBeEmptyDOMElement();
  });
});
