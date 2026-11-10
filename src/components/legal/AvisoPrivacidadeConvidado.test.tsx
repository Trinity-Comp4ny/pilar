import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AvisoPrivacidadeConvidado } from "./AvisoPrivacidadeConvidado";

describe("AvisoPrivacidadeConvidado", () => {
  it("nomeia o escritório como quem trata os dados e liga para a política", () => {
    render(<AvisoPrivacidadeConvidado escritorio="Estrutura & Cia" />);
    expect(screen.getByText(/tratados por Estrutura & Cia, que usa o Pilar/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Política de Privacidade" })).toHaveAttribute("href", "/privacidade");
  });

  it("sem nome do escritório, usa uma referência genérica", () => {
    render(<AvisoPrivacidadeConvidado escritorio="  " />);
    expect(screen.getByText(/pelo escritório que convidou você/)).toBeInTheDocument();
  });
});
