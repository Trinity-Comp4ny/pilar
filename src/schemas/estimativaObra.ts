// SPEC 136 / ADR 0063: contratos da estimativa de obra. Tudo que entra no motor (ficha digitada ou
// lida por IA, premissas, linhas do CUB, parâmetros do banco, ajustes da empresa) passa por aqui
// antes do cálculo, e o resultado é validado ao ser relido de uma versão gravada.
import { z } from "zod";

export const UFS = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;
export type Uf = (typeof UFS)[number];

const TIPOS_OBRA = ["residencial", "comercial", "industrial"] as const;
export type TipoObra = (typeof TIPOS_OBRA)[number];

export const PADROES = ["baixo", "normal", "alto"] as const;
export type Padrao = (typeof PADROES)[number];

/** Versão do CUB: sem desoneração da folha (série clássica) ou com desoneração. */
export const REGIMES = ["onerado", "desonerado"] as const;
export type Regime = (typeof REGIMES)[number];

const NIVEIS_MARCENARIA = ["nenhuma", "basica", "completa"] as const;

/** Subtipo de obra e o código do CUB (NBR 12721) que o precifica. */
export const SUBTIPOS: Record<
  TipoObra,
  Record<string, { nome: string; cub: string; pavimentos: number; exemplo: string }>
> = {
  residencial: {
    casa: { nome: "Casa térrea", cub: "R1", pavimentos: 1, exemplo: "Residência unifamiliar de um pavimento" },
    sobrado: { nome: "Sobrado", cub: "R1", pavimentos: 2, exemplo: "Residência unifamiliar de dois pavimentos" },
    edificio: { nome: "Edifício residencial", cub: "R8", pavimentos: 8, exemplo: "Prédio de apartamentos" },
  },
  comercial: {
    salas: { nome: "Salas e lojas", cub: "CSL-8", pavimentos: 4, exemplo: "Edifício de salas comerciais e lojas" },
    andares: { nome: "Andares corridos", cub: "CAL-8", pavimentos: 6, exemplo: "Edifício de andares livres" },
  },
  industrial: {
    galpao: { nome: "Galpão", cub: "GI", pavimentos: 1, exemplo: "Galpão industrial ou logístico" },
  },
};

const NUMERO = { invalid_type_error: "Informe um número" };
const inteiro = (max: number) =>
  z.number(NUMERO).int("Use um número inteiro").min(0, "Não pode ser negativo").max(max, "Confira esse valor");

export const fichaSchema = z
  .object({
    tipo: z.enum(TIPOS_OBRA),
    subtipo: z.string().min(1, "Escolha o subtipo da obra"),
    padrao: z.enum(PADROES),
    uf: z.enum(UFS),
    area: z.number(NUMERO).positive("Informe a área construída").max(1_000_000, "Confira a área construída"),
    pavimentos: z
      .number(NUMERO)
      .int("Use um número inteiro")
      .min(1, "Informe ao menos 1 pavimento")
      .max(120, "Confira os pavimentos"),
    terreno: z.number(NUMERO).min(0, "Não pode ser negativo").max(10_000_000, "Confira a área do terreno"),
    /** Mês previsto de início, `AAAA-MM`. */
    inicio: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Escolha o mês de início"),
    quartos: inteiro(99),
    suites: inteiro(99),
    banheiros: inteiro(99),
    lavabo: inteiro(99),
    vagas: inteiro(999),
    /** m² de piscina; 0 = sem piscina. */
    piscina: z.number(NUMERO).min(0, "Não pode ser negativo").max(100_000, "Confira a área da piscina"),
    gourmet: z.boolean(),
    elevador: z.boolean(),
    subsolo: z.boolean(),
    paisagismo: z.boolean(),
    marcenaria: z.enum(NIVEIS_MARCENARIA),
  })
  .superRefine((f, ctx) => {
    if (!SUBTIPOS[f.tipo][f.subtipo]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["subtipo"],
        message: "Subtipo não existe para esse tipo de obra",
      });
    }
  });
export type Ficha = z.infer<typeof fichaSchema>;

/** Premissas editáveis na tela de resultado. Ausente = usa o padrão dos parâmetros. */
export const premissasSchema = z.object({
  adm: z.number().min(0).max(40).optional(),
  faixa: z.number().min(1).max(50).optional(),
  equipe: z.number().int().min(1).max(200).optional(),
  /** Versão do CUB. Ausente = onerado (sem desoneração), a mais conservadora. */
  regime: z.enum(REGIMES).optional(),
});
export type Premissas = z.infer<typeof premissasSchema>;

