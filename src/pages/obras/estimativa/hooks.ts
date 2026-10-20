// Dados da estimativa de obra (SPEC 136, BEZ-18). O que volta do banco como jsonb passa por schema antes
// de chegar à tela: ficha ou resultado fora do formato viram `null`, e a tela mostra o estado de erro.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json, TablesUpdate } from "@/integrations/supabase/types";
import { lerAjustes, lerCub, lerParametros } from "@/lib/estimativaObra";
import type {
  AjustesEmpresa,
  CubLinha,
  Ficha,
  Parametros,
  Premissas,
  ResultadoEstimativa,
} from "@/schemas/estimativaObra";
import { lerFichaDoBanco, lerPremissasDoBanco, lerResultadoDoBanco } from "./lib";

type StatusEstimativa = "rascunho" | "enviada" | "virou_obra";

export interface EstimativaResumo {
  id: string;
  nome: string;
  clienteNome: string | null;
  status: StatusEstimativa;
  versaoAtual: number;
  ficha: Ficha | null;
  resultado: ResultadoEstimativa | null;
  atualizadoEm: string;
}

export interface EstimativaCompleta extends EstimativaResumo {
  premissas: Premissas;
  obraId: string | null;
  criadoEm: string;
}

export interface VersaoEstimativa {
  id: string;
  versao: number;
  nota: string | null;
  resultado: ResultadoEstimativa | null;
  parametrosValidados: boolean;
  criadoEm: string;
}

const CHAVE = ["estimativas-obra"] as const;

const paraJson = (valor: unknown) => valor as Json;

async function empresaDoUsuario(): Promise<string> {
  const { data } = await supabase.rpc("get_user_empresa_id");
  if (!data) throw new Error("Usuário não vinculado a uma empresa");
  return data;
}

export function useEstimativas() {
  return useQuery({
    queryKey: CHAVE,
    queryFn: async (): Promise<EstimativaResumo[]> => {
      const { data, error } = await supabase
        .from("estimativas_obra")
        .select("id, nome, cliente_nome, status, versao_atual, ficha, resultado, updated_at")
        .order("updated_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []).map((l) => ({
        id: l.id,
        nome: l.nome,
        clienteNome: l.cliente_nome,
        status: l.status as StatusEstimativa,
        versaoAtual: l.versao_atual,
        ficha: lerFichaDoBanco(l.ficha),
        resultado: lerResultadoDoBanco(l.resultado),
        atualizadoEm: l.updated_at,
      }));
    },
    staleTime: 30_000,
  });
}

export function useEstimativa(id: string | undefined) {
  return useQuery({
    queryKey: [...CHAVE, id],
    enabled: !!id,
    queryFn: async (): Promise<EstimativaCompleta | null> => {
      const { data, error } = await supabase.from("estimativas_obra").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        id: data.id,
        nome: data.nome,
        clienteNome: data.cliente_nome,
        status: data.status as StatusEstimativa,
        versaoAtual: data.versao_atual,
        ficha: lerFichaDoBanco(data.ficha),
        premissas: lerPremissasDoBanco(data.premissas),
        resultado: lerResultadoDoBanco(data.resultado),
        obraId: data.obra_id,
        criadoEm: data.created_at,
        atualizadoEm: data.updated_at,
      };
    },
  });
}

export interface NovaEstimativa {
  nome: string;
  clienteNome: string | null;
  ficha: Ficha;
  premissas: Premissas;
  resultado: ResultadoEstimativa | null;
}

export function useCriarEstimativa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (nova: NovaEstimativa): Promise<string> => {
      const { data, error } = await supabase
        .from("estimativas_obra")
        .insert({
          empresa_id: await empresaDoUsuario(),
          nome: nova.nome,
          cliente_nome: nova.clienteNome,
          ficha: paraJson(nova.ficha),
          premissas: paraJson(nova.premissas),
          resultado: paraJson(nova.resultado),
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE }),
  });
}

export interface AlteracaoEstimativa {
  nome?: string;
  clienteNome?: string | null;
  ficha?: Ficha;
  premissas?: Premissas;
  resultado?: ResultadoEstimativa | null;
}

