import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EtapasProgress } from "./EtapasProgress";

const ROTULOS = ["Seu acesso", "Seu contato", "Seu escritório"];

describe("EtapasProgress", () => {
  it("mostra a etapa atual, o total e o nome da etapa", () => {
    render(<EtapasProgress etapa={2} rotulos={ROTULOS} />);
    expect(screen.getByText("Etapa 2 de 3")).toBeInTheDocument();
    expect(screen.getAllByText("Seu contato").length).toBeGreaterThan(0);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuetext", "Etapa 2 de 3: Seu contato");
  });

  it("não sai do intervalo de etapas", () => {
    const { rerender } = render(<EtapasProgress etapa={0} rotulos={ROTULOS} />);
    expect(screen.getByText("Etapa 1 de 3")).toBeInTheDocument();
    rerender(<EtapasProgress etapa={9} rotulos={ROTULOS} />);
    expect(screen.getByText("Etapa 3 de 3")).toBeInTheDocument();
  });
});
