import { describe, expect, it } from "vitest";
import {
  achatarEstrutura,
  agruparLinhas,
  duracaoTotalDias,
  estruturaDeObra,
  normalizarEstrutura,
  planoDoFluxo,
  type EstruturaFluxo,
} from "./fluxoObra";

const fluxo: EstruturaFluxo = [
  {
    nome: "Estrutura",
    etapas: [
      {
        nome: "Fundação",
        servicos: [
          { nome: "Sapatas", duracao_dias: 5, fornecedor_id: "f1", paralelo: false, tarefas: ["Escavar", "Concretar"] },
          { nome: "Baldrame", duracao_dias: 3, fornecedor_id: null, paralelo: false, tarefas: [] },
        ],
      },
      {
        nome: "Elétrica",
        servicos: [
          { nome: "Eletrodutos", duracao_dias: 4, fornecedor_id: "f2", paralelo: true, tarefas: ["Passar tubulação"] },
        ],
      },
    ],
  },
];

describe("planoDoFluxo", () => {
  it("encadeia os serviços e cobre etapa e fase com o período dos filhos", () => {
    const p = planoDoFluxo(fluxo, "2026-03-01");
    const por = (nome: string) => p.itens.find((i) => i.nome === nome)!;
    expect(por("Sapatas")).toMatchObject({ inicio: "2026-03-01", fim: "2026-03-05", fornecedorId: "f1" });
    expect(por("Baldrame")).toMatchObject({ inicio: "2026-03-06", fim: "2026-03-08" });
    // Paralelo: começa junto do serviço anterior (Baldrame), não depois dele.
    expect(por("Eletrodutos")).toMatchObject({ inicio: "2026-03-06", fim: "2026-03-09" });
    expect(por("Fundação")).toMatchObject({ inicio: "2026-03-01", fim: "2026-03-08" });
    expect(por("Estrutura")).toMatchObject({ inicio: "2026-03-01", fim: "2026-03-09" });
    expect(duracaoTotalDias(p)).toBe(9);
    expect(p.erro).toBeNull();
  });

  it("as tarefas herdam o período do serviço", () => {
    const p = planoDoFluxo(fluxo, "2026-03-01");
    expect(p.tarefas.filter((t) => t.titulo === "Escavar")[0]).toMatchObject({
      inicio: "2026-03-01",
      prazo: "2026-03-05",
    });
    expect(p.tarefas).toHaveLength(3);
  });

  it("a hierarquia aponta cada filho para o pai certo", () => {
    const p = planoDoFluxo(fluxo, "2026-03-01");
    const sapatas = p.itens.find((i) => i.nome === "Sapatas")!;
    const fundacao = p.itens.find((i) => i.nome === "Fundação")!;
    expect(sapatas.paiChave).toBe(fundacao.chave);
    expect(fundacao.paiChave).toBe(p.itens.find((i) => i.nome === "Estrutura")!.chave);
  });

  it("fluxo sem serviço dá erro", () => {
    expect(planoDoFluxo([{ nome: "F", etapas: [{ nome: "E", servicos: [] }] }], "2026-03-01").erro).toMatch(
      /nenhum serviço/
    );
  });
});

describe("editor em linhas", () => {
  it("achatar e agrupar devolvem a mesma estrutura", () => {
    expect(agruparLinhas(achatarEstrutura(fluxo))).toEqual(fluxo);
  });
  it("ignora linha incompleta e corrige duração inválida", () => {
    const e = agruparLinhas([
      {
        fase: "F",
        etapa: "E",
        servico: "S",
        duracao_dias: 0,
        fornecedor_id: null,
        paralelo: false,
        tarefas: "a; b\nc",
      },
      { fase: "F", etapa: "", servico: "X", duracao_dias: 3, fornecedor_id: null, paralelo: false, tarefas: "" },
    ]);
    expect(e[0].etapas[0].servicos).toHaveLength(1);
    expect(e[0].etapas[0].servicos[0]).toMatchObject({ duracao_dias: 5, tarefas: ["a", "b", "c"] });
  });
});

describe("normalizarEstrutura", () => {
  it("tolera lixo do banco", () => {
    expect(normalizarEstrutura(null)).toEqual([]);
    expect(
      normalizarEstrutura([{ nome: "F", etapas: [{ nome: "E", servicos: [{ nome: "S", duracao_dias: "x" }] }] }])[0]
        .etapas[0].servicos[0]
    ).toMatchObject({
      duracao_dias: 5,
      paralelo: false,
      tarefas: [],
    });
  });
});

describe("estruturaDeObra", () => {
  const no = (
    id: string,
    parent_id: string | null,
    nivel: string,
    nome: string,
    ini: string | null = null,
    fim: string | null = null,
    extra = {}
  ) => ({
    id,
    parent_id,
    nivel,
    nome,
    ordem: 0,
    created_at: id,
    data_inicio: ini,
    data_fim: fim,
    ...extra,
  });
  it("tira duração das datas, detecta paralelo e leva o prestador e as tarefas", () => {
    const nos = [
      no("f", null, "fase", "Estrutura"),
      no("e", "f", "etapa", "Fundação"),
      no("s1", "e", "servico", "Sapatas", "2026-03-01", "2026-03-05", { fornecedor_id: "f1" }),
      no("s2", "e", "servico", "Elétrica", "2026-03-04", "2026-03-10"),
    ];
    const tarefas = [{ obra_frente_id: "s1", titulo: "Escavar", data_inicio: null, prazo: null, created_at: "1" }];
    const e = estruturaDeObra(nos, tarefas);
    expect(e[0].etapas[0].servicos[0]).toMatchObject({
      nome: "Sapatas",
      duracao_dias: 5,
      paralelo: false,
      fornecedor_id: "f1",
      tarefas: ["Escavar"],
    });
    expect(e[0].etapas[0].servicos[1]).toMatchObject({ nome: "Elétrica", duracao_dias: 7, paralelo: true });
  });
});
