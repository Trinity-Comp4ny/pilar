import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DADOS_EXEMPLO } from "../exemplo";
import type { PainelGestao } from "@/pages/inicio/hooks/usePainelGestao";
import { ListaPrazos } from "./Listas";

// Spec 141: projeto pausado tem prazo congelado, fica fora de "vence em 15 dias" e a nota diz quantos.

function comPausados(paralisado: number, prazos: PainelGestao["projetos"]["prazos15Dias"] = []): PainelGestao {
  return {
    ...DADOS_EXEMPLO,
    projetos: {
      ...DADOS_EXEMPLO.projetos,
      totais: { ...DADOS_EXEMPLO.projetos.totais, paralisado },
      prazos15Dias: prazos,
    },
  };
}

function renderiza(data: PainelGestao) {
  render(
    <MemoryRouter>
      <ListaPrazos data={data} />
    </MemoryRouter>
  );
}

describe("ListaPrazos com projeto pausado", () => {
  it("lista vazia explica o que ficou de fora", () => {
    renderiza(comPausados(1));
    expect(screen.getByText("Nenhuma disciplina em aberto vence nos próximos 15 dias.")).toBeInTheDocument();
    expect(screen.getByText("1 projeto pausado fica fora desta lista.")).toBeInTheDocument();
  });

  it("plural quando há mais de um", () => {
    renderiza(comPausados(3));
    expect(screen.getByText("3 projetos pausados ficam fora desta lista.")).toBeInTheDocument();
  });

  it("sem projeto pausado não mostra a nota", () => {
    renderiza(comPausados(0));
    expect(screen.queryByText(/fora desta lista/)).not.toBeInTheDocument();
  });

  it("com prazos na lista, a nota vem depois deles", () => {
    renderiza(
      comPausados(2, [
        {
          disciplinaId: "d1",
          disciplina: "Elétrica",
          projetoId: "p1",
          projeto: "Galpão Sul",
          dias: 4,
          responsavel: "Ana",
        },
      ])
    );
    expect(screen.getByText(/Elétrica · Galpão Sul/)).toBeInTheDocument();
    expect(screen.getByText("2 projetos pausados ficam fora desta lista.")).toBeInTheDocument();
  });
});
