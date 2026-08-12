import { describe, expect, it } from "vitest";
import {
  calcularAvanco,
  calcularSaldoConta,
  climaLabel,
  condicaoLabel,
  desvioOrcamento,
  estadoFrenteCronograma,
  estadoTarefaCronograma,
  spanFrente,
  pagoPorLabel,
  menorValorProposta,
  nomeFornecedorProposta,
  custoMedioEntradas,
  saldoMaterial,
  realizadoPorEtapa,
  SEM_ETAPA,
  STATUS_OBRA_OPCOES,
  totalAdiantadoEscritorio,
} from "./obras";
import { statusLabel } from "./status";

describe("calcularAvanco", () => {
  it("é 0 quando não há tarefas", () => {
    expect(calcularAvanco([])).toBe(0);
  });

  it("é 25% com 1 de 4 concluídas (critério de aceite spec 015)", () => {
    const tarefas = [{ status: "concluida" }, { status: "a_fazer" }, { status: "fazendo" }, { status: "a_fazer" }];
    expect(calcularAvanco(tarefas)).toBe(25);
  });

  it("é 100% quando todas concluídas", () => {
    expect(calcularAvanco([{ status: "concluida" }, { status: "concluida" }])).toBe(100);
  });

  it("arredonda para inteiro", () => {
    // 1 de 3 = 33.33 -> 33
    expect(calcularAvanco([{ status: "concluida" }, { status: "a_fazer" }, { status: "a_fazer" }])).toBe(33);
  });
});

describe("estado da frente no cronograma (spec 020)", () => {
  const hoje = new Date("2026-08-11T12:00:00");
  const abertas = [{ status: "a_fazer" }, { status: "concluida" }];
  const todasFeitas = [{ status: "concluida" }, { status: "concluida" }];

  it("sem início ou fim → sem_prazo (fora da timeline)", () => {
    expect(estadoFrenteCronograma({ data_inicio: null, data_fim: null }, abertas, hoje)).toBe("sem_prazo");
    expect(estadoFrenteCronograma({ data_inicio: "2026-08-01", data_fim: null }, abertas, hoje)).toBe("sem_prazo");
  });

  it("todas as pendências fechadas → concluida, mesmo antes do fim", () => {
    expect(estadoFrenteCronograma({ data_inicio: "2026-08-01", data_fim: "2026-08-31" }, todasFeitas, hoje)).toBe(
      "concluida"
    );
  });

  it("hoje depois do fim com pendência aberta → atrasada", () => {
    expect(estadoFrenteCronograma({ data_inicio: "2026-07-01", data_fim: "2026-08-05" }, abertas, hoje)).toBe(
      "atrasada"
    );
  });

  it("hoje entre início e fim → em_andamento", () => {
    expect(estadoFrenteCronograma({ data_inicio: "2026-08-01", data_fim: "2026-08-31" }, abertas, hoje)).toBe(
      "em_andamento"
    );
  });

  it("início ainda não chegou → futura", () => {
    expect(estadoFrenteCronograma({ data_inicio: "2026-09-01", data_fim: "2026-09-30" }, abertas, hoje)).toBe("futura");
  });
});

describe("estado do passo no cronograma (spec 027)", () => {
  const hoje = new Date("2026-08-11T12:00:00");

  it("concluído → verde, independente da data", () => {
    expect(estadoTarefaCronograma({ status: "concluida", data_inicio: "2026-09-01", prazo: "2026-09-30" }, hoje)).toBe(
      "concluida"
    );
  });

  it("sem início ou sem prazo → sem_periodo (não vira barra)", () => {
    expect(estadoTarefaCronograma({ status: "a_fazer", data_inicio: null, prazo: "2026-08-31" }, hoje)).toBe(
      "sem_periodo"
    );
    expect(estadoTarefaCronograma({ status: "a_fazer", data_inicio: "2026-08-01", prazo: null }, hoje)).toBe(
      "sem_periodo"
    );
  });

  it("hoje passou do prazo e não concluído → atrasada", () => {
    expect(estadoTarefaCronograma({ status: "fazendo", data_inicio: "2026-07-01", prazo: "2026-08-05" }, hoje)).toBe(
      "atrasada"
    );
  });

  it("hoje entre início e prazo → em_andamento", () => {
    expect(estadoTarefaCronograma({ status: "a_fazer", data_inicio: "2026-08-01", prazo: "2026-08-31" }, hoje)).toBe(
      "em_andamento"
    );
  });

  it("início ainda não chegou → futura", () => {
    expect(estadoTarefaCronograma({ status: "a_fazer", data_inicio: "2026-09-01", prazo: "2026-09-30" }, hoje)).toBe(
      "futura"
    );
  });
});

