import { describe, expect, it } from "vitest";
import { getDeadlineStatus, getDiscDeadlineStatus, isDiscAtrasada, type DisciplinaResponsavel } from "./projetos";

const venceu = "2020-01-01";

function disc(parcial: Partial<DisciplinaResponsavel>): DisciplinaResponsavel {
  return {
    disciplina: "Estrutural",
    data_previsao: venceu,
    status: "Em Andamento",
    ...parcial,
  } as DisciplinaResponsavel;
}

describe("prazo congelado (spec 141)", () => {
  it("disciplina em andamento com prazo vencido é atrasada", () => {
    expect(isDiscAtrasada(disc({}))).toBe(true);
  });

  it("disciplina pausada com prazo vencido não é atrasada", () => {
    expect(isDiscAtrasada(disc({ status: "Pausada" }))).toBe(false);
  });

  it("disciplina pausada vira 'pausado', nunca 'em_atraso'", () => {
    expect(getDiscDeadlineStatus({ data_previsao: venceu, status: "Pausada" })?.status_data).toBe("pausado");
  });

  it("projeto Paralisado vira 'pausado', nunca 'em_atraso'", () => {
    expect(getDeadlineStatus({ data_previsao: venceu, status: "Paralisado" })?.status_data).toBe("pausado");
    expect(getDeadlineStatus({ data_previsao: venceu, status: "Em andamento" })?.status_data).toBe("em_atraso");
  });
});
