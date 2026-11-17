import { describe, expect, it } from "vitest";
import type { EstruturaFluxo } from "./fluxoObra";
import {
  haAlgoParaSincronizar,
  planejarSincronizacao,
  resumoDaSincronizacao,
  type NoDaObra,
} from "./sincronizarFluxoObra";

const fluxo: EstruturaFluxo = [
  {
    nome: "Estrutura",
    etapas: [
      {
        nome: "Fundação",
        servicos: [
          { nome: "Sapatas", duracao_dias: 5, fornecedor_id: "f1", paralelo: false, tarefas: ["Escavar", "Concretar"] },
          { nome: "Baldrame", duracao_dias: 3, fornecedor_id: null, paralelo: false, tarefas: ["Armar"] },
        ],
      },
    ],
  },
  {
    nome: "Acabamento",
    etapas: [
      {
        nome: "Pintura",
        servicos: [{ nome: "Parede", duracao_dias: 4, fornecedor_id: null, paralelo: false, tarefas: [] }],
      },
    ],
  },
];

const no = (
  id: string,
  parent_id: string | null,
  nivel: string,
  nome: string,
  extra: Partial<NoDaObra> = {}
): NoDaObra => ({
  id,
  parent_id,
  nivel,
  nome,
  ordem: 0,
  data_inicio: "2026-03-01",
  data_fim: "2026-03-10",
  fornecedor_id: null,
  ...extra,
});

describe("planejarSincronizacao", () => {
  it("obra igual ao fluxo: nada a fazer", () => {
    const nos = [
      no("f", null, "fase", "Estrutura"),
      no("e", "f", "etapa", "Fundação"),
      no("s1", "e", "servico", "Sapatas", { fornecedor_id: "f1" }),
      no("s2", "e", "servico", "Baldrame"),
      no("f2", null, "fase", "Acabamento"),
      no("e2", "f2", "etapa", "Pintura"),
      no("s3", "e2", "servico", "Parede"),
    ];
    const tarefas = [
      { obra_frente_id: "s1", titulo: "Escavar" },
      { obra_frente_id: "s1", titulo: "Concretar" },
      { obra_frente_id: "s2", titulo: "Armar" },
    ];
    expect(haAlgoParaSincronizar(planejarSincronizacao(fluxo, nos, tarefas, "2026-03-01"))).toBe(false);
  });

  it("acrescenta só o que falta, casando por nome sem diferenciar maiúscula e acento", () => {
    const nos = [
      no("f", null, "fase", "ESTRUTURA"),
      no("e", "f", "etapa", "fundacao"),
      no("s1", "e", "servico", "Sapatas"),
    ];
    const p = planejarSincronizacao(fluxo, nos, [{ obra_frente_id: "s1", titulo: "escavar" }], "2026-03-01");
    expect(resumoDaSincronizacao(p)).toEqual({ fases: 1, etapas: 1, servicos: 2, tarefas: 2, prestadores: 1 });
    // Baldrame entra na etapa que já existe; a fase Acabamento entra inteira.
    const baldrame = p.nos.find((n) => n.nome === "Baldrame")!;
    expect(baldrame).toMatchObject({ paiId: "e", paiChave: null, nivel: "servico" });
    const parede = p.nos.find((n) => n.nome === "Parede")!;
    expect(parede.paiId).toBeNull();
    expect(parede.paiChave).toBe(p.nos.find((n) => n.nome === "Pintura")!.chave);
    // Concretar é tarefa nova no serviço existente; Escavar já existia.
    expect(p.tarefas.filter((t) => t.servicoId === "s1").map((t) => t.titulo)).toEqual(["Concretar"]);
    expect(p.prestadores).toEqual([{ id: "s1", fornecedor_id: "f1" }]);
  });

  it("não troca prestador que a obra já tem", () => {
    const nos = [
      no("f", null, "fase", "Estrutura"),
      no("e", "f", "etapa", "Fundação"),
      no("s1", "e", "servico", "Sapatas", { fornecedor_id: "outro" }),
    ];
    expect(planejarSincronizacao(fluxo, nos, [], "2026-03-01").prestadores).toEqual([]);
  });

  it("amplia o período da etapa e da fase que recebem um serviço fora das datas delas", () => {
    const nos = [
      no("f", null, "fase", "Estrutura", { data_inicio: "2026-03-01", data_fim: "2026-03-05" }),
      no("e", "f", "etapa", "Fundação", { data_inicio: "2026-03-01", data_fim: "2026-03-05" }),
      no("s1", "e", "servico", "Sapatas", { data_inicio: "2026-03-01", data_fim: "2026-03-05" }),
    ];
    const p = planejarSincronizacao(fluxo, nos, [], "2026-03-01");
    const e = p.periodos.find((x) => x.id === "e")!;
    expect(e.fim > "2026-03-05").toBe(true);
    expect(p.periodos.find((x) => x.id === "f")!.fim).toBe(e.fim);
  });

  it("obra vazia recebe o fluxo inteiro, com ordem depois do que existe", () => {
    const p = planejarSincronizacao(fluxo, [no("fx", null, "fase", "Outra")], [], "2026-03-01");
    expect(p.nos.filter((n) => n.nivel === "fase").map((n) => [n.nome, n.ordem])).toEqual([
      ["Estrutura", 1],
      ["Acabamento", 2],
    ]);
  });
});
