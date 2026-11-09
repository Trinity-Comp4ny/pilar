import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { TemplateProjeto } from "@/hooks/useTemplates";
import type { FluxoDisciplinas } from "@/types/fluxoDisciplinas";

// Editor de disciplinas do card do agente (paridade com o formulário de projeto): adicionar
// exige nome, responsável repetido é recusado, a última pessoa não sai, template/fluxo
// substituem a lista e o bulk sai no shape do useBulkSaveDisciplinas.

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import { useDisciplinasEditor } from "./useDisciplinasEditor";

const pessoas = [
  { id: "p1", nome: "Rita Alves" },
  { id: "p2", nome: "Davi Melo" },
];

const template = {
  id: "t1",
  nome: "Residencial",
  fases: [
    { disciplinas: [{ disciplina: "Arquitetura" }, { disciplina: "Estrutural" }] },
    { disciplinas: [{ disciplina: "Elétrica" }] },
  ],
} as unknown as TemplateProjeto;

const fluxo = {
  id: "f1",
  nome: "Fluxo padrão",
  disciplinas: [
    { ordem: 1, nome: "Levantamento", responsaveis_ids: ["p1"], responsaveis_nomes: ["Rita Alves"] },
    {
      ordem: 2,
      nome: "Projeto",
      responsaveis_ids: ["ignorado"],
      checklist_padrao: [
        { titulo: "a", responsaveis_ids: ["p2", "p1"], responsaveis_nomes: ["Davi Melo"] },
        { titulo: "b", responsaveis_ids: ["p2"], responsaveis_nomes: ["Davi Melo"] },
      ],
    },
    { ordem: 2, nome: "Compatibilização" },
  ],
} as unknown as FluxoDisciplinas;

function setup(currentUser: { name: string; email: string } | null = { name: "Matheus", email: "m@x" }) {
  return renderHook(() =>
    useDisciplinasEditor({ pessoas, templatesData: [template], fluxosData: [fluxo], currentUser })
  );
}

function adicionar(r: ReturnType<typeof setup>["result"], over: Record<string, string> = {}) {
  act(() => r.current.setTempDisciplina({ ...r.current.tempDisciplina, disciplina: "Arquitetura", ...over }));
  act(() => r.current.addProjetoDisciplina());
}

beforeEach(() => vi.clearAllMocks());

describe("adicionar e remover disciplina", () => {
  it("sem nome não adiciona", () => {
    const { result } = setup();
    act(() => result.current.addProjetoDisciplina());
    expect(result.current.projetosDisciplinas).toEqual([]);
  });

  it("com responsável cria a lista de responsáveis com as datas e limpa o rascunho", () => {
    const { result } = setup();
    adicionar(result, { responsavel_id: "p1", data_inicio: "2026-11-01", data_previsao: "2026-12-01" });
    const [d] = result.current.projetosDisciplinas;
    expect(d).toMatchObject({
      disciplina: "Arquitetura",
      responsavel_nome: "Rita Alves",
      status: "Não Iniciado",
      responsaveis: [
        {
          responsavel_id: "p1",
          responsavel_nome: "Rita Alves",
          data_inicio: "2026-11-01",
          data_previsao: "2026-12-01",
        },
      ],
    });
    expect(result.current.tempDisciplina.disciplina).toBe("");
  });

  it("sem responsável a lista fica vazia; pessoa desconhecida fica sem nome", () => {
    const { result } = setup();
    adicionar(result);
    adicionar(result, { disciplina: "Hidráulica", responsavel_id: "pX" });
    expect(result.current.projetosDisciplinas[0].responsaveis).toEqual([]);
    expect(result.current.projetosDisciplinas[1].responsavel_nome).toBe("");
    act(() => result.current.removeProjetoDisciplina(0));
    expect(result.current.projetosDisciplinas.map((d) => d.disciplina)).toEqual(["Hidráulica"]);
  });
});

