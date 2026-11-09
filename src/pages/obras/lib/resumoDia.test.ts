import { describe, expect, it } from "vitest";
import { rascunhoDoRdo, resumirDia } from "./resumoDia";

const reg = (id: string, extra: Partial<Parameters<typeof resumirDia>[0][number]> = {}) => ({
  id,
  status: "pronto",
  rdo_id: null,
  texto_organizado: null,
  extraido: {},
  ...extra,
});

describe("resumirDia", () => {
  it("soma o que cada registro pronto trouxe, sem repetir", () => {
    const r = resumirDia([
      reg("a", {
        extraido: {
          servicos: [{ descricao: "Reboco do térreo", resultado: "avancou" }],
          problemas: ["Chuva parou a laje"],
          pendencias: ["Confirmar prumada"],
          materiais_faltando: ["Cimento"],
        },
      }),
      reg("b", {
        extraido: {
          servicos: [
            { descricao: "reboco do térreo", resultado: "avancou" },
            { descricao: "Contrapiso", resultado: "concluiu" },
          ],
          materiais_faltando: ["cimento"],
        },
      }),
    ]);
    expect(r.avancos).toEqual(["Reboco do térreo (avançou)", "Contrapiso (concluiu)"]);
    expect(r.materiaisFaltando).toEqual(["Cimento"]);
    expect(r.ocorrencias).toEqual(["Chuva parou a laje"]);
    expect(r.pendencias).toEqual(["Confirmar prumada"]);
    expect(r.prontos).toBe(2);
  });

  it("conta a mesma equipe uma vez, pelo maior número citado", () => {
    const r = resumirDia([
      reg("a", { extraido: { equipes: [{ nome: "Pedreiros", quantidade: 4 }] } }),
      reg("b", {
        extraido: {
          equipes: [
            { nome: "pedreiros", quantidade: 6 },
            { nome: "Eletricistas", quantidade: 2 },
          ],
        },
      }),
    ]);
    expect(r.equipes).toEqual([
      { nome: "pedreiros", quantidade: 6 },
      { nome: "Eletricistas", quantidade: 2 },
    ]);
    expect(r.efetivoTotal).toBe(8);
  });

  it("sem equipe citada usa o maior total, sem somar totais de registros diferentes", () => {
    const r = resumirDia([
      reg("a", { extraido: { efetivo_total: 10 } }),
      reg("b", { extraido: { efetivo_total: 12 } }),
    ]);
    expect(r.efetivoTotal).toBe(12);
    expect(r.equipes).toEqual([]);
  });

  it("sem nenhum dado de efetivo o total é nulo", () => {
    expect(resumirDia([reg("a")]).efetivoTotal).toBeNull();
  });

  it("registro sem serviço extraído entra pelo texto organizado", () => {
    const r = resumirDia([reg("a", { texto_organizado: "Concretagem da laje concluída." })]);
    expect(r.avancos).toEqual(["Concretagem da laje concluída."]);
  });

  it("só registro pronto entra; os em organização são contados à parte", () => {
    const r = resumirDia([
      reg("a", { extraido: { problemas: ["Vazamento"] } }),
      reg("b", { status: "organizando", extraido: { problemas: ["Não conta"] } }),
      reg("c", { status: "falhou", extraido: { problemas: ["Não conta"] } }),
      reg("d", { status: "enviado" }),
    ]);
    expect(r.ocorrencias).toEqual(["Vazamento"]);
    expect(r.prontos).toBe(1);
    expect(r.pendentes).toBe(2);
  });

  it("conta os registros que já apontam para um RDO", () => {
    expect(resumirDia([reg("a", { rdo_id: "rdo1" }), reg("b")]).fechados).toBe(1);
  });
});

describe("rascunhoDoRdo", () => {
  it("monta os campos do formulário a partir do resumo", () => {
    const rascunho = rascunhoDoRdo("2026-10-19", [
      reg("a", {
        extraido: {
          equipes: [{ nome: "Pedreiros", quantidade: 4 }],
          servicos: [{ descricao: "Reboco", resultado: "avancou" }],
          problemas: ["Chuva"],
          pendencias: ["Prumada"],
          materiais_faltando: ["Cimento"],
        },
      }),
    ]);
    expect(rascunho.data).toBe("2026-10-19");
    expect(rascunho.registroIds).toEqual(["a"]);
    expect(rascunho.campos).toEqual({
      atividades: "- Reboco (avançou)",
      ocorrencias: "- Chuva\n- Faltou: Cimento",
      pendencias: "- Prumada",
      efetivo: "4",
    });
    expect(rascunho.efetivoLinhas).toEqual([{ fornecedor_id: null, fornecedor_nome: "Pedreiros", quantidade: 4 }]);
    expect(rascunho.impedimentoLinhas).toEqual([{ descricao: "Cimento", tipo: "falta_material" }]);
  });

  it("sem registro pronto só liga os registros ao RDO, sem preencher nada", () => {
    const rascunho = rascunhoDoRdo("2026-10-19", [reg("a", { status: "falhou" }), reg("b", { status: "enviado" })]);
    expect(rascunho.campos).toBeUndefined();
    expect(rascunho.registroIds).toEqual(["a", "b"]);
    expect(rascunho.efetivoLinhas).toEqual([]);
  });
});
