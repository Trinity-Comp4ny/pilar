import { parametrosDaMigration } from "@/test/estimativaFixtures";
import { describe, expect, it } from "vitest";
import {
  avisosCoerencia,
  calcularEstimativa,
  descreverAdicional,
  distribuir,
  fichaInicial,
  lerAjustes,
  lerCub,
  lerParametros,
  lerPremissas,
  padroesDisponiveis,
  rotuloMesBase,
  rotuloPadrao,
  type EntradaCalculo,
} from "./estimativaObra";
import {
  ADICIONAIS_IDS,
  fichaSchema,
  parametrosSchema,
  resultadoSchema,
  type CubLinha,
  type Ficha,
  type ResultadoEstimativa,
} from "@/schemas/estimativaObra";

const parametros = parametrosDaMigration();

const cub = (
  uf: CubLinha["uf"],
  subtipo: string,
  padrao: CubLinha["padrao"],
  valor: number,
  mes = "2026-09-01",
  regime: CubLinha["regime"] = "onerado"
): CubLinha => ({
  uf,
  subtipo,
  padrao,
  mes_base: mes,
  valor_m2: valor,
  regime,
});

const CUB: CubLinha[] = [
  cub("SP", "R1", "baixo", 2150),
  cub("SP", "R1", "normal", 2700),
  cub("SP", "R1", "alto", 3350),
  cub("SP", "R8", "normal", 2450),
  cub("SP", "CSL-8", "normal", 2600),
  cub("SP", "CSL-8", "alto", 3150),
  cub("SP", "GI", "unico", 1500),
  // RJ ficou para trás: a tabela mais recente é de agosto.
  cub("RJ", "R1", "alto", 3300, "2026-08-01"),
  cub("RJ", "R1", "normal", 2650, "2026-08-01"),
  cub("MG", "R1", "alto", 3000),
  // Com desoneração só há SP R1 alto e normal, um pouco abaixo da série sem desoneração.
  cub("SP", "R1", "alto", 3230, "2026-09-01", "desonerado"),
  cub("SP", "R1", "normal", 2600, "2026-09-01", "desonerado"),
];

const SEM_ADICIONAIS: Partial<Ficha> = {
  piscina: 0,
  gourmet: false,
  elevador: false,
  subsolo: false,
  paisagismo: false,
  marcenaria: "nenhuma",
};

const sobrado: Ficha = {
  ...fichaInicial("2027-03"),
  subtipo: "sobrado",
  padrao: "alto",
  area: 320,
  pavimentos: 2,
  terreno: 600,
  quartos: 4,
  suites: 4,
  banheiros: 5,
  lavabo: 1,
  vagas: 4,
  ...SEM_ADICIONAIS,
};

const completo: Ficha = {
  ...sobrado,
  piscina: 32,
  gourmet: true,
  marcenaria: "completa",
  paisagismo: true,
};

function calcular(parcial: Partial<EntradaCalculo> & { ficha: Ficha }): ResultadoEstimativa {
  const saida = calcularEstimativa({ cub: CUB, parametros, parametrosValidados: true, ...parcial });
  if (!saida.ok) throw new Error(`Esperava cálculo, veio erro: ${saida.mensagem}`);
  return saida.resultado;
}

const soma = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) * 100) / 100;

describe("seed dos parâmetros", () => {
  it("a migration semeia parâmetros válidos para o schema", () => {
    expect(parametros.etapas.length).toBeGreaterThan(5);
  });

  it("lerParametros recusa o que não é parâmetro, com mensagem", () => {
    const ruim = lerParametros({ versao: 1 });
    expect(ruim.ok).toBe(false);
    expect(lerParametros(parametros).ok).toBe(true);
  });

  it("percentuais que não fecham 100 são recusados", () => {
    const torto = structuredClone(parametros);
    torto.etapas[0].percentual += 5;
    expect(parametrosSchema.safeParse(torto).success).toBe(false);
  });

  it("adicional apontando para fase inexistente é recusado", () => {
    const torto = structuredClone(parametros);
    torto.adicionais.piscina.fase = "nao_existe";
    expect(parametrosSchema.safeParse(torto).success).toBe(false);
  });
});