/** Uma linha de `cub_valores`. */
export const cubLinhaSchema = z.object({
  uf: z.enum(UFS),
  subtipo: z.string().min(1),
  padrao: z.enum([...PADROES, "unico"]),
  mes_base: z.string().regex(/^\d{4}-\d{2}-01$/),
  valor_m2: z.number().positive(),
  regime: z.enum(REGIMES).default("onerado"),
});
export type CubLinha = z.infer<typeof cubLinhaSchema>;

// ── Parâmetros (estimativa_parametros.parametros) ────────────────────────────

const percentual = z.number().min(0).max(100);

const adicionalBase = {
  rotulo: z.string().min(1),
  nota: z.string().optional(),
  /** Fase do cronograma em que o custo entra (id de `fases`). */
  fase: z.string().min(1),
  servicos: z.array(z.string().min(1)),
};

export const adicionalSchema = z.discriminatedUnion("tipo", [
  z.object({
    ...adicionalBase,
    tipo: z.literal("percentual_base"),
    valor: percentual,
    valor_industrial: percentual.optional(),
  }),
  z.object({ ...adicionalBase, tipo: z.literal("por_m2"), valor: z.number().min(0) }),
  z.object({
    ...adicionalBase,
    tipo: z.literal("por_padrao"),
    valores: z.object({ baixo: z.number().min(0), normal: z.number().min(0), alto: z.number().min(0) }),
  }),
  z.object({
    ...adicionalBase,
    tipo: z.literal("percentual_base_por_nivel"),
    valores: z.object({ basica: percentual, completa: percentual }),
  }),
  z.object({ ...adicionalBase, tipo: z.literal("por_m2_area_livre"), valor: z.number().min(0) }),
  z.object({ ...adicionalBase, tipo: z.literal("valor_fixo"), valor: z.number().min(0) }),
  z.object({ ...adicionalBase, tipo: z.literal("a_definir") }),
]);
export type Adicional = z.infer<typeof adicionalSchema>;

export const ADICIONAIS_IDS = [
  "fundacao",
  "piscina",
  "gourmet",
  "marcenaria",
  "paisagismo",
  "elevador",
  "subsolo",
] as const;
export type AdicionalId = (typeof ADICIONAIS_IDS)[number];

const soma = (valores: number[]) => valores.reduce((a, b) => a + b, 0);

export const parametrosSchema = z
  .object({
    versao: z.literal(1),
    adm_padrao: z.number().min(0).max(40),
    faixa_padrao: z.number().min(1).max(50),
    equipe_padrao: z.number().int().min(1).max(200),
    horas_mes_por_pessoa: z.number().positive().max(744),
    faixa_extra_mes_antigo: z.number().min(0).max(30),
    faixa_extra_uf_vizinha: z.number().min(0).max(30),
    produtividade_h_m2: z.object({
      baixo: z.number().positive(),
      normal: z.number().positive(),
      alto: z.number().positive(),
      industrial: z.number().positive(),
    }),
    natureza_base: z.object({
      material: percentual,
      mao_de_obra: percentual,
      equipamentos: percentual,
      despesas: percentual,
    }),
    natureza_adicionais: z.object({ material: percentual, mao_de_obra: percentual }),
    etapas: z
      .array(
        z.object({
          id: z.string().min(1),
          nome: z.string().min(1),
          fase: z.string().min(1),
          percentual: percentual,
        })
      )
      .min(1),
    fases: z
      .array(
        z.object({
          id: z.string().min(1),
          nome: z.string().min(1),
          inicio: z.number().min(0).max(1),
          fim: z.number().min(0).max(1),
          etapas: z.array(z.object({ nome: z.string().min(1), servicos: z.array(z.string().min(1)) })),
        })
      )
      .min(1),
    adicionais: z.object({
      fundacao: adicionalSchema,
      piscina: adicionalSchema,
      gourmet: adicionalSchema,
      marcenaria: adicionalSchema,
      paisagismo: adicionalSchema,
      elevador: adicionalSchema,
      subsolo: adicionalSchema,
    }),
  })
  .superRefine((p, ctx) => {
    const fora = (caminho: (string | number)[], message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: caminho, message });

    if (Math.abs(soma(p.etapas.map((e) => e.percentual)) - 100) > 0.0001) {
      fora(["etapas"], "Os percentuais das etapas precisam somar 100");
    }
    if (Math.abs(soma(Object.values(p.natureza_base)) - 100) > 0.0001) {
      fora(["natureza_base"], "Os percentuais da natureza do custo precisam somar 100");
    }
    if (Math.abs(soma(Object.values(p.natureza_adicionais)) - 100) > 0.0001) {
      fora(["natureza_adicionais"], "Os percentuais da natureza dos adicionais precisam somar 100");
    }

    const ids = p.fases.map((f) => f.id);
    if (new Set(ids).size !== ids.length) fora(["fases"], "Id de fase repetido");
    p.fases.forEach((f, i) => {
      if (f.fim <= f.inicio) fora(["fases", i], "A fase precisa terminar depois de começar");
    });
    p.etapas.forEach((e, i) => {
      if (!ids.includes(e.fase)) fora(["etapas", i, "fase"], `A fase "${e.fase}" não existe`);
    });
    Object.entries(p.adicionais).forEach(([chave, a]) => {
      if (!ids.includes(a.fase)) fora(["adicionais", chave, "fase"], `A fase "${a.fase}" não existe`);
    });
  });
