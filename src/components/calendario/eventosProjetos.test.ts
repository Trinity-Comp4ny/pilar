import { describe, expect, it } from "vitest";
import type { Projeto } from "@/types/projetos";
import {
  addDays,
  buildEventosProjetos,
  endOfMonth,
  fmtKey,
  groupByDia,
  startOfMonth,
  startOfWeek,
  weekdayIndex,
  type PrazoEvento,
} from "./eventos";

const ontem = fmtKey(addDays(new Date(), -1));
const em3dias = fmtKey(addDays(new Date(), 3));
const em30dias = fmtKey(addDays(new Date(), 30));

function projeto(over: Omit<Partial<Projeto>, "disciplinas"> & { disciplinas?: unknown[] }): Projeto {
  return {
    id: "p1",
    nome: "Residencial Seed",
    status: "Em Andamento",
    data_previsao: em30dias,
    disciplinas: [],
    ...over,
  } as unknown as Projeto;
}

describe("buildEventosProjetos", () => {
  const projetos = [
    projeto({
      disciplinas: [
        {
          id: "d1",
          disciplina: "Estrutural",
          data_previsao: ontem,
          status: "Em Andamento",
          responsaveis: [{ responsavel_id: "r1", responsavel_nome: "Ana Seed" }],
        },
        { disciplina: "Elétrica", data_previsao: em3dias, status: "" },
        { id: "d3", disciplina: "Hidráulica", data_previsao: null },
        { id: "d4", disciplina: "Pausada", data_previsao: ontem, status: "Pausada" },
        { id: "d5", disciplina: "Pronta", data_previsao: ontem, status: "Concluído" },
      ],
    }),
    projeto({ id: "p2", nome: "Galpão Seed", status: "Paralisado", data_previsao: ontem, disciplinas: [] }),
    projeto({ id: "p3", nome: "Concluído", status: "Cancelado", data_previsao: ontem, disciplinas: [] }),
    projeto({ id: "p4", nome: "Sem prazo", data_previsao: null as unknown as string, disciplinas: [] }),
  ];

  it("emite projeto e disciplinas com estado por prazo, pausa e conclusão", () => {
    const ev = buildEventosProjetos(projetos, "todos", "todos", "");
    const porTitulo = Object.fromEntries(ev.map((e) => [e.titulo, e]));
    expect(porTitulo["Residencial Seed"]).toMatchObject({ camada: "projeto", estado: "futuro" });
    expect(porTitulo["Estrutural"]).toMatchObject({
      camada: "disciplina",
      estado: "atrasado",
      responsavel: "Ana Seed",
      subtitulo: "Residencial Seed",
    });
    expect(porTitulo["Elétrica"]).toMatchObject({ id: "p1-Elétrica", estado: "proximo", status: "Não Iniciado" });
    expect(porTitulo["Pausada"].estado).toBe("pausado");
    expect(porTitulo["Pronta"].estado).toBe("concluido");
    expect(porTitulo["Galpão Seed"].estado).toBe("pausado");
    expect(porTitulo["Concluído"].estado).toBe("concluido");
    expect(porTitulo["Hidráulica"]).toBeUndefined();
    expect(porTitulo["Sem prazo"]).toBeUndefined();
  });

  it("filtra por projeto, responsável e busca", () => {
    expect(buildEventosProjetos(projetos, "p2", "todos", "").map((e) => e.titulo)).toEqual(["Galpão Seed"]);
    expect(buildEventosProjetos(projetos, "todos", "ana", "").map((e) => e.titulo)).toEqual(["Estrutural"]);
    expect(buildEventosProjetos(projetos, "todos", "ninguém", "")).toEqual([]);
    expect(buildEventosProjetos(projetos, "todos", "todos", "  GALPÃO ").map((e) => e.titulo)).toEqual(["Galpão Seed"]);
    // busca também olha o subtítulo (nome do projeto) das disciplinas
    expect(buildEventosProjetos(projetos, "todos", "todos", "residencial").length).toBe(5);
  });
});

describe("datas do calendário", () => {
  it("semana começa na segunda e mês tem início e fim", () => {
    const quarta = new Date(2026, 10, 4);
    expect(weekdayIndex(quarta)).toBe(2);
    expect(fmtKey(startOfWeek(quarta))).toBe("2026-11-02");
    expect(fmtKey(startOfWeek(new Date(2026, 10, 8)))).toBe("2026-11-02");
    expect(fmtKey(startOfMonth(quarta))).toBe("2026-11-01");
    expect(fmtKey(endOfMonth(quarta))).toBe("2026-11-30");
  });

  it("agrupa eventos por dia", () => {
    const ev = [
      { data: "2026-11-01", titulo: "a" },
      { data: "2026-11-01", titulo: "b" },
      { data: "2026-11-02", titulo: "c" },
    ] as PrazoEvento[];
    const mapa = groupByDia(ev);
    expect(mapa.get("2026-11-01")?.map((e) => e.titulo)).toEqual(["a", "b"]);
    expect(mapa.get("2026-11-02")).toHaveLength(1);
  });
});
