// Estimativa de obra no Ultra admin (SPEC 136, BEZ-13): CUB mensal e parâmetros do motor.
// Escrita direta nas tabelas globais: a RLS só deixa o ultra admin com o segundo fator gravar.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { lerParametros } from "@/lib/estimativaObra";
import { lerCsv, type LinhaCubLida, type LinhaGravada } from "./estimativaCubImport";
import type { AbaSinapi, LinhaSinapiGravada, LinhaSinapiLida } from "./estimativaSinapiImport";
import { REGIMES, UFS, type Parametros, type Regime, type Uf } from "@/schemas/estimativaObra";

const TAMANHO_LOTE = 500;
const TAMANHO_MAXIMO_ARQUIVO = 5_000_000;
// O relatório de referência do SINAPI tem cerca de 13 MB: a maior parte são abas de composição que não lemos.
const TAMANHO_MAXIMO_SINAPI = 30_000_000;

/** Tudo que já foi importado (uma linha por UF, subtipo, padrão, mês e regime). Cada mês tem até uns 700 (dois regimes), então 10 mil cobrem cerca de 14 meses. */
export function useCubGravado() {
  return useQuery({
    queryKey: ["ultra-admin", "estimativa", "cub"],
    queryFn: async (): Promise<LinhaGravada[]> => {
      const { data, error } = await supabase
        .from("cub_valores")
        .select("uf, subtipo, padrao, mes_base, regime, created_at")
        .order("mes_base", { ascending: false })
        .limit(10_000);
      if (error) throw error;
      return (data ?? []).map((l) => {
        // Regime desconhecido é dado fora do contrato: falha claro em vez de sumir do resumo.
        if (!(REGIMES as readonly string[]).includes(l.regime))
          throw new Error(`Regime de CUB desconhecido: ${l.regime}`);
        return { ...l, regime: l.regime as Regime };
      });
    },
    staleTime: 60_000,
  });
}

/**
 * Grava as linhas do CUB em lotes, com upsert por UF, subtipo, padrão, mês e regime: importar o mesmo mês
 * e regime de novo corrige os valores deles. Se um lote falhar no meio, importar de novo conserta.
 */
export async function gravarCub(linhas: LinhaCubLida[], fonte: string): Promise<void> {
  for (let i = 0; i < linhas.length; i += TAMANHO_LOTE) {
    const lote = linhas.slice(i, i + TAMANHO_LOTE).map((l) => ({
      uf: l.uf,
      subtipo: l.subtipo,
      padrao: l.padrao,
      mes_base: l.mes_base,
      regime: l.regime,
      valor_m2: l.valor_m2,
      fonte,
    }));
    const { data, error } = await supabase
      .from("cub_valores")
      .upsert(lote, { onConflict: "uf,subtipo,padrao,mes_base,regime" })
      .select("id");
    if (error) throw error;
    // A RLS não devolve erro quando recusa: devolve menos linhas.
    if ((data?.length ?? 0) < lote.length) {
      throw new Error("O banco não aceitou todas as linhas. Confirme o segundo fator da sua sessão e importe de novo.");
    }
  }
}

/** Lê o arquivo escolhido (Excel ou CSV) em linhas de células de texto. O SheetJS só carrega quando precisa. */
export async function lerCelulas(arquivo: File): Promise<string[][]> {
  if (arquivo.size > TAMANHO_MAXIMO_ARQUIVO) throw new Error("O arquivo passa de 5 MB. Envie só a tabela do mês.");
  const extensao = arquivo.name.split(".").pop()?.toLowerCase() ?? "";
  if (extensao === "xlsx" || extensao === "xls") {
    const XLSX = await import("xlsx");
    const livro = XLSX.read(await arquivo.arrayBuffer(), { type: "array" });
    const aba = livro.SheetNames[0];
    if (!aba) throw new Error("A planilha não tem abas legíveis.");
    const linhas = XLSX.utils.sheet_to_json<unknown[]>(livro.Sheets[aba], { header: 1, raw: true, defval: "" });
    // Número vira texto com no máximo 2 casas: evita 3350.4999999 e deixa o leitor decidir o formato.
    return linhas.map((linha) =>
      linha.map((c) => (typeof c === "number" ? String(Math.round(c * 100) / 100) : String(c ?? "")))
    );
  }
  if (extensao === "csv" || extensao === "txt") return lerCsv(await arquivo.text());
  throw new Error("Formato não suportado. Envie um arquivo .xlsx ou .csv.");
}

