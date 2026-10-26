// Frase que diz, na linguagem da tela, de onde vem o preço de um item do catálogo (SPEC 137). Usa a mesma
// resolução do cálculo (`previaDoItem`), então a lista de itens e a leitura da IA mostram a mesma origem.
import { previaDoItem } from "@/lib/estimativaItens";
import { descreverAdicional } from "@/lib/estimativaObra";
import { formatCurrency } from "@/lib/format";
import type { AdicionalId, Ficha, Parametros, Premissas } from "@/schemas/estimativaObra";
import type { Insumos } from "./hooks";
import type { ItemDoCatalogo } from "./itensCatalogo";

type InsumosProntos = Extract<Insumos, { estado: "ok" }>;

const reais0 = (v: number) => formatCurrency(v, { decimals: 0 });

export interface Contexto {
  ficha: Ficha;
  parametros: Parametros;
  insumos: InsumosProntos;
  premissas: Premissas;
}

/** Frase que diz de onde vem o preço do item, na linguagem da tela. */
export function textoDaOrigem(
  id: AdicionalId,
  item: ItemDoCatalogo,
  { ficha, parametros, insumos, premissas }: Contexto
) {
  const previa = previaDoItem(id, {
    ficha,
    parametros,
    ajustes: insumos.ajustes,
    premissas,
    precosSinapi: insumos.precosSinapi,
  });
  if (!previa) return null;
  const por = item.porUnidade ? ` por ${item.porUnidade}` : "";
  const preco = previa.valorUnitario !== null ? `${reais0(previa.valorUnitario)}${por}` : null;
  const adicional = parametros.adicionais[id];
  switch (previa.origem.tipo) {
    case "sinapi":
      return { tipo: previa.origem.tipo, texto: preco ?? "preço do SINAPI" };
    case "empresa":
      return { tipo: previa.origem.tipo, texto: preco ?? "valor da tabela de preços da empresa" };
    case "usuario":
      return { tipo: previa.origem.tipo, texto: "valor informado por você" };
    case "referencia_pilar":
      return { tipo: previa.origem.tipo, texto: adicional ? descreverAdicional(adicional) : "sem fonte pública" };
    case "a_definir":
      return {
        tipo: previa.origem.tipo,
        texto: adicional?.sinapi
          ? `Sem preço do SINAPI em ${ficha.uf}: você informa`
          : "Sem preço de referência: você informa",
      };
  }
}