export type Parametros = z.infer<typeof parametrosSchema>;

/**
 * Ajuste da empresa sobre os adicionais de referência: só os campos que ela muda, por chave de adicional.
 * O motor mescla com a referência e revalida o resultado; ajuste inválido é ignorado com aviso.
 */
export const ajustesEmpresaSchema = z.object({
  adicionais: z.record(z.string(), z.record(z.string(), z.unknown())).default({}),
});
export type AjustesEmpresa = z.infer<typeof ajustesEmpresaSchema>;

// ── Resultado ────────────────────────────────────────────────────────────────

const CODIGOS_AVISO = [
  "mes_antigo",
  "uf_vizinha",
  "adicional_a_definir",
  "ajuste_ignorado",
  "parametros_nao_validados",
  "coerencia",
] as const;

export const resultadoSchema = z.object({
  versaoMotor: z.literal(1),
  provavel: z.number(),
  minimo: z.number(),
  maximo: z.number(),
  faixaPct: z.number(),
  porM2: z.number(),
  base: z.number(),
  subtotal: z.number(),
  taxaAdministracao: z.number(),
  admPct: z.number(),
  area: z.number(),
  padrao: z.enum(PADROES),
  subtipoNome: z.string(),
  fonte: z.object({
    texto: z.string(),
    uf: z.enum(UFS),
    cubCodigo: z.string(),
    padrao: z.enum([...PADROES, "unico"]),
    mesBase: z.string(),
    valorM2: z.number(),
    origem: z.enum(["uf", "uf_vizinha"]),
    mesAntigo: z.boolean(),
    // Estimativas salvas antes do regime existir usam a série clássica.
    regime: z.enum(REGIMES).default("onerado"),
  }),
  etapas: z.array(z.object({ id: z.string(), nome: z.string(), fase: z.string(), valor: z.number() })),
  adicionais: z.array(
    z.object({
      id: z.enum(ADICIONAIS_IDS),
      rotulo: z.string(),
      nota: z.string().nullable(),
      fase: z.string(),
      valor: z.number().nullable(),
      aDefinir: z.boolean(),
    })
  ),
  natureza: z.array(z.object({ id: z.string(), rotulo: z.string(), valor: z.number() })),
  fases: z.array(
    z.object({
      id: z.string(),
      nome: z.string(),
      valor: z.number(),
      inicioMes: z.number().int(),
      fimMes: z.number().int(),
      inicio: z.string(),
      fim: z.string(),
      etapas: z.array(
        z.object({
          nome: z.string(),
          inicio: z.string(),
          fim: z.string(),
          servicos: z.array(z.object({ nome: z.string(), inicio: z.string(), fim: z.string() })),
        })
      ),
    })
  ),
  desembolso: z.array(z.object({ mes: z.string().regex(/^\d{4}-\d{2}$/), valor: z.number() })),
  meses: z.number().int().positive(),
  horas: z.number(),
  equipe: z.number().int(),
  avisos: z.array(z.object({ codigo: z.enum(CODIGOS_AVISO), mensagem: z.string() })),
  parametrosValidados: z.boolean(),
});
export type ResultadoEstimativa = z.infer<typeof resultadoSchema>;
