import { describe, expect, it } from "vitest";
import {
  achatarArvore,
  caminhoDoNo,
  montarArvoreCronograma,
  unirPeriodos,
  type NoInput,
  type TarefaInput,
} from "./obraArvore";

const HOJE = new Date(2026, 10, 8); // 08/11/2026

let seq = 0;
function no(id: string, nivel: string, parent_id: string | null, campos: Partial<NoInput> = {}): NoInput {
  seq += 1;
  return {
    id,
    nivel,
    parent_id,
    nome: id,
    ordem: 0,
    data_inicio: null,
    data_fim: null,
    created_at: `2026-10-01T00:00:${String(seq).padStart(2, "0")}Z`,
    ...campos,
  };
}

function tarefa(id: string, servico: string | null, campos: Partial<TarefaInput> = {}): TarefaInput {
  seq += 1;
  return {
    id,
    obra_frente_id: servico,
    status: "a_fazer",
    data_inicio: null,
    prazo: null,
    created_at: `2026-10-02T00:00:${String(seq).padStart(2, "0")}Z`,
    ...campos,
  };
}

const NOS = [
  no("estrutura", "fase", null),
  no("fundacao", "etapa", "estrutura"),
  no("sapatas", "servico", "fundacao", { data_inicio: "2026-11-01", data_fim: "2026-11-10" }),
  no("vigas", "servico", "fundacao", { data_inicio: "2026-11-05", data_fim: "2026-11-20" }),
];

describe("montarArvoreCronograma", () => {
  it("monta fase > etapa > serviço > tarefa", () => {
    const { fases, soltas } = montarArvoreCronograma(NOS, [tarefa("t1", "sapatas")], HOJE);
    expect(fases).toHaveLength(1);
    const etapa = fases[0].filhos[0];
    expect(etapa.nivel).toBe("etapa");
    expect(etapa.filhos.map((s) => s.no.id)).toEqual(["sapatas", "vigas"]);
    expect(etapa.filhos[0].tarefas.map((t) => t.id)).toEqual(["t1"]);
    expect(soltas).toEqual([]);
  });

  it("avanço sobe: 1 de 4 tarefas concluídas vira 25% em serviço, etapa e fase", () => {
    const tarefas = [
      tarefa("t1", "sapatas", { status: "concluida" }),
      tarefa("t2", "sapatas"),
      tarefa("t3", "sapatas"),
      tarefa("t4", "sapatas"),
    ];
    const { fases } = montarArvoreCronograma(NOS, tarefas, HOJE);
    const fase = fases[0];
    const etapa = fase.filhos[0];
    const servico = etapa.filhos[0];
    expect([servico.progresso, etapa.progresso, fase.progresso]).toEqual([25, 25, 25]);
    expect(fase.concluidas).toBe(1);
    expect(fase.total).toBe(4);
  });

  it("etapa sem data própria: barra vai do primeiro início ao último fim dos serviços", () => {
    const { fases } = montarArvoreCronograma(NOS, [], HOJE);
    const etapa = fases[0].filhos[0];
    expect(etapa.periodoProprio).toBeNull();
    expect(etapa.periodo).toEqual({ inicio: "2026-11-01", fim: "2026-11-20" });
    expect(fases[0].periodo).toEqual({ inicio: "2026-11-01", fim: "2026-11-20" });
  });

  it("tarefa datada estica o período do serviço", () => {
    const { fases } = montarArvoreCronograma(
      NOS,
      [tarefa("t1", "sapatas", { data_inicio: "2026-10-28", prazo: "2026-11-02" })],
      HOJE
    );
    expect(fases[0].filhos[0].filhos[0].periodo).toEqual({ inicio: "2026-10-28", fim: "2026-11-10" });
  });

  it("estado usa o período-resumo: em andamento em 08/11", () => {
    const { fases } = montarArvoreCronograma(NOS, [tarefa("t1", "sapatas")], HOJE);
    expect(fases[0].estado).toBe("em_andamento");
  });

  it("tarefa sem serviço ou com serviço que sumiu fica em soltas", () => {
    const { soltas } = montarArvoreCronograma(NOS, [tarefa("t1", null), tarefa("t2", "nao-existe")], HOJE);
    expect(soltas.map((t) => t.id)).toEqual(["t1", "t2"]);
  });

  it("ordena por ordem e depois por criação", () => {
    const nos = [
      no("b", "fase", null, { ordem: 1 }),
      no("a", "fase", null, { ordem: 0 }),
      no("c", "fase", null, { ordem: 1 }),
    ];
    expect(montarArvoreCronograma(nos, [], HOJE).fases.map((f) => f.no.id)).toEqual(["a", "b", "c"]);
  });

  it("nó cujo pai não veio vira raiz em vez de sumir", () => {
    const { fases } = montarArvoreCronograma([no("orfa", "etapa", "x")], [], HOJE);
    expect(fases.map((f) => f.no.id)).toEqual(["orfa"]);
  });
});

describe("achatarArvore", () => {
  const { fases } = montarArvoreCronograma(NOS, [tarefa("t1", "sapatas")], HOJE);

  it("lista tudo aberto em ordem, com profundidade", () => {
    const linhas = achatarArvore(fases, new Set());
    expect(linhas.map((l) => `${l.profundidade}:${l.chave}`)).toEqual([
      "0:no:estrutura",
      "1:no:fundacao",
      "2:no:sapatas",
      "3:tarefa:t1",
      "2:no:vigas",
    ]);
  });

  it("nó recolhido esconde tudo abaixo dele", () => {
    const linhas = achatarArvore(fases, new Set(["fundacao"]));
    expect(linhas.map((l) => l.chave)).toEqual(["no:estrutura", "no:fundacao"]);
  });
});

describe("caminhoDoNo / unirPeriodos", () => {
  it("monta Fase › Etapa › Serviço", () => {
    expect(caminhoDoNo(NOS, "sapatas")).toBe("estrutura › fundacao › sapatas");
  });

  it("ignora período vazio", () => {
    expect(unirPeriodos([null, { inicio: "2026-01-05", fim: "2026-01-06" }])).toEqual({
      inicio: "2026-01-05",
      fim: "2026-01-06",
    });
    expect(unirPeriodos([null])).toBeNull();
  });
});
