import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AREAS,
  INDICADORES,
  atalhosDePeriodo,
  formatarValor,
  janelaDoPeriodo,
  montarMetaView,
  percentual,
  rotuloDaMeta,
  rotuloJanela,
  statusDaMeta,
  sugerirNomeMeta,
  type MetaRow,
} from "./metas";

const MIGRATION = readFileSync(
  resolve(__dirname, "../../supabase/migrations/20261103000000_metas_personalizaveis.sql"),
  "utf8"
);

/** Valores entre aspas do CHECK `nome` da migration. */
function valoresDoCheck(nome: string): string[] {
  const bloco = MIGRATION.split(`ADD CONSTRAINT ${nome}`)[1]?.split(");")[0] ?? "";
  return [...bloco.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
}

const meta = (over: Partial<MetaRow> = {}): MetaRow => ({
  id: "m1",
  nome: "Meta",
  alvo: 5,
  atual: 0,
  prazo: null,
  categoria: null,
  pessoa_id: null,
  descricao: null,
  unidade: "quantity",
  unidade_rotulo: null,
  indicador: null,
  periodo_inicio: null,
  recorrencia: "nenhuma",
  created_at: "2026-10-01T00:00:00Z",
  ...over,
});

describe("catálogo x banco", () => {
  it("indicadores do front são os do CHECK metas_indicador_check", () => {
    expect(INDICADORES.map((i) => i.key).sort()).toEqual(valoresDoCheck("metas_indicador_check").sort());
  });

  it("áreas do front são as do CHECK metas_categoria_check", () => {
    expect(AREAS.map((a) => a.value).sort()).toEqual(valoresDoCheck("metas_categoria_check").sort());
  });

  it("indicadores por pessoa são os do CHECK metas_indicador_aceita_pessoa", () => {
    expect(
      INDICADORES.filter((i) => i.aceitaPessoa)
        .map((i) => i.key)
        .sort()
    ).toEqual(valoresDoCheck("metas_indicador_aceita_pessoa").sort());
  });
});

describe("percentual", () => {
  it("limita entre 0 e 100", () => {
    expect(percentual(3, 5)).toBe(60);
    expect(percentual(12, 5)).toBe(100);
    expect(percentual(-2, 5)).toBe(0);
  });

  it("alvo 0, valor ausente ou inválido não gera NaN nem Infinity", () => {
    expect(percentual(3, 0)).toBe(0);
    expect(percentual(null, 5)).toBe(0);
    expect(percentual(undefined, 5)).toBe(0);
    expect(percentual(Number.NaN, 5)).toBe(0);
  });
});

describe("janelaDoPeriodo", () => {
  it("mensal: fevereiro de ano não bissexto e bissexto", () => {
    expect(janelaDoPeriodo("mensal", new Date(2026, 1, 10))).toEqual({ inicio: "2026-02-01", fim: "2026-02-28" });
    expect(janelaDoPeriodo("mensal", new Date(2028, 1, 10))).toEqual({ inicio: "2028-02-01", fim: "2028-02-29" });
  });

  it("trimestral: cai no trimestre certo e vira o ano", () => {
    expect(janelaDoPeriodo("trimestral", new Date(2026, 0, 1))).toEqual({ inicio: "2026-01-01", fim: "2026-03-31" });
    expect(janelaDoPeriodo("trimestral", new Date(2026, 5, 30))).toEqual({ inicio: "2026-04-01", fim: "2026-06-30" });
    expect(janelaDoPeriodo("trimestral", new Date(2026, 11, 31))).toEqual({ inicio: "2026-10-01", fim: "2026-12-31" });
  });

  it("anual: virada de ano", () => {
    expect(janelaDoPeriodo("anual", new Date(2026, 11, 31))).toEqual({ inicio: "2026-01-01", fim: "2026-12-31" });
    expect(janelaDoPeriodo("anual", new Date(2027, 0, 1))).toEqual({ inicio: "2027-01-01", fim: "2027-12-31" });
  });
});

describe("atalhosDePeriodo", () => {
  it("'Ano que vem' é o ano seguinte inteiro", () => {
    const ano = atalhosDePeriodo(new Date(2026, 9, 15)).find((a) => a.label === "Ano que vem");
    expect(ano).toEqual({ label: "Ano que vem", inicio: "2027-01-01", fim: "2027-12-31" });
  });
});

describe("rotuloJanela", () => {
  it("rotula cada recorrência", () => {
    expect(rotuloJanela("mensal", "2026-10-01", "2026-10-31")).toBe("out/2026");
    expect(rotuloJanela("trimestral", "2026-10-01", "2026-12-31")).toBe("4º tri/2026");
    expect(rotuloJanela("anual", "2027-01-01", "2027-12-31")).toBe("2027");
  });

  it("datas específicas e meta sem prazo", () => {
    expect(rotuloJanela("nenhuma", "2027-01-01", "2027-06-30")).toBe("01/01/2027 a 30/06/2027");
    expect(rotuloJanela("nenhuma", null, "2027-06-30")).toBe("até 30/06/2027");
    expect(rotuloJanela("nenhuma", null, null)).toBe("sem prazo");
  });
});

describe("formatarValor", () => {
  it("moeda, percentual e quantidade com rótulo", () => {
    expect(formatarValor(500000, "currency")).toMatch(/R\$\s?500\.000/);
    expect(formatarValor(35, "percentage")).toBe("35%");
    expect(formatarValor(5, "quantity", "relatórios")).toBe("5 relatórios");
    expect(formatarValor(1, "quantity", { um: "projeto", muitos: "projetos" })).toBe("1 projeto");
    expect(formatarValor(0, "quantity", { um: "projeto", muitos: "projetos" })).toBe("0 projetos");
    expect(formatarValor(5, "quantity")).toBe("5");
  });
});

describe("rotuloDaMeta", () => {
  it("usa o rótulo digitado, senão o do indicador", () => {
    expect(rotuloDaMeta({ indicador: null, unidade_rotulo: "relatórios" })).toBe("relatórios");
    expect(rotuloDaMeta({ indicador: "projetos_concluidos", unidade_rotulo: null })).toEqual({
      um: "projeto",
      muitos: "projetos",
    });
    expect(rotuloDaMeta({ indicador: "receita_recebida", unidade_rotulo: null })).toBeNull();
  });
});

describe("sugerirNomeMeta", () => {
  it("os três exemplos do pedido", () => {
    expect(
      sugerirNomeMeta({
        indicador: "projetos_concluidos",
        alvo: 5,
        recorrencia: "mensal",
        pessoaNome: "Rafael Silva",
      })
    ).toBe("Rafael: 5 projetos concluídos por mês");

    expect(
      sugerirNomeMeta({
        indicador: "receita_recebida",
        alvo: 500000,
        recorrencia: "nenhuma",
        inicio: "2027-01-01",
        fim: "2027-12-31",
      })
    ).toMatch(/^Faturamento recebido de R\$\s?500\.000 em 2027$/);

    expect(
      sugerirNomeMeta({
        indicador: "projetos_concluidos",
        alvo: 30,
        recorrencia: "nenhuma",
        inicio: "2027-01-01",
        fim: "2027-12-31",
      })
    ).toBe("30 projetos concluídos em 2027");
  });

  it("sem indicador, sem alvo ou indicador pontual", () => {
    expect(sugerirNomeMeta({ indicador: null, alvo: 5, recorrencia: "nenhuma" })).toBe("");
    expect(sugerirNomeMeta({ indicador: "leads_ganhos", alvo: 0, recorrencia: "mensal" })).toBe("");
    expect(sugerirNomeMeta({ indicador: "projetos_ativos", alvo: 8, recorrencia: "nenhuma", fim: "2027-01-01" })).toBe(
      "8 projetos ativos"
    );
  });

  it("prazo sem início vira 'até'", () => {
    expect(sugerirNomeMeta({ indicador: "leads_ganhos", alvo: 10, recorrencia: "nenhuma", fim: "2027-03-31" })).toBe(
      "10 leads ganhos até 31/03/2027"
    );
  });
});

describe("statusDaMeta", () => {
  const hoje = new Date(2026, 9, 15);

  it("concluída quando bate o alvo", () => {
    expect(statusDaMeta(meta({ alvo: 5 }), 5, hoje)).toBe("concluida");
  });

  it("atrasada só em datas específicas com prazo vencido", () => {
    expect(statusDaMeta(meta({ prazo: "2026-10-14" }), 2, hoje)).toBe("atrasada");
    expect(statusDaMeta(meta({ prazo: "2026-10-15" }), 2, hoje)).toBe("em_andamento");
    expect(statusDaMeta(meta({ prazo: "2026-10-14", recorrencia: "mensal" }), 2, hoje)).toBe("em_andamento");
  });

  it("meta com alvo 0 nunca conclui sozinha", () => {
    expect(statusDaMeta(meta({ alvo: 0 }), 0, hoje)).toBe("em_andamento");
  });
});

describe("montarMetaView", () => {
  const hoje = new Date(2026, 9, 15);

  it("usa o atual calculado no banco", () => {
    const v = montarMetaView(
      meta({ atual: 0, indicador: "projetos_concluidos", recorrencia: "mensal" }),
      { meta_id: "m1", atual: 3, janela_inicio: "2026-10-01", janela_fim: "2026-10-31", restrito: false },
      hoje
    );
    expect(v.atual).toBe(3);
    expect(v.percent).toBe(60);
    expect(v.janelaInicio).toBe("2026-10-01");
  });

  it("restrito: sem valor e sem percentual", () => {
    const v = montarMetaView(
      meta({ indicador: "receita_recebida", unidade: "currency" }),
      { meta_id: "m1", atual: null, janela_inicio: null, janela_fim: null, restrito: true },
      hoje
    );
    expect(v.restrito).toBe(true);
    expect(v.atual).toBeNull();
    expect(v.percent).toBe(0);
  });

  it("sem linha de progresso cai no atual gravado", () => {
    expect(montarMetaView(meta({ atual: 2 }), undefined, hoje).atual).toBe(2);
  });
});
