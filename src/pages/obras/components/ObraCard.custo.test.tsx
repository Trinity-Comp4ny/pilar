import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { ObraResumo } from "@/pages/obras/hooks/useObras";
import { ObraCard } from "./ObraCard";

const obra = {
  id: "1",
  nome: "Casa B3",
  status: "em_andamento",
  avanco: 40,
  projeto: null,
  responsavel: null,
  cidade: null,
  visivel_portal: false,
  cliente_id: null,
  data_fim_prevista: null,
} as unknown as ObraResumo;
const ver = (custo?: { previsto: number; realizado: number }) =>
  render(
    <MemoryRouter>
      <ObraCard obra={obra} custo={custo} />
    </MemoryRouter>
  );

describe("ObraCard: custo", () => {
  it("sem orçado não mostra a linha de custo", () => {
    ver({ previsto: 0, realizado: 100 });
    expect(screen.queryByTestId("obra-custo")).toBeNull();
  });

  it("gasto muito acima do avanço acende vermelho e mostra o percentual", () => {
    ver({ previsto: 1000, realizado: 800 });
    const linha = screen.getByTestId("obra-custo");
    expect(linha).toHaveAttribute("data-semaforo", "vermelho");
    expect(linha).toHaveTextContent("80%");
  });

  it("gasto no ritmo do avanço fica verde", () => {
    ver({ previsto: 1000, realizado: 400 });
    expect(screen.getByTestId("obra-custo")).toHaveAttribute("data-semaforo", "verde");
  });
});
