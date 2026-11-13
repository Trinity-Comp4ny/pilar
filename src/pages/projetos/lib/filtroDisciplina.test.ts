import { describe, expect, it } from "vitest";
import type { Projeto } from "@/types/projetos";
import {
  prioridadeEfetiva,
  projetoAtendeDisciplinas,
  recortarDisciplinas,
  type CriteriosDisciplina,
} from "./filtroDisciplina";

const crit = (c: Partial<CriteriosDisciplina>): CriteriosDisciplina => ({
  prioridades: [],
  pessoaIds: [],
  disciplinaNomes: new Set(),
  ...c,
});

const projeto = (over: Partial<Projeto>): Projeto =>
  ({ id: "p", nome: "P", prioridade: "Media", disciplinas: [], ...over }) as Projeto;

const larissaAlta = {
  disciplina: "Hidráulica",
  responsavel_id: "larissa",
  responsavel_nome: "",
  prioridade: "Alta" as const,
};
const brunoBaixa = {
  disciplina: "Estrutural",
  responsavel_id: "bruno",
  responsavel_nome: "",
  prioridade: "Baixa" as const,
};
const semPrioridade = { disciplina: "Elétrica", responsavel_id: "larissa", responsavel_nome: "" };

describe("filtro por disciplina", () => {
  it("disciplina sem prioridade herda a do projeto", () => {
    expect(prioridadeEfetiva(semPrioridade, projeto({ prioridade: "Alta" }))).toBe("Alta");
    expect(prioridadeEfetiva(larissaAlta, projeto({ prioridade: "Baixa" }))).toBe("Alta");
  });

  it("projeto Baixa com disciplina Alta entra no filtro Alta", () => {
    const p = projeto({ prioridade: "Baixa", disciplinas: [larissaAlta, brunoBaixa] });
    expect(projetoAtendeDisciplinas(p, crit({ prioridades: ["Alta"] }))).toBe(true);
    expect(projetoAtendeDisciplinas(p, crit({ prioridades: ["Media"] }))).toBe(false);
  });

  it("projeto Alta cujas disciplinas são todas Baixa não entra no filtro Alta", () => {
    const p = projeto({ prioridade: "Alta", disciplinas: [brunoBaixa] });
    expect(projetoAtendeDisciplinas(p, crit({ prioridades: ["Alta"] }))).toBe(false);
  });

  it("pessoa e prioridade valem na mesma disciplina", () => {
    const p = projeto({ prioridade: "Baixa", disciplinas: [larissaAlta, brunoBaixa] });
    expect(projetoAtendeDisciplinas(p, crit({ prioridades: ["Alta"], pessoaIds: ["larissa"] }))).toBe(true);
    expect(projetoAtendeDisciplinas(p, crit({ prioridades: ["Alta"], pessoaIds: ["bruno"] }))).toBe(false);
  });

  it("pessoa também casa pela lista de responsáveis", () => {
    const d = { ...brunoBaixa, responsavel_id: "", responsaveis: [{ responsavel_id: "larissa" }] };
    const p = projeto({ disciplinas: [d as never] });
    expect(projetoAtendeDisciplinas(p, crit({ pessoaIds: ["larissa"] }))).toBe(true);
  });

  it("projeto sem disciplina usa a própria prioridade e não passa por pessoa", () => {
    const p = projeto({ prioridade: "Alta" });
    expect(projetoAtendeDisciplinas(p, crit({ prioridades: ["Alta"] }))).toBe(true);
    expect(projetoAtendeDisciplinas(p, crit({ pessoaIds: ["larissa"] }))).toBe(false);
  });

  it("sem critério, tudo passa e nada é recortado", () => {
    const lista = [projeto({ disciplinas: [brunoBaixa] })];
    expect(projetoAtendeDisciplinas(lista[0], crit({}))).toBe(true);
    expect(recortarDisciplinas(lista, crit({}))).toBe(lista);
  });

  it("recorta a aba Disciplinas para só as que atendem", () => {
    const p = projeto({ prioridade: "Baixa", disciplinas: [larissaAlta, brunoBaixa, semPrioridade] });
    const [r] = recortarDisciplinas([p], crit({ pessoaIds: ["larissa"], prioridades: ["Alta"] }));
    expect(r.disciplinas.map((d) => d.disciplina)).toEqual(["Hidráulica"]);
  });
});
