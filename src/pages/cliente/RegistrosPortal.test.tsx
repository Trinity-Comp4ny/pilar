import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RegistrosPortal } from "./RegistrosPortal";

const registro = { id: "r1", data: "2026-10-19", texto: "Laje do 2º andar concretada.", num_fotos: 2 };

describe("RegistrosPortal", () => {
  it("não renderiza nada sem registro liberado", () => {
    const { container } = render(<RegistrosPortal registros={[]} fotosPorRegistro={{}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("mostra o texto e as fotos do registro", () => {
    render(
      <RegistrosPortal registros={[registro]} fotosPorRegistro={{ r1: ["https://x/1.jpg", "https://x/2.jpg"] }} />
    );
    expect(screen.getByText("Laje do 2º andar concretada.")).toBeInTheDocument();
    expect(screen.getAllByRole("img")).toHaveLength(2);
  });

  it("mostra o texto mesmo enquanto as fotos ainda não carregaram", () => {
    render(<RegistrosPortal registros={[registro]} fotosPorRegistro={{}} />);
    expect(screen.getByText("Laje do 2º andar concretada.")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("mostra no máximo 6 fotos por registro", () => {
    const urls = Array.from({ length: 9 }, (_, i) => `https://x/${i}.jpg`);
    render(<RegistrosPortal registros={[registro]} fotosPorRegistro={{ r1: urls }} />);
    expect(screen.getAllByRole("img")).toHaveLength(6);
  });
});
