// Fórmula da folha num só lugar:
//   variável = área × valor/m² + valor dos projetos × percentual / 100
//   total    = fixo + variável
// Antes esse cálculo estava duplicado (preview, edição, comprovante), o que
// deixou a edição salvar total inconsistente. Centralizado e testável. A mesma
// fórmula roda no banco (get_folha_preview); mudar aqui é mudar lá.
import type { FolhaItem, ProjetoDetalhe } from "./types";

/** Parte do variável que vem do percentual: valor × percentual / 100. */
export function calcularComissao(valorBase: number, percentual: number): number {
  return ((valorBase || 0) * (percentual || 0)) / 100;
}

export function calcularVariavel(area: number, valorM2: number, valorBase = 0, percentual = 0): number {
  return (area || 0) * (valorM2 || 0) + calcularComissao(valorBase, percentual);
}

export function calcularTotal(salarioFixo: number, variavel: number): number {
  return (salarioFixo || 0) + (variavel || 0);
}

// Subtotal do variável de um projeto no comprovante: m² do projeto × valor/m²
// da pessoa + valor do projeto × percentual da pessoa.
export function subtotalProjeto(projeto: ProjetoDetalhe, valorM2: number, percentual = 0): number {
  return calcularVariavel(projeto.area_m2, valorM2, projeto.valor_base ?? 0, percentual);
}

// chaves_pix é Json (array, objeto ou string). Extrai a primeira chave utilizável.
export function firstPix(raw: unknown): string | null {
  if (!raw) return null;
  if (typeof raw === "string") return raw || null;
  if (Array.isArray(raw)) {
    // Formato gravado pelo cadastro de pessoas: [{ chave, tipo }]. Sem este caso
    // a folha e o comprovante saíam sem PIX para todo mundo.
    for (const v of raw) {
      if (typeof v === "string" && v) return v;
      if (v && typeof v === "object" && typeof (v as { chave?: unknown }).chave === "string") {
        const chave = (v as { chave: string }).chave;
        if (chave) return chave;
      }
    }
    return null;
  }
  if (typeof raw === "object") {
    const first = Object.values(raw as Record<string, unknown>).find((v) => typeof v === "string" && v);
    return (first as string) ?? null;
  }
  return null;
}

export function parseDetalhe(raw: unknown): ProjetoDetalhe[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((p): p is Record<string, unknown> => !!p && typeof p === "object")
    .map((p) => ({
      nome: String(p.nome ?? "-"),
      area_m2: Number(p.area_m2 ?? 0),
      ...(p.valor_base != null ? { valor_base: Number(p.valor_base) } : {}),
    }));
}

// Registro gravado em folha_pagamento (folha fechada ou histórico) → linha da tela.
export interface RegistroFolha {
  id: string;
  pessoa_id: string | null;
  salario_fixo: number | null;
  valor_m2: number | null;
  percentual_producao?: number | null;
  total_area_projetada: number | null;
  total_valor_base?: number | null;
  adicional_variavel: number | null;
  total_receber: number | null;
  detalhe_projetos?: unknown;
  status: string | null;
  data_pagamento: string | null;
}

export function folhaItemDeRegistro(
  item: RegistroFolha,
  pessoa?: { nome?: string | null; cargo?: string | null }
): FolhaItem {
  const salario_fixo = Number(item.salario_fixo ?? 0);
  const valor_m2 = Number(item.valor_m2 ?? 0);
  const percentual = Number(item.percentual_producao ?? 0);
  const soma_area = Number(item.total_area_projetada ?? 0);
  const soma_valor_base = Number(item.total_valor_base ?? 0);
  const v_variavel = Number(
    item.adicional_variavel ?? calcularVariavel(soma_area, valor_m2, soma_valor_base, percentual)
  );
  const v_total = Number(item.total_receber ?? calcularTotal(salario_fixo, v_variavel));
  return {
    p_id: item.pessoa_id ?? "",
    p_nome: pessoa?.nome || "Desconhecido",
    p_cargo: pessoa?.cargo || "-",
    p_cpf: null,
    p_chave_pix: null,
    p_salario_fixo: salario_fixo,
    p_valor_m2: valor_m2,
    p_percentual: percentual,
    soma_area,
    soma_valor_base,
    v_variavel,
    v_total,
    lista_projetos: [],
    detalhe_projetos: parseDetalhe(item.detalhe_projetos),
    status: item.status ?? undefined,
    data_pagamento: item.data_pagamento ?? undefined,
    folha_id: item.id,
    edited_fields: [],
  };
}