describe("responsáveis por disciplina", () => {
  it("adiciona, recusa repetido e troca o placeholder sem pessoa", () => {
    const { result } = setup();
    adicionar(result, { responsavel_id: "p1" });
    act(() =>
      result.current.setNewFormResp({
        responsavel_id: "p2",
        data_inicio: "2026-11-10",
        data_previsao: "",
        data_final: "",
      })
    );
    act(() => result.current.addResponsavelToDisc(0));
    expect(result.current.projetosDisciplinas[0].responsaveis!.map((r) => r.responsavel_id)).toEqual(["p1", "p2"]);
    expect(result.current.projetosDisciplinas[0].responsavel_id).toBe("p2");
    expect(result.current.newFormResp.responsavel_id).toBe("");

    act(() =>
      result.current.setNewFormResp({ responsavel_id: "p1", data_inicio: "", data_previsao: "", data_final: "" })
    );
    act(() => result.current.addResponsavelToDisc(0));
    expect(toast.error).toHaveBeenCalledWith("Responsável já adicionado nesta disciplina");
    expect(result.current.projetosDisciplinas[0].responsaveis).toHaveLength(2);
  });

  it("sem pessoa: só datas vão para a disciplina; sem datas nada muda", () => {
    const { result } = setup();
    adicionar(result);
    const antes = result.current.projetosDisciplinas;
    act(() => result.current.addResponsavelToDisc(0));
    expect(result.current.projetosDisciplinas).toBe(antes);

    act(() =>
      result.current.setNewFormResp({
        responsavel_id: "",
        data_inicio: "2026-11-01",
        data_previsao: "",
        data_final: "2026-11-30",
      })
    );
    act(() => result.current.addResponsavelToDisc(0));
    expect(result.current.projetosDisciplinas[0]).toMatchObject({
      data_inicio: "2026-11-01",
      data_final: "2026-11-30",
    });

    // Agora há um placeholder (datas sem pessoa): a primeira pessoa substitui ele.
    act(() =>
      result.current.setNewFormResp({ responsavel_id: "p2", data_inicio: "", data_previsao: "", data_final: "" })
    );
    act(() => result.current.addResponsavelToDisc(0));
    expect(result.current.projetosDisciplinas[0].responsaveis).toEqual([
      expect.objectContaining({ responsavel_id: "p2", responsavel_nome: "Davi Melo" }),
    ]);
  });

  it("não remove o último responsável; remove os demais e promove o primeiro", () => {
    const { result } = setup();
    adicionar(result, { responsavel_id: "p1" });
    act(() => result.current.removeResponsavelFromDisc(0, 0));
    expect(toast.error).toHaveBeenCalledWith("A disciplina precisa ter ao menos um responsável");
    act(() =>
      result.current.setNewFormResp({ responsavel_id: "p2", data_inicio: "", data_previsao: "", data_final: "" })
    );
    act(() => result.current.addResponsavelToDisc(0));
    act(() => result.current.removeResponsavelFromDisc(0, 0));
    expect(result.current.projetosDisciplinas[0]).toMatchObject({
      responsavel_id: "p2",
      responsavel_nome: "Davi Melo",
    });
  });

  it("data do primeiro responsável espelha no topo; dos demais não", () => {
    const { result } = setup();
    adicionar(result, { responsavel_id: "p1" });
    act(() =>
      result.current.setNewFormResp({ responsavel_id: "p2", data_inicio: "", data_previsao: "", data_final: "" })
    );
    act(() => result.current.addResponsavelToDisc(0));
    act(() => result.current.updateRespDatasInForm(0, 0, "data_previsao", "2026-12-20"));
    act(() => result.current.updateRespDatasInForm(0, 1, "data_inicio", "2026-12-01"));
    act(() => result.current.updateRespDatasInForm(0, 0, "status", "Em Andamento"));
    const d = result.current.projetosDisciplinas[0];
    expect(d.data_previsao).toBe("2026-12-20");
    expect(d.data_inicio).toBeFalsy();
    expect(d.status).toBe("Não Iniciado");
    expect(d.responsaveis![1].data_inicio).toBe("2026-12-01");
    expect(d.responsaveis![0].status).toBe("Em Andamento");
  });
});

