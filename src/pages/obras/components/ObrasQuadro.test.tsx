import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { ObraResumo } from "@/pages/obras/hooks/useObras";
import { ObrasQuadro } from "./ObrasQuadro";

const obra = (id: string, nome: string, status: string) =>
  ({
    id,
    nome,
    status,
    avanco: 10,
    projeto: null,
    responsavel: null,
    cidade: null,
    visivel_portal: false,
    cliente_id: null,
  }) as unknown as ObraResumo;

describe("ObrasQuadro", () => {
  it("separa as obras nas colunas pelo status", () => {
    render(
      <MemoryRouter>
        <ObrasQuadro
          obras={[obra("1", "Casa B3", "em_andamento"), obra("2", "Sobrado", "planejada")]}
          podeEditar
          onMudarStatus={vi.fn()}
        />
      </MemoryRouter>
    );
    for (const titulo of ["Planejada", "Em andamento", "Paralisada", "Concluída"]) {
      expect(screen.getByRole("heading", { name: titulo })).toBeInTheDocument();
    }
    expect(screen.getByText("Casa B3")).toBeInTheDocument();
    expect(screen.getByText("Sobrado")).toBeInTheDocument();
  });
});
