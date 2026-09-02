import { describe, expect, it } from "vitest";
import { calcularDatasFluxo, duracaoEfetiva, responsaveisEfetivos } from "./fluxoCascata";

describe("calcularDatasFluxo", () => {
  it("encadeia data_previsao de uma disciplina como data_inicio da próxima, pulando fim de semana", () => {
    // 2026-08-20 é quinta-feira
    const r = calcularDatasFluxo(
      [
        { ordem: 1, nome: "Arquitetônico", duracao_dias_uteis: 2 },
        { ordem: 2, nome: "Estrutural", duracao_dias_uteis: 3 },
      ],
      "2026-08-20"
    );

    expect(r[0]).toEqual({ ordem: 1, nome: "Arquitetônico", data_inicio: "2026-08-20", data_previsao: "2026-08-24" });
    expect(r[1]).toEqual({ ordem: 2, nome: "Estrutural", data_inicio: "2026-08-24", data_previsao: "2026-08-27" });
  });

  it("disciplinas paralelas com durações diferentes: a próxima coluna espera a mais lenta", () => {
    const r = calcularDatasFluxo(
      [
        { ordem: 1, nome: "Arquitetônico", duracao_dias_uteis: 5 },
        { ordem: 1, nome: "Elétrico", duracao_dias_uteis: 3 },
        { ordem: 2, nome: "Estrutural", duracao_dias_uteis: 2 },
      ],
      "2026-08-20"
    );

    const arquitetonico = r.find((d) => d.nome === "Arquitetônico")!;
    const eletrico = r.find((d) => d.nome === "Elétrico")!;
    const estrutural = r.find((d) => d.nome === "Estrutural")!;

    expect(arquitetonico.data_previsao).toBe("2026-08-27");
    expect(eletrico.data_previsao).toBe("2026-08-25");
    expect(estrutural.data_inicio).toBe("2026-08-27");
    expect(estrutural.data_previsao).toBe("2026-08-31");
  });

  it("disciplina sem duração fica sem data_previsao e quebra a cadeia pro grupo seguinte", () => {
    const r = calcularDatasFluxo(
      [
        { ordem: 1, nome: "A" },
        { ordem: 2, nome: "B", duracao_dias_uteis: 2 },
      ],
      "2026-08-20"
    );

    expect(r[0]).toEqual({ ordem: 1, nome: "A", data_inicio: "2026-08-20", data_previsao: undefined });
    expect(r[1]).toEqual({ ordem: 2, nome: "B" });
  });

  it("sem data_inicio do projeto, nenhuma disciplina recebe data", () => {
    const r = calcularDatasFluxo([{ ordem: 1, nome: "A", duracao_dias_uteis: 2 }], undefined);

    expect(r).toEqual([{ ordem: 1, nome: "A" }]);
  });

  it("ordena por 'ordem' antes de encadear, independente da ordem de entrada, e preserva a ordem original na saída", () => {
    const r = calcularDatasFluxo(
      [
        { ordem: 2, nome: "B", duracao_dias_uteis: 3 },
        { ordem: 1, nome: "A", duracao_dias_uteis: 2 },
      ],
      "2026-08-20"
    );

    expect(r[0]).toEqual({ ordem: 2, nome: "B", data_inicio: "2026-08-24", data_previsao: "2026-08-27" });
    expect(r[1]).toEqual({ ordem: 1, nome: "A", data_inicio: "2026-08-20", data_previsao: "2026-08-24" });
  });
});

describe("duracaoEfetiva", () => {
  it("soma os itens de checklist com dias definidos, ignorando os sem duração", () => {
    const efetiva = duracaoEfetiva({
      duracao_dias_uteis: 99,
      checklist_padrao: [
        { texto: "Briefing", duracao_dias_uteis: 2 },
        { texto: "Ligar pro cliente confirmando medida" },
        { texto: "Anteprojeto", duracao_dias_uteis: 4 },
      ],
    });

    expect(efetiva).toBe(6);
  });

  it("sem nenhum item de checklist com duração, cai no campo manual da disciplina", () => {
    expect(duracaoEfetiva({ duracao_dias_uteis: 8, checklist_padrao: [{ texto: "Só texto" }] })).toBe(8);
    expect(duracaoEfetiva({ duracao_dias_uteis: 8 })).toBe(8);
  });
});

describe("responsaveisEfetivos", () => {
  it("une os responsáveis das tarefas que têm, sem duplicar", () => {
    const efetivos = responsaveisEfetivos({
      responsaveis_ids: ["fallback"],
      responsaveis_nomes: ["Fallback"],
      checklist_padrao: [
        { texto: "Fôrma", responsaveis_ids: ["p1", "p2"], responsaveis_nomes: ["Beatriz", "Carlos"] },
        { texto: "Concretagem", responsaveis_ids: ["p2"], responsaveis_nomes: ["Carlos"] },
        { texto: "Sem responsável" },
      ],
    });

    expect(efetivos).toEqual({ ids: ["p1", "p2"], nomes: ["Beatriz", "Carlos"] });
  });

  it("sem nenhuma tarefa com responsável, cai no fallback manual da disciplina", () => {
    expect(
      responsaveisEfetivos({
        responsaveis_ids: ["p1"],
        responsaveis_nomes: ["Beatriz"],
        checklist_padrao: [{ texto: "Sem responsável" }],
      })
    ).toEqual({ ids: ["p1"], nomes: ["Beatriz"] });

    expect(responsaveisEfetivos({})).toEqual({ ids: [], nomes: [] });
  });
});