export interface ParametrosGravados {
  parametros: Parametros;
  validadoEm: string | null;
  atualizadoEm: string;
}

export function useParametrosEstimativa() {
  return useQuery({
    queryKey: ["ultra-admin", "estimativa", "parametros"],
    queryFn: async (): Promise<ParametrosGravados> => {
      const { data, error } = await supabase
        .from("estimativa_parametros")
        .select("parametros, validado_em, updated_at")
        .eq("id", "default")
        .single();
      if (error) throw error;
      const lido = lerParametros(data.parametros);
      if (!lido.ok) throw new Error(lido.mensagem);
      return { parametros: lido.parametros, validadoEm: data.validado_em, atualizadoEm: data.updated_at };
    },
    staleTime: 60_000,
  });
}

/** Marca (ou desfaz) a validação dos parâmetros. Quem validou o banco grava sozinho. */
export async function validarParametros(validar: boolean): Promise<void> {
  const { data, error } = await supabase
    .from("estimativa_parametros")
    .update({
      validado_em: validar ? new Date().toISOString() : null,
      ...(validar ? {} : { validado_por: null }),
    })
    .eq("id", "default")
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new Error("O banco não aceitou a alteração. Confirme o segundo fator da sua sessão e tente de novo.");
  }
}

/** Preços de insumo do SINAPI já importados, uma linha por código, UF, regime e mês. Só os códigos do catálogo entram, então são poucos milhares. */
export function useSinapiGravado() {
  return useQuery({
    queryKey: ["ultra-admin", "estimativa", "sinapi"],
    queryFn: async (): Promise<LinhaSinapiGravada[]> => {
      const { data, error } = await supabase
        .from("sinapi_precos_insumo")
        .select("codigo, uf, regime, mes_base, created_at")
        .order("mes_base", { ascending: false })
        .limit(20_000);
      if (error) throw error;
      return (data ?? []).map((l) => {
        if (!(REGIMES as readonly string[]).includes(l.regime))
          throw new Error(`Regime do SINAPI desconhecido: ${l.regime}`);
        if (!(UFS as readonly string[]).includes(l.uf)) throw new Error(`UF do SINAPI desconhecida: ${l.uf}`);
        return { ...l, regime: l.regime as Regime, uf: l.uf as Uf };
      });
    },
    staleTime: 60_000,
  });
}

/**
 * Grava os preços do SINAPI em lotes, com upsert por código, UF, regime e mês: importar o mesmo mês de novo
 * corrige os valores. Se um lote falhar no meio, importar de novo conserta.
 */
export async function gravarSinapi(linhas: LinhaSinapiLida[], fonte: string): Promise<void> {
  for (let i = 0; i < linhas.length; i += TAMANHO_LOTE) {
    const lote = linhas.slice(i, i + TAMANHO_LOTE).map((l) => ({ ...l, fonte }));
    const { data, error } = await supabase
      .from("sinapi_precos_insumo")
      .upsert(lote, { onConflict: "codigo,uf,regime,mes_base" })
      .select("codigo");
    if (error) throw error;
    // A RLS não devolve erro quando recusa: devolve menos linhas.
    if ((data?.length ?? 0) < lote.length) {
      throw new Error("O banco não aceitou todas as linhas. Confirme o segundo fator da sua sessão e importe de novo.");
    }
  }
}

/** Lê só as abas de preço de insumo (ISD e ICD) do relatório do SINAPI. O SheetJS só carrega quando precisa. */
export async function lerAbasSinapi(arquivo: File): Promise<AbaSinapi[]> {
  if (arquivo.size > TAMANHO_MAXIMO_SINAPI)
    throw new Error("O arquivo passa de 30 MB. Envie o SINAPI_Referência do mês.");
  if (!arquivo.name.toLowerCase().endsWith(".xlsx")) {
    throw new Error(
      "Formato não suportado. Envie o arquivo .xlsx SINAPI_Referência, que sai de dentro do zip da Caixa."
    );
  }
  const XLSX = await import("xlsx");
  const livro = XLSX.read(await arquivo.arrayBuffer(), { type: "array", sheets: ["ISD", "ICD"] });
  return ["ISD", "ICD"].flatMap((nome) => {
    const aba = livro.Sheets[nome];
    if (!aba) return [];
    return [{ nome, celulas: XLSX.utils.sheet_to_json<unknown[]>(aba, { header: 1, raw: true, defval: "" }) }];
  });
}
