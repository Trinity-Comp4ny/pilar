import { describe, expect, it } from "vitest";
import { calcularDatasEtapasFluxo } from "./fluxoCascata";

describe("calcularDatasEtapasFluxo", () => {
  it("encadeia data_previsao de uma etapa como data_inicio da próxima, pulando fim de semana", () => {
    // 2026-08-20 é quinta-feira
    const r = calcularDatasEtapasFluxo(
      [
        { ordem: 1, duracao_dias_uteis: 2 },
        { ordem: 2, duracao_dias_uteis: 3 },
      ],
      "2026-08-20"
    );

    expect(r[0]).toEqual({ ordem: 1, data_inicio: "2026-08-20", data_previsao: "2026-08-24" });
    expect(r[1]).toEqual({ ordem: 2, data_inicio: "2026-08-24", data_previsao: "2026-08-27" });
  });

  it("etapa sem duração fica sem datas e quebra a cadeia pra próxima etapa", () => {
    const r = calcularDatasEtapasFluxo([{ ordem: 1 }, { ordem: 2, duracao_dias_uteis: 2 }], "2026-08-20");

    expect(r[0]).toEqual({ ordem: 1, data_inicio: "2026-08-20", data_previsao: undefined });
    expect(r[1]).toEqual({ ordem: 2 });
  });

  it("sem data_inicio do projeto, nenhuma etapa recebe data", () => {
    const r = calcularDatasEtapasFluxo([{ ordem: 1, duracao_dias_uteis: 2 }], undefined);

    expect(r).toEqual([{ ordem: 1 }]);
  });

  it("ordena as etapas por 'ordem' antes de encadear, independente da ordem de entrada", () => {
    const r = calcularDatasEtapasFluxo(
      [
        { ordem: 2, duracao_dias_uteis: 3 },
        { ordem: 1, duracao_dias_uteis: 2 },
      ],
      "2026-08-20"
    );

    expect(r[0]).toEqual({ ordem: 1, data_inicio: "2026-08-20", data_previsao: "2026-08-24" });
    expect(r[1]).toEqual({ ordem: 2, data_inicio: "2026-08-24", data_previsao: "2026-08-27" });
  });
});