describe("descreverAdicional", () => {
  it("diz como cada adicional do seed é cobrado", () => {
    const a = parametros.adicionais;
    expect(descreverAdicional(a.fundacao)).toBe("6% da base (8% em galpão)");
    expect(descreverAdicional(a.piscina)).toBe("R$ 2.500 por m²");
    expect(descreverAdicional(a.gourmet)).toBe("R$ 25.000 no baixo, R$ 45.000 no normal, R$ 80.000 no alto");
    expect(descreverAdicional(a.marcenaria)).toBe("6% da base na básica, 11% na completa");
    expect(descreverAdicional(a.paisagismo)).toBe("R$ 110 por m² de área livre");
    expect(descreverAdicional(a.elevador)).toBe("R$ 180.000");
    expect(descreverAdicional(a.subsolo)).toBe("a definir");
  });

  it("percentual de galpão some quando o adicional não tem valor industrial", () => {
    const sem = { ...parametros.adicionais.fundacao, valor_industrial: undefined };
    expect(descreverAdicional(sem as typeof parametros.adicionais.fundacao)).toBe("6% da base");
  });
});

describe("leitores de fronteira", () => {
  it("lerCub aceita linhas boas e recusa a leitura inteira se uma for ruim", () => {
    const boa = { uf: "SP", subtipo: "R1", padrao: "alto", mes_base: "2026-09-01", valor_m2: 3350 };
    expect(lerCub([boa, boa]).ok).toBe(true);
    const lidas = lerCub([boa, { ...boa, regime: "desonerado" }]);
    expect(lidas.ok && lidas.valor.map((l) => l.regime)).toEqual(["onerado", "desonerado"]);
    expect(lerCub([{ ...boa, regime: "misto" }]).ok).toBe(false);
    const ruim = lerCub([boa, { ...boa, valor_m2: 0 }]);
    expect(ruim.ok).toBe(false);
    if (!ruim.ok) expect(ruim.mensagem).toMatch(/Linhas do CUB inválidos/);
    expect(lerCub([{ ...boa, uf: "XX" }]).ok).toBe(false);
    expect(lerCub([{ ...boa, mes_base: "2026-09-15" }]).ok).toBe(false);
  });

  it("lerAjustes aceita ajuste vazio e recusa lixo", () => {
    expect(lerAjustes({}).ok).toBe(true);
    expect(lerAjustes({ adicionais: { piscina: { valor: 3000 } } }).ok).toBe(true);
    expect(lerAjustes({ adicionais: "tudo" }).ok).toBe(false);
  });

  it("lerPremissas aceita premissa parcial e recusa fora dos limites", () => {
    expect(lerPremissas({}).ok).toBe(true);
    expect(lerPremissas({ adm: 12, faixa: 15, equipe: 8 }).ok).toBe(true);
    expect(lerPremissas({ regime: "desonerado" }).ok).toBe(true);
    expect(lerPremissas({ regime: "misto" }).ok).toBe(false);
    expect(lerPremissas({ adm: 90 }).ok).toBe(false);
    expect(lerPremissas({ equipe: 0 }).ok).toBe(false);
  });
});

describe("distribuir (maior resto)", () => {
  it("nunca perde nem cria centavo", () => {
    for (const total of [0, 1, 7, 100, 12345, 99999999]) {
      for (const pesos of [[1], [1, 1, 1], [3, 18, 8, 6, 14, 9, 16, 8, 6, 5, 7], [0, 0, 5]]) {
        expect(distribuir(total, pesos).reduce((a, b) => a + b, 0)).toBe(total);
      }
    }
  });

  it("sem pesos devolve lista vazia", () => {
    expect(distribuir(100, [])).toEqual([]);
  });

  it("pesos todos zero divide igualmente", () => {
    expect(distribuir(10, [0, 0])).toEqual([5, 5]);
  });
});

