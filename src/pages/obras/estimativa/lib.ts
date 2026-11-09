// Estimativa de obra no módulo Obras (SPEC 136, BEZ-18): rótulos, validação por passo e leitura segura do
// que volta do banco. Funções puras, sem React nem I/O.
import { rotuloMesBase, rotuloPadrao } from "@/lib/estimativaObra";
import {
  UFS,
  fichaSchema,
  premissasSchema,
  resultadoSchema,
  type Ficha,
  type Padrao,
  type Premissas,
  type ResultadoEstimativa,
  type TipoObra,
  type Uf,
} from "@/schemas/estimativaObra";

export const TIPO_INFO: Record<TipoObra, { nome: string; descricao: string }> = {
  residencial: { nome: "Residencial", descricao: "Casa, sobrado ou edifício de apartamentos" },
  comercial: { nome: "Comercial", descricao: "Salas, lojas ou andares corridos" },
  industrial: { nome: "Industrial", descricao: "Galpão industrial ou logístico" },
};

export const PADRAO_INFO: Record<Padrao, { nome: string; exemplo: string }> = {
  baixo: { nome: "Baixo", exemplo: "Cerâmica simples, esquadria de alumínio comum, louça básica" },
  normal: {
    nome: "Médio",
    exemplo: "Porcelanato, esquadria de alumínio de linha média, metais cromados. É o padrão normal do CUB",
  },
  alto: { nome: "Alto", exemplo: "Porcelanato de grande formato, esquadria com vidro duplo, automação" },
};

export const UF_NOME: Record<Uf, string> = {
  AC: "Acre",
  AL: "Alagoas",
  AP: "Amapá",
  AM: "Amazonas",
  BA: "Bahia",
  CE: "Ceará",
  DF: "Distrito Federal",
  ES: "Espírito Santo",
  GO: "Goiás",
  MA: "Maranhão",
  MT: "Mato Grosso",
  MS: "Mato Grosso do Sul",
  MG: "Minas Gerais",
  PA: "Pará",
  PB: "Paraíba",
  PR: "Paraná",
  PE: "Pernambuco",
  PI: "Piauí",
  RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul",
  RO: "Rondônia",
  RR: "Roraima",
  SC: "Santa Catarina",
  SP: "São Paulo",
  SE: "Sergipe",
  TO: "Tocantins",
};

export const UFS_ORDENADAS: readonly Uf[] = [...UFS].sort((a, b) => UF_NOME[a].localeCompare(UF_NOME[b], "pt-BR"));

export const PASSOS = ["tipo", "local", "programa", "revisao"] as const;
export type Passo = (typeof PASSOS)[number];

export const PASSO_ROTULO: Record<Passo, string> = {
  tipo: "Tipo de obra",
  local: "Local e tamanho",
  programa: "O que a obra tem",
  revisao: "Revisão",
};

const CAMPOS_DO_PASSO: Record<Passo, readonly (keyof Ficha)[]> = {
  tipo: ["tipo", "subtipo", "padrao"],
  local: ["uf", "area", "pavimentos", "terreno", "inicio"],
  programa: [
    "quartos",
    "suites",
    "banheiros",
    "lavabo",
    "vagas",
    "piscina",
    "gourmet",
    "elevador",
    "subsolo",
    "paisagismo",
    "marcenaria",
    "topografia",
    "arrimo",
    "itens",
  ],
  revisao: [],
};

export type ErrosDaFicha = Partial<Record<keyof Ficha, string>>;

/** Primeiro erro de cada campo da ficha, na linguagem da tela. Ficha válida devolve `{}`. */
export function errosDaFicha(ficha: unknown): ErrosDaFicha {
  const lida = fichaSchema.safeParse(ficha);
  if (lida.success) return {};
  const erros: ErrosDaFicha = {};
  for (const issue of lida.error.issues) {
    const campo = issue.path[0] as keyof Ficha | undefined;
    if (campo && !(campo in erros)) erros[campo] = issue.message;
  }
  return erros;
}