describe("span da frente = frente ∪ passos (spec 027)", () => {
  it("null quando não há nenhuma data (nem frente nem passos)", () => {
    expect(spanFrente({ data_inicio: null, data_fim: null }, [])).toBeNull();
    expect(spanFrente({ data_inicio: null, data_fim: null }, [{ data_inicio: "2026-08-01", prazo: null }])).toBeNull();
  });

  it("usa só as datas próprias da frente quando não há passos datados", () => {
    expect(spanFrente({ data_inicio: "2026-08-01", data_fim: "2026-08-31" }, [])).toEqual({
      inicio: "2026-08-01",
      fim: "2026-08-31",
    });
  });

  it("deriva do span dos passos quando a frente não tem datas próprias", () => {
    const passos = [
      { data_inicio: "2026-08-04", prazo: "2026-08-08" },
      { data_inicio: "2026-08-01", prazo: "2026-08-03" },
      { data_inicio: "2026-08-09", prazo: "2026-08-14" },
    ];
    expect(spanFrente({ data_inicio: null, data_fim: null }, passos)).toEqual({
      inicio: "2026-08-01",
      fim: "2026-08-14",
    });
  });

  it("une o período da frente com o dos passos (o mais amplo dos dois)", () => {
    const passos = [{ data_inicio: "2026-07-20", prazo: "2026-09-10" }];
    expect(spanFrente({ data_inicio: "2026-08-01", data_fim: "2026-08-31" }, passos)).toEqual({
      inicio: "2026-07-20",
      fim: "2026-09-10",
    });
  });

  it("ignora passos com só uma das datas ao derivar o span", () => {
    const passos = [
      { data_inicio: "2026-08-05", prazo: "2026-08-10" },
      { data_inicio: "2026-08-01", prazo: null },
      { data_inicio: null, prazo: "2026-08-20" },
    ];
    expect(spanFrente({ data_inicio: null, data_fim: null }, passos)).toEqual({
      inicio: "2026-08-05",
      fim: "2026-08-10",
    });
  });
});

describe("labels de RDO", () => {
  it("traduz clima e condição conhecidos", () => {
    expect(climaLabel("chuva_forte")).toBe("Chuva forte");
    expect(condicaoLabel("paralisada")).toBe("Obra paralisada");
  });

  it("devolve vazio para nulo", () => {
    expect(climaLabel(null)).toBe("");
    expect(condicaoLabel(undefined)).toBe("");
  });
});

describe("status de obra no registry", () => {
  it("todo status de opção resolve label no domínio obra", () => {
    for (const opt of STATUS_OBRA_OPCOES) {
      expect(statusLabel("obra", opt.value)).toBe(opt.label);
    }
  });
});

describe("conta da obra — saldo (spec 016)", () => {
  it("aportes menos despesas (50k − 30k = 20k)", () => {
    const lancamentos = [
      { tipo: "aporte", valor: 50000 },
      { tipo: "despesa", valor: 20000 },
      { tipo: "despesa", valor: 10000 },
    ];
    expect(calcularSaldoConta(lancamentos)).toBe(20000);
  });

  it("permite saldo negativo: despesa sem aporte (−5.000)", () => {
    expect(calcularSaldoConta([{ tipo: "despesa", valor: 5000 }])).toBe(-5000);
  });

  it("conta vazia é 0", () => {
    expect(calcularSaldoConta([])).toBe(0);
  });

  it("aceita valor numeric vindo como string do banco", () => {
    expect(calcularSaldoConta([{ tipo: "aporte", valor: "1500.50" }])).toBe(1500.5);
  });
});

describe("conta da obra — realizado por etapa e desvio", () => {
  it("soma despesas por frente e ignora aportes", () => {
    const r = realizadoPorEtapa([
      { tipo: "aporte", valor: 9999, obra_frente_id: "f1" },
      { tipo: "despesa", valor: 30000, obra_frente_id: "f1" },
      { tipo: "despesa", valor: 15000, obra_frente_id: "f1" },
      { tipo: "despesa", valor: 8000, obra_frente_id: "f2" },
      { tipo: "despesa", valor: 500, obra_frente_id: null },
    ]);
    expect(r).toEqual({ f1: 45000, f2: 8000, [SEM_ETAPA]: 500 });
  });

  it("estouro previsto 40k vs realizado 45k = +5.000 (+12,5%) [critério de aceite]", () => {
    expect(desvioOrcamento(40000, 45000)).toEqual({ valor: 5000, pct: 12.5 });
  });

  it("previsto zero não gera pct (sem base)", () => {
    expect(desvioOrcamento(0, 1000)).toEqual({ valor: 1000, pct: null });
  });
});

