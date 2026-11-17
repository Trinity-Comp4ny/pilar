import { describe, expect, it } from "vitest";
import { terceirizadaPendenteAnterior } from "./terceirizadas";
import type { DisciplinaResponsavel } from "@/types/projetos";
import { planejarAplicacaoFluxo } from "@/lib/fluxoCascata";
const disc = (patch: Partial<DisciplinaResponsavel>): DisciplinaResponsavel => ({
  disciplina: "Serviço",
  responsavel_id: "",
  responsavel_nome: "",
  ...patch,
});
describe("dependência terceirizada", () => {
  it("aguarda o serviço externo anterior, inclusive sem responsável interno", () => {
    const externa = disc({ etapa: 1, tipo_execucao: "terceirizada", prestador_nome: "Fornecedor" });
    const seguinte = disc({ etapa: 2 });
    expect(terceirizadaPendenteAnterior(seguinte, [externa, seguinte])).toBe(externa);
  });
  it("não bloqueia paralelas e libera após conclusão", () => {
    const externa = disc({ etapa: 1, tipo_execucao: "terceirizada" });
    expect(terceirizadaPendenteAnterior(disc({ etapa: 1 }), [externa])).toBeNull();
    expect(terceirizadaPendenteAnterior(disc({ etapa: 2 }), [{ ...externa, status: "Concluído" }])).toBeNull();
    expect(terceirizadaPendenteAnterior(disc({ etapa: 2 }), [{ ...externa, data_final: "2026-11-17" }])).toBeNull();
  });
  it("aplicar fluxo preserva o prestador sem inventar usuário", () => {
    const plano = planejarAplicacaoFluxo(
      [{ nome: "Medição", ordem: 1, tipo_execucao: "terceirizada", prestador_nome: "Empresa parceira" }],
      [],
      "2026-11-17"
    );
    expect(plano.novas[0]).toMatchObject({
      tipo_execucao: "terceirizada",
      prestador_nome: "Empresa parceira",
      responsavel_ids: [],
    });
  });
});
