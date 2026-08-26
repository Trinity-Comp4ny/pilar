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
  somaEfetivo,
  tipoImpedimentoLabel,
  TIPO_IMPEDIMENTO_OPCOES,
  curvaSObra,
  ordenarCotacoesPendentes,
  urgenciaLabel,
  desembolsoAcumuladoPorMes,
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

describe("somaEfetivo (spec 062)", () => {
  it("null quando não há nenhuma linha (mantém o campo manual)", () => {
    expect(somaEfetivo([])).toBeNull();
  });

  it("soma a quantidade de todas as linhas", () => {
    expect(somaEfetivo([{ quantidade: 5 }, { quantidade: 3 }])).toBe(8);
  });
});

describe("tipoImpedimentoLabel (spec 062)", () => {
  it("traduz todos os tipos do registry", () => {
    for (const opt of TIPO_IMPEDIMENTO_OPCOES) {
      expect(tipoImpedimentoLabel(opt.value)).toBe(opt.label);
    }
  });

  it("devolve vazio para nulo", () => {
    expect(tipoImpedimentoLabel(null)).toBe("");
    expect(tipoImpedimentoLabel(undefined)).toBe("");
  });
});

describe("curvaSObra (spec 063)", () => {
  const tarefa = (over: Partial<Parameters<typeof curvaSObra>[0][number]> = {}) => ({
    id: "t1",
    status: "a_fazer",
    data_inicio: null,
    prazo: null,
    updated_at: "2026-06-01T12:00:00.000Z",
    ...over,
  });

  it("[] quando nenhuma tarefa tem prazo (empty state)", () => {
    expect(curvaSObra([tarefa({ id: "a" }), tarefa({ id: "b" })], new Map())).toEqual([]);
  });

  it("[] quando não há tarefas", () => {
    expect(curvaSObra([], new Map())).toEqual([]);
  });

  it("realizado = 50% a partir da semana em que a 2ª de 4 tarefas concluiu", () => {
    const tarefas = [
      tarefa({ id: "a", prazo: "2026-06-05", status: "concluida", updated_at: "2026-06-01T00:00:00.000Z" }),
      tarefa({ id: "b", prazo: "2026-06-12", status: "concluida", updated_at: "2026-06-08T00:00:00.000Z" }),
      tarefa({ id: "c", prazo: "2026-06-19" }),
      tarefa({ id: "d", prazo: "2026-06-26" }),
    ];
    const pontos = curvaSObra(tarefas, new Map());
    // segunda-feira da semana que contém 08/06/2026 (uma segunda-feira)
    const pontoAposSegunda = pontos.find((p) => p.semana === "2026-06-08");
    expect(pontoAposSegunda?.realizadoPct).toBe(50);
  });

  it("tarefa concluída pelo diário conta a partir da semana do RDO, não antes", () => {
    const tarefas = [
      tarefa({ id: "a", prazo: "2026-06-30", status: "concluida", updated_at: "2026-08-01T00:00:00.000Z" }),
    ];
    // concluída de fato em 10/08 pelo diário, mesmo com updated_at posterior
    const concluidasPorRdo = new Map([["a", "2026-08-10"]]);
    const pontos = curvaSObra(tarefas, concluidasPorRdo);
    const antes = pontos.find((p) => p.semana === "2026-08-03"); // semana antes do RDO
    const depois = pontos.find((p) => p.semana === "2026-08-10"); // semana do RDO
    expect(antes?.realizadoPct).toBe(0);
    expect(depois?.realizadoPct).toBe(100);
  });

  it("tarefa concluída fora do diário usa updated_at como aproximação", () => {
    const tarefas = [
      tarefa({ id: "a", prazo: "2026-06-30", status: "concluida", updated_at: "2026-07-15T00:00:00.000Z" }),
    ];
    const pontos = curvaSObra(tarefas, new Map());
    const antes = pontos.find((p) => p.semana === "2026-07-06");
    const depois = pontos.find((p) => p.semana === "2026-07-13");
    expect(antes?.realizadoPct).toBe(0);
    expect(depois?.realizadoPct).toBe(100);
  });

  it("o último ponto bate com calcularAvanco (mesmo denominador e regra)", () => {
    const tarefas = [
      tarefa({ id: "a", status: "concluida", prazo: "2026-06-05", updated_at: "2026-06-05T00:00:00.000Z" }),
      tarefa({ id: "b", status: "concluida", prazo: "2026-06-12", updated_at: "2026-06-12T00:00:00.000Z" }),
      tarefa({ id: "c", prazo: "2026-06-19" }),
    ];
    const pontos = curvaSObra(tarefas, new Map());
    const ultimo = pontos[pontos.length - 1];
    expect(ultimo.realizadoPct).toBe(calcularAvanco(tarefas));
  });

  it("planejado só conta tarefas com prazo definido", () => {
    const tarefas = [
      tarefa({ id: "a", prazo: "2026-06-05" }),
      tarefa({ id: "b", prazo: null }), // sem prazo, fora do denominador de planejado
    ];
    const pontos = curvaSObra(tarefas, new Map());
    const depois = pontos.find((p) => p.semana === "2026-06-08");
    expect(depois?.planejadoPct).toBe(100); // 1 de 1 com prazo, não 1 de 2
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

describe("ordenarCotacoesPendentes (spec 064)", () => {
  const c = (over: Partial<{ id: string; prazo_necessidade: string | null; created_at: string }> = {}) => ({
    id: "c1",
    prazo_necessidade: null,
    created_at: "2026-08-01T00:00:00.000Z",
    ...over,
  });

  it("prazo mais próximo (ou vencido) vem primeiro", () => {
    const cotacoes = [
      c({ id: "longe", prazo_necessidade: "2026-09-10" }),
      c({ id: "vencida", prazo_necessidade: "2026-08-01" }),
      c({ id: "perto", prazo_necessidade: "2026-08-28" }),
    ];
    expect(ordenarCotacoesPendentes(cotacoes).map((x) => x.id)).toEqual(["vencida", "perto", "longe"]);
  });

  it("sem prazo vai por último, ordenado por criação mais antiga primeiro", () => {
    const cotacoes = [
      c({ id: "sem-prazo-nova", prazo_necessidade: null, created_at: "2026-08-10T00:00:00.000Z" }),
      c({ id: "com-prazo", prazo_necessidade: "2026-09-01" }),
      c({ id: "sem-prazo-antiga", prazo_necessidade: null, created_at: "2026-08-01T00:00:00.000Z" }),
    ];
    expect(ordenarCotacoesPendentes(cotacoes).map((x) => x.id)).toEqual([
      "com-prazo",
      "sem-prazo-antiga",
      "sem-prazo-nova",
    ]);
  });

  it("não muta o array original", () => {
    const cotacoes = [c({ id: "a", prazo_necessidade: "2026-09-01" }), c({ id: "b", prazo_necessidade: "2026-08-20" })];
    const original = [...cotacoes];
    ordenarCotacoesPendentes(cotacoes);
    expect(cotacoes).toEqual(original);
  });
});

describe("urgenciaLabel (spec 064)", () => {
  const hoje = new Date("2026-08-26T12:00:00");

  it("sem prazo → 'sem prazo'", () => {
    expect(urgenciaLabel(null, hoje)).toBe("sem prazo");
  });

  it("prazo no passado → atrasada há N dias", () => {
    expect(urgenciaLabel("2026-08-21", hoje)).toBe("atrasada há 5 dias");
  });

  it("prazo é hoje → 'vence hoje'", () => {
    expect(urgenciaLabel("2026-08-26", hoje)).toBe("vence hoje");
  });

  it("prazo no futuro → vence em N dias", () => {
    expect(urgenciaLabel("2026-08-29", hoje)).toBe("vence em 3 dias");
  });

  it("singular quando é exatamente 1 dia", () => {
    expect(urgenciaLabel("2026-08-27", hoje)).toBe("vence em 1 dia");
    expect(urgenciaLabel("2026-08-25", hoje)).toBe("atrasada há 1 dia");
  });
});

describe("desembolsoAcumuladoPorMes (spec 066)", () => {
  it("[] quando não há despesas", () => {
    expect(desembolsoAcumuladoPorMes([])).toEqual([]);
    expect(desembolsoAcumuladoPorMes([{ tipo: "aporte", valor: 5000, data: "2026-06-10" }])).toEqual([]);
  });

  it("acumula mês a mês (critério de aceite): 10k em junho, +15k em julho = 25k", () => {
    const pontos = desembolsoAcumuladoPorMes([
      { tipo: "despesa", valor: 10000, data: "2026-06-05" },
      { tipo: "despesa", valor: 15000, data: "2026-07-20" },
    ]);
    expect(pontos.find((p) => p.mes === "2026-06")?.acumuladoRealizado).toBe(10000);
    expect(pontos.find((p) => p.mes === "2026-07")?.acumuladoRealizado).toBe(25000);
  });

  it("ignora aportes, só soma despesas", () => {
    const pontos = desembolsoAcumuladoPorMes([
      { tipo: "aporte", valor: 50000, data: "2026-06-01" },
      { tipo: "despesa", valor: 1000, data: "2026-06-15" },
    ]);
    expect(pontos.find((p) => p.mes === "2026-06")?.acumuladoRealizado).toBe(1000);
  });

  it("preenche mês sem despesa no meio, carregando o acumulado anterior", () => {
    const pontos = desembolsoAcumuladoPorMes([
      { tipo: "despesa", valor: 4000, data: "2026-06-10" },
      { tipo: "despesa", valor: 2000, data: "2026-08-10" },
    ]);
    expect(pontos.find((p) => p.mes === "2026-07")?.acumuladoRealizado).toBe(4000);
    expect(pontos.find((p) => p.mes === "2026-08")?.acumuladoRealizado).toBe(6000);
  });

  it("soma várias despesas do mesmo mês", () => {
    const pontos = desembolsoAcumuladoPorMes([
      { tipo: "despesa", valor: 1000, data: "2026-06-01" },
      { tipo: "despesa", valor: 500, data: "2026-06-20" },
    ]);
    expect(pontos.find((p) => p.mes === "2026-06")?.acumuladoRealizado).toBe(1500);
  });

  it("chega até o mês atual mesmo sem despesa recente (requisito 1)", () => {
    const mesAtual = new Date().toISOString().slice(0, 7);
    const pontos = desembolsoAcumuladoPorMes([{ tipo: "despesa", valor: 1000, data: "2026-01-10" }]);
    const ultimo = pontos[pontos.length - 1];
    expect(ultimo.mes >= mesAtual).toBe(true);
    expect(ultimo.acumuladoRealizado).toBe(1000);
  });
});