describe("conta da obra — adiantamento do escritório (ADR 0013)", () => {
  it("soma só despesas reembolsáveis", () => {
    const lancamentos = [
      { tipo: "despesa", valor: 1000, pago_por: "cliente" },
      { tipo: "despesa", valor: 700, pago_por: "escritorio_reembolsavel" },
      { tipo: "despesa", valor: 300, pago_por: "escritorio_reembolsavel" },
      { tipo: "aporte", valor: 5000, pago_por: null },
    ];
    expect(totalAdiantadoEscritorio(lancamentos)).toBe(1000);
  });
});

describe("labels da conta da obra", () => {
  it("traduz pago_por conhecido e vazio para nulo", () => {
    expect(pagoPorLabel("escritorio_reembolsavel")).toBe("Escritório adiantou (reembolsável)");
    expect(pagoPorLabel(null)).toBe("");
  });
});

describe("cotações (spec 018)", () => {
  it("menor valor entre propostas, aceitando string do banco", () => {
    expect(menorValorProposta([{ valor: 1200 }, { valor: "900" }, { valor: 1500 }])).toBe(900);
  });

  it("sem propostas → null (nada a comparar)", () => {
    expect(menorValorProposta([])).toBeNull();
  });

  it("nome do fornecedor: cadastro tem prioridade sobre nome livre", () => {
    expect(nomeFornecedorProposta({ fornecedor: { nome: "Aço Forte" }, fornecedor_nome: "ignorado" })).toBe(
      "Aço Forte"
    );
    expect(nomeFornecedorProposta({ fornecedor: null, fornecedor_nome: "Depósito São João" })).toBe(
      "Depósito São João"
    );
    expect(nomeFornecedorProposta({ fornecedor: null, fornecedor_nome: null })).toBe("Fornecedor sem nome");
  });
});

describe("estoque da obra (spec 019)", () => {
  it("comprei 100, aplicado 0 → saldo 100", () => {
    const { comprado, aplicado, saldo } = saldoMaterial([{ tipo: "entrada", quantidade: 100 }]);
    expect({ comprado, aplicado, saldo }).toEqual({ comprado: 100, aplicado: 0, saldo: 100 });
  });

  it("entrada 100, baixa 60 → saldo 40", () => {
    const movs = [
      { tipo: "entrada", quantidade: 100 },
      { tipo: "baixa", quantidade: 60 },
    ];
    expect(saldoMaterial(movs).saldo).toBe(40);
  });

  it("sem baixa, saldo = comprado (feature não depende da baixa)", () => {
    const movs = [
      { tipo: "entrada", quantidade: 30 },
      { tipo: "entrada", quantidade: 20 },
    ];
    const { comprado, saldo } = saldoMaterial(movs);
    expect(saldo).toBe(comprado);
    expect(saldo).toBe(50);
  });

  it("saldo pode ficar negativo (baixa maior que entrada, não bloqueia)", () => {
    const movs = [
      { tipo: "entrada", quantidade: 100 },
      { tipo: "baixa", quantidade: 120 },
    ];
    expect(saldoMaterial(movs).saldo).toBe(-20);
  });

  it("custo médio ponderado só das entradas valoradas, aceitando string do banco", () => {
    const movs = [
      { tipo: "entrada", quantidade: 100, valor_unitario: "30" },
      { tipo: "entrada", quantidade: 100, valor_unitario: 40 },
      { tipo: "baixa", quantidade: 50, valor_unitario: null },
    ];
    expect(custoMedioEntradas(movs)).toBe(35);
  });

  it("valor parado = saldo × custo médio", () => {
    const movs = [
      { tipo: "entrada", quantidade: 100, valor_unitario: 35 },
      { tipo: "baixa", quantidade: 60 },
    ];
    expect(saldoMaterial(movs).valorParado).toBe(40 * 35);
  });

  it("sem entrada valorada → custo médio e valor parado nulos", () => {
    const movs = [{ tipo: "entrada", quantidade: 100 }];
    expect(custoMedioEntradas(movs)).toBeNull();
    expect(saldoMaterial(movs).valorParado).toBeNull();
  });
});