describe("calcularEstimativa: custo", () => {
  it("base do CUB, fundação, administração e faixa (critério de aceite da SPEC 136)", () => {
    const r = calcular({ ficha: sobrado });
    const base = 320 * 3350;
    const fundacao = base * 0.06;
    expect(r.base).toBe(base);
    expect(r.adicionais.map((a) => a.id)).toEqual(["fundacao"]);
    expect(r.adicionais[0].valor).toBe(fundacao);
    expect(r.subtotal).toBe(base + fundacao);
    expect(r.taxaAdministracao).toBe(Math.round((base + fundacao) * 0.12 * 100) / 100);
    expect(r.provavel).toBeCloseTo((base + fundacao) * 1.12, 2);
    expect(r.faixaPct).toBe(12);
    expect(r.minimo).toBeCloseTo(r.provavel * 0.88, 1);
    expect(r.maximo).toBeCloseTo(r.provavel * 1.12, 1);
    expect(r.porM2).toBeCloseTo(r.provavel / 320, 1);
  });

  it("cita a fonte com UF, código do CUB, padrão e mês", () => {
    const r = calcular({ ficha: sobrado });
    expect(r.fonte.texto).toBe("CUB R1-A · SP · set/2026 · sem desoneração");
    expect(r.fonte.origem).toBe("uf");
    expect(r.fonte.mesAntigo).toBe(false);
  });

  it("é determinístico: o mesmo input dá exatamente o mesmo resultado", () => {
    const a = calcular({ ficha: completo });
    const b = calcular({ ficha: structuredClone(completo) });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("o resultado é serializável e passa no schema (snapshot de versão)", () => {
    const r = calcular({ ficha: completo });
    expect(resultadoSchema.safeParse(JSON.parse(JSON.stringify(r))).success).toBe(true);
  });

  it("premissas mudam administração, faixa e equipe", () => {
    const r = calcular({ ficha: sobrado, premissas: { adm: 0, faixa: 20, equipe: 12 } });
    expect(r.taxaAdministracao).toBe(0);
    expect(r.admPct).toBe(0);
    expect(r.faixaPct).toBe(20);
    expect(r.equipe).toBe(12);
  });
});

describe("calcularEstimativa: as somas fecham ao centavo", () => {
  const fichas: [string, Ficha][] = [
    ["sobrado sem adicionais", sobrado],
    ["sobrado completo", completo],
    ["casa baixo padrão", { ...fichaInicial("2027-01"), padrao: "baixo", area: 87.35, ...SEM_ADICIONAIS }],
    [
      "edifício com elevador e subsolo",
      {
        ...fichaInicial("2027-06"),
        subtipo: "edificio",
        padrao: "normal",
        area: 4120,
        pavimentos: 8,
        elevador: true,
        subsolo: true,
        terreno: 1500,
        banheiros: 40,
        suites: 0,
      },
    ],
    [
      "salas comerciais",
      {
        ...fichaInicial("2026-12"),
        tipo: "comercial",
        subtipo: "salas",
        padrao: "alto",
        area: 1999.99,
        pavimentos: 4,
        terreno: 900,
        marcenaria: "basica",
        banheiros: 8,
      },
    ],
    [
      "galpão industrial",
      {
        ...fichaInicial("2027-02"),
        tipo: "industrial",
        subtipo: "galpao",
        padrao: "normal",
        area: 2400,
        pavimentos: 1,
        terreno: 5000,
        banheiros: 6,
      },
    ],
  ];

  for (const [nome, ficha] of fichas) {
    it(nome, () => {
      const r = calcular({ ficha });
      const adicionais = soma(r.adicionais.map((a) => a.valor ?? 0));
      expect(soma(r.etapas.map((e) => e.valor))).toBe(r.base);
      expect(soma([r.base, adicionais])).toBe(r.subtotal);
      expect(soma([r.subtotal, r.taxaAdministracao])).toBe(r.provavel);
      expect(soma(r.natureza.map((n) => n.valor))).toBe(r.provavel);
      expect(soma(r.fases.map((f) => f.valor))).toBe(r.provavel);
      expect(soma(r.desembolso.map((d) => d.valor))).toBe(r.provavel);
      expect(r.desembolso).toHaveLength(r.meses);
    });
  }
});

describe("calcularEstimativa: adicionais", () => {
  it("piscina, gourmet, marcenaria e paisagismo entram só quando marcados", () => {
    const r = calcular({ ficha: completo });
    const ids = r.adicionais.map((a) => a.id);
    expect(ids).toEqual(["fundacao", "piscina", "gourmet", "marcenaria", "paisagismo"]);
    const por = (id: string) => r.adicionais.find((a) => a.id === id)!;
    expect(por("piscina").valor).toBe(32 * 2500);
    expect(por("piscina").rotulo).toBe("Piscina (32 m²)");
    expect(por("gourmet").valor).toBe(80000);
    expect(por("marcenaria").valor).toBe(Math.round(320 * 3350 * 0.11 * 100) / 100);
    expect(por("marcenaria").rotulo).toBe("Marcenaria completa");
    // área livre = terreno - projeção (320 / 2 pavimentos)
    expect(por("paisagismo").valor).toBe((600 - 160) * 110);
  });

  it("piscina e gourmet só valem para obra residencial", () => {
    const r = calcular({
      ficha: {
        ...fichaInicial("2027-03"),
        tipo: "comercial",
        subtipo: "salas",
        padrao: "normal",
        area: 800,
        pavimentos: 4,
        terreno: 600,
        piscina: 50,
        gourmet: true,
      },
    });
    expect(r.adicionais.map((a) => a.id)).toEqual(["fundacao"]);
  });

  it("subsolo fica 'a definir', fora do total, com aviso", () => {
    const r = calcular({ ficha: { ...sobrado, subsolo: true } });
    const subsolo = r.adicionais.find((a) => a.id === "subsolo")!;
    expect(subsolo.valor).toBeNull();
    expect(subsolo.aDefinir).toBe(true);
    const semSubsolo = calcular({ ficha: sobrado });
    expect(r.provavel).toBe(semSubsolo.provavel);
    expect(r.avisos.some((a) => a.codigo === "adicional_a_definir")).toBe(true);
  });

  it("fundação da obra industrial usa o percentual próprio", () => {
    const r = calcular({
      ficha: {
        ...fichaInicial("2027-02"),
        tipo: "industrial",
        subtipo: "galpao",
        area: 1000,
        pavimentos: 1,
        terreno: 3000,
      },
    });
    expect(r.adicionais[0].valor).toBe(1000 * 1500 * 0.08);
  });

  it("ajuste da empresa troca o valor de referência", () => {
    const base = calcular({ ficha: completo });
    const ajustado = calcular({ ficha: completo, ajustes: { adicionais: { piscina: { valor: 3000 } } } });
    expect(ajustado.adicionais.find((a) => a.id === "piscina")!.valor).toBe(32 * 3000);
    expect(ajustado.provavel).toBeGreaterThan(base.provavel);
  });

  it("ajuste inválido é ignorado e avisa; vale a referência", () => {
    const base = calcular({ ficha: completo });
    const r = calcular({ ficha: completo, ajustes: { adicionais: { piscina: { valor: "muito" } } } });
    expect(r.provavel).toBe(base.provavel);
    expect(r.avisos.some((a) => a.codigo === "ajuste_ignorado")).toBe(true);
  });

  it("ajuste não consegue mudar o tipo nem a fase do adicional", () => {
    const r = calcular({
      ficha: completo,
      ajustes: { adicionais: { piscina: { tipo: "valor_fixo", fase: "prel", valor: 10 } } },
    });
    const piscina = r.adicionais.find((a) => a.id === "piscina")!;
    expect(piscina.fase).toBe("adic");
    expect(piscina.valor).toBe(32 * 10);
  });
});

describe("calcularEstimativa: escolha do CUB", () => {
  it("UF com tabela atrasada usa o mês dela, avisa e alarga a faixa", () => {
    const r = calcular({ ficha: { ...sobrado, uf: "RJ" } });
    expect(r.fonte.uf).toBe("RJ");
    expect(r.fonte.mesBase).toBe("2026-08-01");
    expect(r.fonte.mesAntigo).toBe(true);
    expect(r.faixaPct).toBe(12 + parametros.faixa_extra_mes_antigo);
    expect(r.avisos.map((a) => a.codigo)).toContain("mes_antigo");
  });

  it("UF sem nenhum dado usa a vizinha mais próxima, avisa e alarga a faixa", () => {
    // ES não tem linha: a vizinha mais próxima com dado é RJ (SP vem depois), e o mês de RJ é antigo.
    const r = calcular({ ficha: { ...sobrado, uf: "ES" } });
    expect(r.fonte.uf).toBe("RJ");
    expect(r.fonte.origem).toBe("uf_vizinha");
    expect(r.faixaPct).toBe(12 + parametros.faixa_extra_mes_antigo + parametros.faixa_extra_uf_vizinha);
    const codigos = r.avisos.map((a) => a.codigo);
    expect(codigos).toContain("uf_vizinha");
    expect(codigos).toContain("mes_antigo");
  });

  it("sem CUB do subtipo, não calcula e explica", () => {
    const saida = calcularEstimativa({
      cub: CUB.filter((l) => l.subtipo !== "R1"),
      parametros,
      parametrosValidados: true,
      ficha: sobrado,
    });
    expect(saida.ok).toBe(false);
    if (!saida.ok) {
      expect(saida.motivo).toBe("sem_cub");
      expect(saida.mensagem).toMatch(/Fale com o time/);
    }
  });

  it("padrão sem tabela para o subtipo é recusado com orientação", () => {
    const saida = calcularEstimativa({
      cub: CUB,
      parametros,
      parametrosValidados: true,
      ficha: {
        ...fichaInicial("2027-03"),
        tipo: "comercial",
        subtipo: "salas",
        padrao: "baixo",
        area: 500,
        pavimentos: 4,
        terreno: 600,
      },
    });
    expect(saida.ok).toBe(false);
    if (!saida.ok) expect(saida.motivo).toBe("padrao_indisponivel");
  });

  it("CUB sem divisão por padrão ('unico') serve para qualquer padrão", () => {
    for (const padrao of ["baixo", "normal", "alto"] as const) {
      const r = calcular({
        ficha: {
          ...fichaInicial("2027-02"),
          tipo: "industrial",
          subtipo: "galpao",
          padrao,
          area: 1000,
          pavimentos: 1,
          terreno: 3000,
        },
      });
      expect(r.fonte.padrao).toBe("unico");
      expect(r.fonte.texto).toBe("CUB GI · SP · set/2026 · sem desoneração");
    }
  });

  it("padroesDisponiveis diz quais padrões o assistente pode oferecer", () => {
    expect(padroesDisponiveis(CUB, "R1")).toEqual(["baixo", "normal", "alto"]);
    expect(padroesDisponiveis(CUB, "CSL-8")).toEqual(["normal", "alto"]);
    expect(padroesDisponiveis(CUB, "GI")).toEqual(["baixo", "normal", "alto"]);
    expect(padroesDisponiveis(CUB, "CAL-8")).toEqual([]);
  });
});

describe("calcularEstimativa: prazo, cronograma e desembolso", () => {
  it("mais gente na obra encurta o prazo, com piso de 4 meses", () => {
    const equipe6 = calcular({ ficha: sobrado, premissas: { equipe: 6 } });
    const equipe20 = calcular({ ficha: sobrado, premissas: { equipe: 20 } });
    expect(equipe20.meses).toBeLessThan(equipe6.meses);
    const minima = calcular({ ficha: { ...sobrado, area: 40, pavimentos: 1 }, premissas: { equipe: 200 } });
    expect(minima.meses).toBe(4);
  });

  it("comparar cenário em outro padrão muda custo e prazo, sem mexer na ficha", () => {
    const alto = calcular({ ficha: sobrado });
    const normal = calcular({ ficha: sobrado, padraoCenario: "normal" });
    expect(normal.padrao).toBe("normal");
    expect(normal.provavel).toBeLessThan(alto.provavel);
    expect(normal.meses).toBeLessThanOrEqual(alto.meses);
    expect(sobrado.padrao).toBe("alto");
  });

  it("as fases ficam dentro do prazo e na ordem do cronograma", () => {
    const r = calcular({ ficha: completo });
    for (const f of r.fases) {
      expect(f.inicioMes).toBeGreaterThanOrEqual(0);
      expect(f.fimMes).toBeLessThanOrEqual(r.meses);
      expect(f.fimMes).toBeGreaterThan(f.inicioMes);
      expect(f.inicio <= f.fim).toBe(true);
    }
    expect(r.fases[0].inicio).toBe("2027-03-01");
    expect(r.fases[r.fases.length - 1].fimMes).toBe(r.meses);
  });

  it("etapas e serviços ficam dentro da janela da fase, com datas válidas", () => {
    const r = calcular({ ficha: completo });
    for (const f of r.fases) {
      for (const e of f.etapas) {
        expect(e.inicio >= f.inicio && e.fim <= f.fim).toBe(true);
        expect(e.inicio <= e.fim).toBe(true);
        for (const s of e.servicos) {
          expect(s.inicio >= e.inicio && s.fim <= e.fim).toBe(true);
          expect(s.inicio <= s.fim).toBe(true);
        }
      }
    }
  });

  it("a fase de adicionais só aparece quando há adicional com serviço", () => {
    expect(calcular({ ficha: sobrado }).fases.map((f) => f.id)).not.toContain("adic");
    const comPiscina = calcular({ ficha: { ...sobrado, piscina: 20 } });
    const adic = comPiscina.fases.find((f) => f.id === "adic")!;
    expect(adic.etapas.map((e) => e.nome)).toEqual(["Piscina"]);
    expect(adic.valor).toBeGreaterThan(0);
  });

  it("o desembolso começa no mês de início e é contínuo", () => {
    const r = calcular({ ficha: sobrado });
    expect(r.desembolso[0].mes).toBe("2027-03");
    expect(r.desembolso.every((d) => d.valor > 0)).toBe(true);
    expect(r.desembolso[1].mes).toBe("2027-04");
  });

  it("início em dezembro vira o ano nas datas e no desembolso", () => {
    const r = calcular({ ficha: { ...sobrado, inicio: "2026-12" } });
    expect(r.desembolso[1].mes).toBe("2027-01");
    expect(r.fases[0].inicio).toBe("2026-12-01");
  });
});

describe("avisos", () => {
  it("parâmetros não validados sempre avisam", () => {
    const r = calcular({ ficha: sobrado, parametrosValidados: false });
    expect(r.parametrosValidados).toBe(false);
    expect(r.avisos.map((a) => a.codigo)).toContain("parametros_nao_validados");
    const validado = calcular({ ficha: sobrado, parametrosValidados: true });
    expect(validado.avisos.map((a) => a.codigo)).not.toContain("parametros_nao_validados");
  });

  it("coerência: suítes demais para a área", () => {
    const avisos = avisosCoerencia({ ...sobrado, area: 90, suites: 5, banheiros: 5 });
    expect(avisos.join(" ")).toMatch(/5 suítes em 90 m²/);
  });

  it("coerência: mais suítes do que quartos", () => {
    const avisos = avisosCoerencia({ ...sobrado, quartos: 3, suites: 4, banheiros: 5 });
    expect(avisos.join(" ")).toMatch(/mais suítes do que quartos/);
    expect(avisosCoerencia({ ...sobrado, quartos: 4, suites: 4 })).toEqual([]);
  });

  it("coerência: mais suítes do que banheiros, área por pavimento e piscina grande", () => {
    expect(avisosCoerencia({ ...sobrado, suites: 4, banheiros: 2 }).join(" ")).toMatch(/mais suítes do que banheiros/);
    expect(avisosCoerencia({ ...sobrado, area: 50, pavimentos: 3, suites: 0 }).join(" ")).toMatch(
      /menos de 30 m² por pavimento/
    );
    expect(avisosCoerencia({ ...sobrado, terreno: 100, piscina: 60, area: 200, suites: 0 }).join(" ")).toMatch(
      /40% do terreno/
    );
  });

  it("a ficha do protótipo não gera aviso de coerência", () => {
    expect(avisosCoerencia(sobrado)).toEqual([]);
  });

  it("os avisos de coerência vão junto do resultado", () => {
    const r = calcular({ ficha: { ...sobrado, suites: 6, banheiros: 6, area: 100, pavimentos: 1 } });
    expect(r.avisos.some((a) => a.codigo === "coerencia")).toBe(true);
  });
});

describe("ficha", () => {
  it("ficha inicial é válida", () => {
    expect(fichaSchema.safeParse(fichaInicial("2027-03")).success).toBe(true);
  });

  it("subtipo de outro tipo de obra é recusado", () => {
    const saida = calcularEstimativa({
      cub: CUB,
      parametros,
      parametrosValidados: true,
      ficha: { ...fichaInicial("2027-03"), tipo: "industrial", subtipo: "sobrado" },
    });
    expect(saida.ok).toBe(false);
    if (!saida.ok) expect(saida.motivo).toBe("ficha_invalida");
  });

  it("área zero e início fora do formato são recusados", () => {
    expect(fichaSchema.safeParse({ ...fichaInicial("2027-03"), area: 0 }).success).toBe(false);
    expect(fichaSchema.safeParse({ ...fichaInicial("2027-03"), inicio: "03/2027" }).success).toBe(false);
  });

  it("rótulo do mês-base", () => {
    expect(rotuloMesBase("2026-09-01")).toBe("set/2026");
    expect(rotuloMesBase("2027-01-01")).toBe("jan/2027");
  });

  it("os adicionais do schema são exatamente os que o motor conhece", () => {
    expect(Object.keys(parametros.adicionais).sort()).toEqual([...ADICIONAIS_IDS].sort());
  });
});

describe("calcularEstimativa: regime do CUB (BEZ-51)", () => {
  it("sem regime nas premissas usa o CUB sem desoneração", () => {
    const r = calcular({ ficha: sobrado });
    expect(r.fonte.regime).toBe("onerado");
    expect(r.fonte.valorM2).toBe(3350);
  });

  it("com desoneração usa o valor do regime e diz isso na fonte", () => {
    const com = calcular({ ficha: sobrado, premissas: { regime: "desonerado" } });
    const sem = calcular({ ficha: sobrado, premissas: { regime: "onerado" } });
    expect(com.fonte.regime).toBe("desonerado");
    expect(com.fonte.valorM2).toBe(3230);
    expect(com.fonte.texto).toBe("CUB R1-A · SP · set/2026 · com desoneração");
    expect(com.base).toBe(320 * 3230);
    expect(com.provavel).toBeLessThan(sem.provavel);
  });

  it("regime sem nenhuma linha para o tipo de obra devolve erro claro, sem cair no outro regime", () => {
    const saida = calcularEstimativa({
      ficha: { ...sobrado, tipo: "comercial", subtipo: "salas", padrao: "normal" },
      premissas: { regime: "desonerado" },
      cub: CUB,
      parametros,
      parametrosValidados: true,
    });
    expect(saida.ok).toBe(false);
    if (!saida.ok) {
      expect(saida.motivo).toBe("regime_indisponivel");
      expect(saida.mensagem).toMatch(/CUB com desoneração/);
    }
  });

  it("padroesDisponiveis olha só o regime pedido", () => {
    expect(padroesDisponiveis(CUB, "R1", "desonerado")).toEqual(["normal", "alto"]);
    expect(padroesDisponiveis(CUB, "R1")).toEqual(["baixo", "normal", "alto"]);
  });

  it("o mês de referência de cada regime é independente", () => {
    const so_onerado = CUB.filter((l) => l.regime === "onerado");
    const novo = [...so_onerado, cub("SP", "R1", "alto", 3300, "2026-10-01", "desonerado")];
    const r = calcular({ cub: novo, ficha: sobrado, premissas: { regime: "desonerado" } });
    expect(r.fonte.mesBase).toBe("2026-10-01");
    expect(r.fonte.mesAntigo).toBe(false);
  });

  it("resultado salvo antes do regime existir continua legível como sem desoneração", () => {
    const r = calcular({ ficha: sobrado });
    const fonteAntiga: Record<string, unknown> = { ...r.fonte };
    delete fonteAntiga.regime;
    const lido = resultadoSchema.safeParse({ ...r, fonte: fonteAntiga });
    expect(lido.success && lido.data.fonte.regime).toBe("onerado");
  });
});

describe("calcularEstimativa: terreno inclinado (BEZ-68)", () => {
  const plano = () => calcular({ ficha: sobrado });
  const ids = (r: ResultadoEstimativa) => r.adicionais.map((a) => a.id);

  it("terreno plano não traz muro de arrimo nem terraplenagem", () => {
    expect(ids(plano())).toEqual(["fundacao"]);
  });

  it("inclinado com a medida do muro soma o arrimo e deixa a terraplenagem a definir", () => {
    const r = calcular({ ficha: { ...sobrado, topografia: "inclinado", arrimo: 80 } });
    const arrimo = r.adicionais.find((a) => a.id === "arrimo");
    const terra = r.adicionais.find((a) => a.id === "terraplenagem");
    expect(arrimo?.valor).toBe(80 * 1200);
    expect(arrimo?.rotulo).toBe("Muro de arrimo (80 m²)");
    expect(arrimo?.aDefinir).toBe(false);
    expect(terra?.valor).toBeNull();
    expect(terra?.aDefinir).toBe(true);
    expect(r.provavel).toBeGreaterThan(plano().provavel);
    expect(r.avisos.map((a) => a.mensagem).join(" ")).toMatch(/Terraplenagem e fundação especial ainda não tem valor/);
  });

  it("inclinado sem medir o muro deixa os dois itens a definir e o total não muda", () => {
    const r = calcular({ ficha: { ...sobrado, topografia: "inclinado", arrimo: 0 } });
    expect(ids(r)).toEqual(["fundacao", "arrimo", "terraplenagem"]);
    expect(r.adicionais.filter((a) => a.aDefinir).map((a) => a.id)).toEqual(["arrimo", "terraplenagem"]);
    expect(r.provavel).toBe(plano().provavel);
  });

  it("a empresa ajusta o valor do muro de arrimo", () => {
    const r = calcular({
      ficha: { ...sobrado, topografia: "inclinado", arrimo: 50 },
      ajustes: { adicionais: { arrimo: { valor: 2000 } } },
    });
    expect(r.adicionais.find((a) => a.id === "arrimo")?.valor).toBe(100_000);
  });

  it("parâmetros gravados antes do terreno inclinado seguem calculando, sem esses itens", () => {
    const antigo = structuredClone(parametros);
    delete antigo.adicionais.arrimo;
    delete antigo.adicionais.terraplenagem;
    const r = calcular({ parametros: antigo, ficha: { ...sobrado, topografia: "inclinado", arrimo: 80 } });
    expect(ids(r)).toEqual(["fundacao"]);
  });

  it("ficha salva antes do terreno inclinado lê como terreno plano", () => {
    const { topografia: _t, arrimo: _a, ...antiga } = sobrado;
    const lida = fichaSchema.safeParse(antiga);
    expect(lida.success && [lida.data.topografia, lida.data.arrimo]).toEqual(["plano", 0]);
  });

  it("recusa área de muro negativa", () => {
    expect(fichaSchema.safeParse({ ...sobrado, topografia: "inclinado", arrimo: -5 }).success).toBe(false);
  });
});

describe("rotuloPadrao", () => {
  it("o padrão normal do CUB é o médio", () => {
    expect(["baixo", "normal", "alto"].map((p) => rotuloPadrao(p as "baixo"))).toEqual(["baixo", "médio", "alto"]);
  });
});

describe("natureza do custo contra a composição oficial do CUB (BEZ-68)", () => {
  // Sinduscon-PR, Relatório 5, set/2026: composição do CUB/m² das residências unifamiliares (R$/m²).
  // Fonte: sindusconpr.com.br/wp-content/uploads/2026/10/2026-9-Relatorio-5-composicao-cub-m2-valores-em-reais.pdf
  const COMPOSICAO_R1 = [
    { padrao: "baixo", material: 1093.23, maoDeObra: 1422.46, despesas: 161.5, equipamentos: 4.4 },
    { padrao: "normal", material: 1243.66, maoDeObra: 1969.6, despesas: 151.64, equipamentos: 0.31 },
    { padrao: "alto", material: 1828.58, maoDeObra: 2137.19, despesas: 143.36, equipamentos: 0.38 },
  ];
  const pct = (parte: number, total: number) => (parte / total) * 100;

  it("cada padrão da composição oficial fica a menos de 8 pontos do seed, e a média a menos de 2", () => {
    const nb = parametros.natureza_base;
    const medias = { material: 0, mao_de_obra: 0, despesas: 0 };
    for (const c of COMPOSICAO_R1) {
      const total = c.material + c.maoDeObra + c.despesas + c.equipamentos;
      const m = pct(c.material, total);
      const mo = pct(c.maoDeObra, total);
      expect(Math.abs(nb.material - m)).toBeLessThan(8);
      expect(Math.abs(nb.mao_de_obra - mo)).toBeLessThan(8);
      medias.material += m / COMPOSICAO_R1.length;
      medias.mao_de_obra += mo / COMPOSICAO_R1.length;
      medias.despesas += pct(c.despesas, total) / COMPOSICAO_R1.length;
    }
    expect(Math.abs(nb.material - medias.material)).toBeLessThan(2);
    expect(Math.abs(nb.mao_de_obra - medias.mao_de_obra)).toBeLessThan(2);
    expect(Math.abs(nb.despesas - medias.despesas)).toBeLessThan(2);
  });
});
