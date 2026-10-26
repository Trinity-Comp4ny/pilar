// Tabela de preços da empresa (SPEC 137, BEZ-14): quais campos cada item aceita, como o valor da empresa vira
// ajuste e como o ajuste é validado. Funções puras. O ajuste guarda só o que a empresa muda, no mesmo formato dos
// parâmetros (ver `mesclarAjustes`), e o motor revalida ao calcular: ajuste inválido é ignorado com aviso.
import { descreverAdicional } from "@/lib/estimativaObra";
import {
  ADICIONAIS_IDS,
  REGISTRO_DO_AJUSTE,
  adicionalSchema,
  type Adicional,
  type AdicionalId,
  type Parametros,
} from "@/schemas/estimativaObra";

export type TipoDeCampo = "reais" | "percentual";

export interface CampoDePreco {
  /** Caminho no ajuste: "valor", "valor_unitario" ou "valores.<chave>". */
  caminho: string;
  rotulo: string;
  tipo: TipoDeCampo;
}

export type Ajuste = Record<string, unknown>;

const PADROES = [
  ["baixo", "Padrão baixo"],
  ["normal", "Padrão médio"],
  ["alto", "Padrão alto"],
] as const;

const NIVEIS = [
  ["basica", "Marcenaria básica"],
  ["completa", "Marcenaria completa"],
] as const;

/** Unidade em que o preço do item é dado, para a coluna da tabela. */
export function unidadeDoPreco(a: Adicional): string {
  switch (a.tipo) {
    case "percentual_base":
    case "percentual_base_por_nivel":
      return "% da base";
    case "por_m2":
      return "m²";
    case "por_m2_area_livre":
      return "m² de área livre";
    case "por_m2_arrimo":
      return "m² de parede";
    case "por_padrao":
    case "valor_fixo":
      return "unidade";
    case "a_definir":
      return a.unidade === "un" ? "unidade" : (a.unidade ?? "item");
  }
}

/** Campos que a empresa pode preencher para o item. */
export function camposDoItem(a: Adicional): CampoDePreco[] {
  switch (a.tipo) {
    case "percentual_base":
      return [{ caminho: "valor", rotulo: "Percentual da base", tipo: "percentual" }];
    case "por_m2":
    case "por_m2_area_livre":
    case "por_m2_arrimo":
      return [{ caminho: "valor", rotulo: `Valor por ${unidadeDoPreco(a)}`, tipo: "reais" }];
    case "valor_fixo":
      return [{ caminho: "valor", rotulo: "Valor", tipo: "reais" }];
    case "por_padrao":
      return PADROES.map(([chave, rotulo]) => ({ caminho: `valores.${chave}`, rotulo, tipo: "reais" as const }));
    case "percentual_base_por_nivel":
      return NIVEIS.map(([chave, rotulo]) => ({
        caminho: `valores.${chave}`,
        rotulo: `${rotulo} (% da base)`,
        tipo: "percentual" as const,
      }));
    case "a_definir":
      return [{ caminho: "valor_unitario", rotulo: `Valor por ${unidadeDoPreco(a)}`, tipo: "reais" }];
  }
}

function lerCaminho(fonte: Record<string, unknown> | undefined, caminho: string): number | undefined {
  if (!fonte) return undefined;
  const [raiz, filho] = caminho.split(".");
  const no = fonte[raiz];
  const bruto = filho ? (no && typeof no === "object" ? (no as Record<string, unknown>)[filho] : undefined) : no;
  return typeof bruto === "number" && Number.isFinite(bruto) ? bruto : undefined;
}

/** Valor do campo na referência do Pilar (o item sem preço, como `a_definir`, não tem). */
export function valorDaReferencia(a: Adicional, campo: CampoDePreco): number | undefined {
  return lerCaminho(a as unknown as Record<string, unknown>, campo.caminho);
}

/** Valor que a empresa já definiu para o campo. */
export function valorDaEmpresa(ajuste: Ajuste | undefined, campo: CampoDePreco): number | undefined {
  return lerCaminho(ajuste, campo.caminho);
}

export interface Registro {
  observacao?: string;
  atualizadoEm: string;
  atualizadoPor: string;
}

/**
 * Ajuste novo a partir dos valores digitados. Grupo de valores (`valores`) sai completo, partindo da referência:
 * o motor troca o grupo inteiro, então um grupo pela metade seria recusado.
 */
export function montarAjuste(a: Adicional, valores: Record<string, number>, registro: Registro): Ajuste {
  const ajuste: Ajuste = {};
  const grupo: Record<string, number> = {};
  for (const campo of camposDoItem(a)) {
    const [raiz, filho] = campo.caminho.split(".");
    if (!filho) {
      const v = valores[campo.caminho];
      if (v !== undefined) ajuste[raiz] = v;
      continue;
    }
    const base = valorDaReferencia(a, campo);
    const v = valores[campo.caminho] ?? base;
    if (v !== undefined) grupo[filho] = v;
  }
  if (Object.keys(grupo).length > 0) ajuste.valores = grupo;
  if (registro.observacao) ajuste.observacao = registro.observacao;
  ajuste.atualizado_em = registro.atualizadoEm;
  ajuste.atualizado_por = registro.atualizadoPor;
  return ajuste;
}

/**
 * Mensagem de erro do ajuste, ou null se o motor o aceita. Usa o mesmo schema do cálculo, então o que passa aqui
 * não é ignorado depois.
 */
export function erroDoAjuste(a: Adicional, ajuste: Ajuste): string | null {
  const vu = ajuste.valor_unitario;
  if (vu !== undefined && !(typeof vu === "number" && Number.isFinite(vu) && vu > 0)) {
    return "Informe um valor maior que zero";
  }
  const valores = Object.entries(ajuste).filter(
    ([k]) => k !== "valor_unitario" && !(REGISTRO_DO_AJUSTE as readonly string[]).includes(k)
  );
  if (valores.length === 0 && vu === undefined) return "Informe pelo menos um valor";
  const mesclado = adicionalSchema.safeParse({
    ...a,
    ...Object.fromEntries(valores),
    tipo: a.tipo,
    fase: a.fase,
  });
  return mesclado.success ? null : "Confira os valores: percentual vai de 0 a 100 e dinheiro não pode ser negativo";
}

/** Itens da tabela, na ordem do catálogo. Fica de fora o que o CUB já cobre e o que os parâmetros ainda não têm. */
export function itensDaTabela(parametros: Parametros): { id: AdicionalId; adicional: Adicional }[] {
  return ADICIONAIS_IDS.flatMap((id) => {
    const adicional = parametros.adicionais[id];
    return adicional && adicional.escopo !== "dentro_do_cub" ? [{ id, adicional }] : [];
  });
}

/** De onde vem o valor de referência do item, para a coluna "Referência" (a empresa ainda não mexeu). */
export function referenciaDoItem(a: Adicional): { tipo: "sinapi" | "referencia_pilar" | "a_definir"; texto: string } {
  if (a.sinapi) return { tipo: "sinapi", texto: `insumo ${a.sinapi.codigo}, preço por UF e mês` };
  if (a.tipo === "a_definir") return { tipo: "a_definir", texto: "sem referência" };
  return { tipo: "referencia_pilar", texto: descreverAdicional(a) };
}