export function useAtualizarEstimativa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...mudanca }: AlteracaoEstimativa & { id: string }): Promise<void> => {
      const patch: TablesUpdate<"estimativas_obra"> = {};
      if (mudanca.nome !== undefined) patch.nome = mudanca.nome;
      if (mudanca.clienteNome !== undefined) patch.cliente_nome = mudanca.clienteNome;
      if (mudanca.ficha !== undefined) patch.ficha = paraJson(mudanca.ficha);
      if (mudanca.premissas !== undefined) patch.premissas = paraJson(mudanca.premissas);
      if (mudanca.resultado !== undefined) patch.resultado = paraJson(mudanca.resultado);
      const { data, error } = await supabase.from("estimativas_obra").update(patch).eq("id", id).select("id");
      if (error) throw error;
      // A RLS não dá erro quando recusa: devolve zero linhas.
      if (!data || data.length === 0) throw new Error("Não foi possível salvar a estimativa");
    },
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: CHAVE });
      void qc.invalidateQueries({ queryKey: [...CHAVE, v.id] });
    },
  });
}

export function useExcluirEstimativa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from("estimativas_obra").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE }),
  });
}

export function useVersoes(estimativaId: string | undefined) {
  return useQuery({
    queryKey: [...CHAVE, estimativaId, "versoes"],
    enabled: !!estimativaId,
    queryFn: async (): Promise<VersaoEstimativa[]> => {
      const { data, error } = await supabase
        .from("estimativa_obra_versoes")
        .select("id, versao, nota, resultado, parametros_validados, created_at")
        .eq("estimativa_id", estimativaId!)
        .order("versao", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((v) => ({
        id: v.id,
        versao: v.versao,
        nota: v.nota,
        resultado: lerResultadoDoBanco(v.resultado),
        parametrosValidados: v.parametros_validados,
        criadoEm: v.created_at,
      }));
    },
  });
}

export interface NovaVersao {
  estimativaId: string;
  nota: string | null;
  ficha: Ficha;
  premissas: Premissas;
  resultado: ResultadoEstimativa;
}

/** Grava o snapshot imutável. O número da versão quem dá é o banco. */
export function useSalvarVersao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: NovaVersao): Promise<void> => {
      const { error } = await supabase.from("estimativa_obra_versoes").insert({
        empresa_id: await empresaDoUsuario(),
        estimativa_id: v.estimativaId,
        nota: v.nota,
        ficha: paraJson(v.ficha),
        premissas: paraJson(v.premissas),
        resultado: paraJson(v.resultado),
        parametros_validados: v.resultado.parametrosValidados,
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: [...CHAVE, v.estimativaId] });
      void qc.invalidateQueries({ queryKey: CHAVE });
    },
  });
}

// ── Insumos do cálculo: CUB, parâmetros e ajustes da empresa ─────────────────

export type Insumos =
  | { estado: "carregando" }
  | { estado: "erro"; mensagem: string }
  | { estado: "ok"; cub: CubLinha[]; parametros: Parametros; ajustes: AjustesEmpresa | null; validado: boolean };

/** Tudo que o motor precisa além da ficha. Um erro em qualquer parte vira um erro só, com a causa. */
export function useInsumosDaEstimativa(): Insumos {
  const cub = useQuery({
    queryKey: ["estimativa-cub"],
    queryFn: async (): Promise<CubLinha[]> => {
      const { data, error } = await supabase
        .from("cub_valores")
        .select("uf, subtipo, padrao, mes_base, valor_m2, regime")
        .order("mes_base", { ascending: false })
        .limit(10_000);
      if (error) throw error;
      const lido = lerCub(data ?? []);
      if (!lido.ok) throw new Error(lido.mensagem);
      return lido.valor;
    },
    staleTime: 5 * 60_000,
  });

  const parametros = useQuery({
    queryKey: ["estimativa-parametros"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estimativa_parametros")
        .select("parametros, validado_em")
        .eq("id", "default")
        .single();
      if (error) throw error;
      const lido = lerParametros(data.parametros);
      if (!lido.ok) throw new Error(lido.mensagem);
      return { parametros: lido.parametros, validado: data.validado_em !== null };
    },
    staleTime: 5 * 60_000,
  });

  const ajustes = useQuery({
    queryKey: ["estimativa-ajustes"],
    queryFn: async (): Promise<AjustesEmpresa | null> => {
      const { data, error } = await supabase.from("estimativa_ajustes_empresa").select("adicionais").maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const lido = lerAjustes({ adicionais: data.adicionais });
      if (!lido.ok) throw new Error(lido.mensagem);
      return lido.valor;
    },
    staleTime: 5 * 60_000,
  });

  const erro = cub.error ?? parametros.error ?? ajustes.error;
  if (erro) return { estado: "erro", mensagem: erro instanceof Error ? erro.message : "Falha ao carregar" };
  if (!cub.data || !parametros.data || ajustes.data === undefined) return { estado: "carregando" };
  return {
    estado: "ok",
    cub: cub.data,
    parametros: parametros.data.parametros,
    ajustes: ajustes.data,
    validado: parametros.data.validado,
  };
}