describe("detalhe da disciplina", () => {
  it("sem seleção, editar e observar não fazem nada", () => {
    const { result } = setup();
    adicionar(result);
    const antes = result.current.projetosDisciplinas;
    act(() => result.current.updateDisciplinaField("status", "Concluído"));
    act(() => result.current.updateDisciplinaResponsaveis(["p1"]));
    act(() => result.current.setNewObservation("nota"));
    act(() => result.current.handleAddObservation());
    expect(result.current.projetosDisciplinas).toBe(antes);
    expect(result.current.selectedDisciplina).toBeNull();
  });

  it("abre, edita campo, troca responsáveis e registra observação com autor", () => {
    const { result } = setup();
    adicionar(result);
    act(() => result.current.handleOpenDisciplinaDetail(0));
    expect(result.current.isDisciplinaDetailOpen).toBe(true);
    act(() => result.current.updateDisciplinaField("status", "Em Andamento"));
    act(() => result.current.updateDisciplinaResponsaveis(["p2", "p1"]));
    act(() => result.current.setNewObservation("   "));
    act(() => result.current.handleAddObservation());
    expect(result.current.selectedDisciplina!.observacoes).toEqual([]);
    act(() => result.current.setNewObservation("Cliente pediu revisão"));
    act(() => result.current.handleAddObservation());
    const d = result.current.selectedDisciplina!;
    expect(d.status).toBe("Em Andamento");
    expect(d.responsavel_nome).toBe("Davi Melo");
    expect(d.responsaveis).toHaveLength(2);
    expect(d.observacoes![0]).toMatchObject({ texto: "Cliente pediu revisão", usuario: "Matheus" });
    expect(result.current.newObservation).toBe("");
  });

  it("observação sem usuário logado vira 'Usuário'; lista vazia zera o principal", () => {
    const { result } = setup(null);
    adicionar(result, { responsavel_id: "p1" });
    act(() => result.current.handleOpenDisciplinaDetail(0));
    act(() => result.current.setNewObservation("x"));
    act(() => result.current.handleAddObservation());
    act(() => result.current.updateDisciplinaResponsaveis([]));
    expect(result.current.selectedDisciplina!.observacoes![0].usuario).toBe("Usuário");
    expect(result.current.selectedDisciplina).toMatchObject({ responsavel_id: "", responsavel_nome: "" });
  });
});

describe("template, fluxo e bulk", () => {
  it("template inexistente não muda nada; existente substitui pela lista das fases", () => {
    const { result } = setup();
    adicionar(result);
    act(() => result.current.applyTemplate("nao-existe"));
    expect(result.current.projetosDisciplinas).toHaveLength(1);
    act(() => result.current.applyTemplate("t1"));
    expect(result.current.projetosDisciplinas.map((d) => d.disciplina)).toEqual([
      "Arquitetura",
      "Estrutural",
      "Elétrica",
    ]);
    expect(toast.success).toHaveBeenCalledWith("Template aplicado", {
      description: '3 disciplina(s) de "Residencial"',
    });
  });

  it("fluxo usa os responsáveis do checklist antes do fallback e conta colunas", () => {
    const { result } = setup();
    act(() => result.current.applyFluxo("f1"));
    const [lev, proj, comp] = result.current.projetosDisciplinas;
    expect(lev).toMatchObject({ disciplina: "Levantamento", responsavel_id: "p1", etapa: 1 });
    expect(proj.responsaveis!.map((r) => r.responsavel_id)).toEqual(["p2", "p1"]);
    expect(comp).toMatchObject({ responsavel_id: "", responsaveis: [] });
    expect(toast.success).toHaveBeenCalledWith("Fluxo aplicado", {
      description: '3 disciplina(s) em 2 coluna(s) de "Fluxo padrão"',
    });
  });

  it("fluxo nulo limpa; inexistente ignora", () => {
    const { result } = setup();
    adicionar(result);
    act(() => result.current.applyFluxo("nao-existe"));
    expect(result.current.projetosDisciplinas).toHaveLength(1);
    act(() => result.current.applyFluxo(null));
    expect(result.current.projetosDisciplinas).toEqual([]);
  });

  it("bulk: datas vazias viram null e responsáveis vazios saem", () => {
    const { result } = setup();
    adicionar(result, { responsavel_id: "p1", data_inicio: "2026-11-01", data_previsao: "2026-11-30" });
    adicionar(result, { disciplina: "Elétrica" });
    expect(result.current.buildDiscsForBulk()).toEqual([
      {
        nome: "Arquitetura",
        status: "Não Iniciado",
        data_inicio: "2026-11-01",
        data_fim: "2026-11-30",
        data_fim_real: null,
        prioridade: expect.any(String),
        justificativa_atraso: null,
        responsavel_ids: ["p1"],
      },
      expect.objectContaining({ nome: "Elétrica", data_inicio: null, data_fim: null, responsavel_ids: [] }),
    ]);
  });
});
