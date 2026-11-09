import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("compact é uma linha de texto centralizada, sem título em destaque", () => {
    render(<EmptyState compact title="Nenhum incidente aberto." />);
    const texto = screen.getByRole("status");
    expect(texto).toHaveTextContent("Nenhum incidente aberto.");
    expect(texto).toHaveClass("text-center");
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("padrão centraliza ícone, título e descrição", () => {
    render(<EmptyState title="Nenhuma empresa" description="Convide a primeira." />);
    expect(screen.getByRole("status")).toHaveClass("items-center", "text-center");
    expect(screen.getByRole("heading", { name: "Nenhuma empresa" })).toBeInTheDocument();
  });
});