/** Só os erros que pertencem ao passo: o usuário não vê erro de um passo que ainda não preencheu. */
export function errosDoPasso(passo: Passo, ficha: unknown): ErrosDaFicha {
  const todos = errosDaFicha(ficha);
  const doPasso: ErrosDaFicha = {};
  for (const campo of CAMPOS_DO_PASSO[passo]) {
    if (campo in todos) doPasso[campo] = todos[campo];
  }
  return doPasso;
}

/** `AAAA-MM` do mês atual para frente. */
export function proximosMeses(hoje: Date, quantos = 24): { valor: string; rotulo: string }[] {
  return Array.from({ length: quantos }, (_, i) => {
    const d = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + i, 1));
    const valor = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    return { valor, rotulo: rotuloMes(valor) };
  });
}

/** O mês seguinte ao de hoje: quase ninguém começa obra no mês em que pede a estimativa. */
export function mesPadraoDeInicio(hoje: Date): string {
  return proximosMeses(hoje, 2)[1].valor;
}

/** `2027-03` → `mar/2027`. */
export function rotuloMes(anoMes: string): string {
  return rotuloMesBase(`${anoMes}-01`);
}

export function resumoDaFicha(ficha: Ficha, subtipoNome: string): string {
  return `${subtipoNome} · padrão ${rotuloPadrao(ficha.padrao)} · ${ficha.area.toLocaleString("pt-BR")} m² · ${ficha.uf}`;
}

// Leitura do que vem do banco (jsonb): falha vira null, e a tela mostra um estado de erro em vez de quebrar.

export function lerFichaDoBanco(bruto: unknown): Ficha | null {
  const lida = fichaSchema.safeParse(bruto);
  return lida.success ? lida.data : null;
}

export function lerPremissasDoBanco(bruto: unknown): Premissas {
  const lida = premissasSchema.safeParse(bruto);
  return lida.success ? lida.data : {};
}

export function lerResultadoDoBanco(bruto: unknown): ResultadoEstimativa | null {
  const lida = resultadoSchema.safeParse(bruto);
  return lida.success ? lida.data : null;
}

export interface DiferencaDeCenario {
  /** Custo do cenário menos o do atual, em reais. Negativo = mais barato. */
  custo: number;
  /** Mesma diferença em % do atual. */
  custoPct: number;
  /** Meses do cenário menos os do atual. Negativo = mais curto. */
  meses: number;
}

/** Quanto muda o custo e o prazo ao trocar do cenário atual para o outro. */
export function compararCenarios(atual: ResultadoEstimativa, outro: ResultadoEstimativa): DiferencaDeCenario {
  const custo = Math.round((outro.provavel - atual.provavel) * 100) / 100;
  return {
    custo,
    custoPct: atual.provavel > 0 ? (custo / atual.provavel) * 100 : 0,
    meses: outro.meses - atual.meses,
  };
}

/** Frase da comparação: "Trocar para o padrão normal economiza R$ 1.000 (3,1%) e encurta a obra em 1 mês." */
export function fraseDoCenario(
  padraoOutro: Padrao,
  d: DiferencaDeCenario,
  formatarReais: (v: number) => string
): string {
  const custo =
    d.custo === 0
      ? "não muda o custo"
      : `${d.custo < 0 ? "economiza" : "acrescenta"} ${formatarReais(Math.abs(d.custo))} (${Math.abs(d.custoPct).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%)`;
  const meses = Math.abs(d.meses);
  const prazo =
    d.meses === 0
      ? "e mantém o prazo"
      : `e ${d.meses < 0 ? "encurta" : "alonga"} a obra em ${meses} ${meses === 1 ? "mês" : "meses"}`;
  return `Trocar para o padrão ${padraoOutro} ${custo} ${prazo}.`;
}

/** "1.250,5" não é número para o `Number`: aceita vírgula decimal, e vazio vira NaN para a validação pedir o valor. */
export function lerNumero(texto: string): number {
  const t = texto.trim().replace(",", ".");
  return t === "" ? Number.NaN : Number(t);
}
