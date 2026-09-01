import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toPrioridade, type Prioridade, type StatusBucket } from "./status";
import type { LinkItem } from "@/components/LinksEditor";
import type { Json, TablesUpdate } from "@/integrations/supabase/types";

export type PessoaOpcao = { id: string; nome: string; avatarUrl?: string | null };

/** Comentário estruturado da tarefa (spec 013). */
export type Comentario = { id: string; texto: string; autor: string; data: string };

export type DisciplinaItem = {
  id: string;
  titulo: string;
  status_bucket: StatusBucket;
  status_raw: string | null;
  prioridade: Prioridade;
  prazo: string | null;
  projeto_id: string;
  projeto_nome: string;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  labels: string[];
  links: LinkItem[];
};

export type TarefaItem = {
  id: string;
  /** Número curto sequencial por empresa (estilo "#42"), para identificar/buscar. */
  numero: number;
  titulo: string;
  descricao: string | null;
  status: StatusBucket;
  prioridade: Prioridade;
  /** Primário (o primeiro responsável), mantido para compat/otimista. */
  responsavel_id: string | null;
  /** Conjunto de responsáveis (tabela ponte tarefa_responsaveis). */
  responsaveis: PessoaOpcao[];
  projeto_id: string | null;
  etapa_id: string | null;
  prazo: string | null;
  horas_estimadas: number | null;
  horas_reais: number | null;
  labels: string[];
  links: LinkItem[];
  comentarios: Comentario[];
  projeto: { id: string; nome: string } | null;
};

export type TarefaInput = {
  titulo: string;
  descricao?: string | null;
  status: StatusBucket;
  prioridade?: Prioridade;
  /** Legado/primário: quando `responsaveis` não vem, vira o único responsável. */
  responsavel_id?: string | null;
  /** Conjunto de responsáveis (ids de pessoa). Fonte de verdade da ponte. */
  responsaveis?: string[];
  projeto_id?: string | null;
  etapa_id?: string | null;
  prazo?: string | null;
  horas_estimadas?: number | null;
  horas_reais?: number | null;
  labels?: string[];
  links?: LinkItem[];
  comentarios?: Comentario[];
};

const KEY = {
  minhaPessoa: (userId?: string) => ["meu-trabalho", "minha-pessoa", userId] as const,
  pessoas: ["meu-trabalho", "pessoas"] as const,
  disciplinas: (pessoaId: string | null) => ["meu-trabalho", "disciplinas", pessoaId] as const,
  tarefas: (pessoaId: string | null) => ["meu-trabalho", "tarefas", pessoaId] as const,
};

/** Query key de `usePessoasEmpresa`, para invalidar de fora (ex.: depois de trocar o avatar_url). */
export const PESSOAS_EMPRESA_QUERY_KEY = KEY.pessoas;

/** Pessoa vinculada ao usuário logado (profile_id = auth.uid()). */
export function useMinhaPessoa() {
  const { user } = useAuth();
  return useQuery({
    queryKey: KEY.minhaPessoa(user?.id),
    enabled: !!user?.id,
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<PessoaOpcao | null> => {
      const { data, error } = await supabase
        .from("pessoas")
        .select("id, nome")
        .eq("profile_id", user!.id)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });
}

/** Projetos da empresa (id + nome) para vincular numa tarefa. RLS escopa. */
export function useProjetosLite() {
  return useQuery({
    queryKey: ["meu-trabalho", "projetos-lite"],
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<PessoaOpcao[]> => {
      const { data, error } = await supabase.from("projetos").select("id, nome").is("deleted_at", null).order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Pessoas da empresa, para o filtro. RLS já escopa por empresa. */
export function usePessoasEmpresa() {
  return useQuery({
    queryKey: KEY.pessoas,
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<PessoaOpcao[]> => {
      const { data, error } = await supabase
        .from("pessoas")
        .select("id, nome, profiles!pessoas_profile_id_fkey(avatar_url)")
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      // profile_id é opcional (pessoa sem login não tem profile); sem foto, o
      // AvatarStack cai para iniciais.
      return (data ?? []).map(({ id, nome, profiles }) => ({
        id,
        nome,
        avatarUrl: profiles?.avatar_url ?? null,
      }));
    },
  });
}

/**
 * Disciplinas sob responsabilidade da pessoa (aba Projetos).
 * pessoaId null = pessoa do usuário logado (a RPC resolve o default).
 */
export function useDisciplinas(pessoaId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: KEY.disciplinas(pessoaId),
    enabled: options?.enabled ?? true,
    staleTime: 2 * 60 * 1000,
    queryFn: async (): Promise<DisciplinaItem[]> => {
      const { data, error } = await supabase.rpc("get_minhas_disciplinas", {
        p_pessoa_id: pessoaId ?? undefined,
      });
      if (error) throw error;
      return (data ?? []).map((d) => ({
        id: d.id,
        titulo: d.titulo,
        status_bucket: d.status_bucket as StatusBucket,
        status_raw: d.status_raw,
        prioridade: toPrioridade(d.prioridade),
        prazo: d.prazo,
        projeto_id: d.projeto_id,
        projeto_nome: d.projeto_nome,
        responsavel_id: d.responsavel_id ?? null,
        responsavel_nome: d.responsavel_nome ?? null,
        labels: d.labels ?? [],
        links: (d.links as unknown as LinkItem[]) ?? [],
      }));
    },
  });
}

/** Grava o status canônico de uma disciplina a partir do balde de UI (D2). */
export function useSetDisciplinaStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ disciplinaId, bucket }: { disciplinaId: string; bucket: StatusBucket }) => {
      const { error } = await supabase.rpc("set_disciplina_status", {
        p_disciplina_id: disciplinaId,
        p_bucket: bucket,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meu-trabalho", "disciplinas"] }),
  });
}

/** Tarefas avulsas (aba Tarefas). Filtra por responsável quando informado. */
export function useTarefas(pessoaId: string | null) {
  return useQuery({
    queryKey: KEY.tarefas(pessoaId),
    staleTime: 60 * 1000,
    queryFn: async (): Promise<TarefaItem[]> => {
      // Filtro "minhas tarefas": tarefas em que a pessoa é um dos responsáveis
      // (via ponte). Sem responsáveis não aparece pra ninguém, como antes.
      let idsFiltro: string[] | null = null;
      if (pessoaId) {
        const { data: vinc, error: eVinc } = await supabase
          .from("tarefa_responsaveis")
          .select("tarefa_id")
          .eq("pessoa_id", pessoaId);
        if (eVinc) throw eVinc;
        idsFiltro = (vinc ?? []).map((r) => r.tarefa_id);
        if (idsFiltro.length === 0) return [];
      }

      let q = supabase
        .from("tarefas")
        .select(
          "id, numero, titulo, descricao, status, prioridade, responsavel_id, projeto_id, etapa_id, prazo, horas_estimadas, horas_reais, labels, links, comentarios, projeto:projetos(id, nome), responsaveis:tarefa_responsaveis(pessoa:pessoas(id, nome))"
        )
        .order("prazo", { ascending: true, nullsFirst: false });
      if (idsFiltro) q = q.in("id", idsFiltro);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map((t) => {
        const { responsaveis, ...rest } = t;
        return {
          ...rest,
          status: t.status as StatusBucket,
          prioridade: toPrioridade(t.prioridade),
          responsaveis: (responsaveis ?? [])
            .map((r) => (Array.isArray(r.pessoa) ? r.pessoa[0] : r.pessoa))
            .filter((p): p is PessoaOpcao => !!p),
          labels: t.labels ?? [],
          links: (t.links as unknown as LinkItem[]) ?? [],
          comentarios: (t.comentarios as unknown as Comentario[]) ?? [],
          projeto: Array.isArray(t.projeto) ? (t.projeto[0] ?? null) : t.projeto,
        };
      }) as TarefaItem[];
    },
  });
}

/**
 * Reescreve o conjunto de responsáveis de uma tarefa na ponte (apaga e reinsere,
 * simples e idempotente). RLS valida empresa/tenant nos dois lados.
 */
async function syncResponsaveis(tarefaId: string, empresaId: string, pessoaIds: string[]) {
  const { error: eDel } = await supabase.from("tarefa_responsaveis").delete().eq("tarefa_id", tarefaId);
  if (eDel) throw eDel;
  if (pessoaIds.length === 0) return;
  const rows = pessoaIds.map((pid) => ({ tarefa_id: tarefaId, pessoa_id: pid, empresa_id: empresaId }));
  const { error: eIns } = await supabase.from("tarefa_responsaveis").insert(rows);
  if (eIns) throw eIns;
}

export function useTarefaMutations() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["meu-trabalho", "tarefas"] });

  const criar = useMutation({
    mutationFn: async (input: TarefaInput) => {
      const empresaId = profile?.empresa_id;
      if (!empresaId) throw new Error("Sem empresa no perfil");
      const responsaveis = input.responsaveis ?? (input.responsavel_id ? [input.responsavel_id] : []);
      const { data, error } = await supabase
        .from("tarefas")
        .insert({
          empresa_id: empresaId,
          titulo: input.titulo,
          descricao: input.descricao ?? null,
          status: input.status,
          prioridade: input.prioridade ?? "media",
          responsavel_id: responsaveis[0] ?? null,
          projeto_id: input.projeto_id ?? null,
          etapa_id: input.etapa_id ?? null,
          prazo: input.prazo ?? null,
          horas_estimadas: input.horas_estimadas ?? null,
          horas_reais: input.horas_reais ?? null,
          labels: input.labels ?? [],
          links: (input.links ?? []) as unknown as Json,
          comentarios: (input.comentarios ?? []) as unknown as Json,
        })
        .select("id")
        .single();
      if (error) throw error;
      await syncResponsaveis(data.id, empresaId, responsaveis);
    },
    onSuccess: invalidate,
  });

  const atualizar = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Partial<TarefaInput> }) => {
      // Monta só os campos presentes; links/comentarios (jsonb) precisam de cast.
      const patch: TablesUpdate<"tarefas"> = {};
      if (input.titulo !== undefined) patch.titulo = input.titulo;
      if (input.descricao !== undefined) patch.descricao = input.descricao;
      if (input.status !== undefined) patch.status = input.status;
      if (input.prioridade !== undefined) patch.prioridade = input.prioridade;
      if (input.projeto_id !== undefined) patch.projeto_id = input.projeto_id;
      if (input.etapa_id !== undefined) patch.etapa_id = input.etapa_id;
      if (input.prazo !== undefined) patch.prazo = input.prazo;
      if (input.horas_estimadas !== undefined) patch.horas_estimadas = input.horas_estimadas;
      if (input.horas_reais !== undefined) patch.horas_reais = input.horas_reais;
      if (input.labels !== undefined) patch.labels = input.labels;
      if (input.links !== undefined) patch.links = input.links as unknown as Json;
      if (input.comentarios !== undefined) patch.comentarios = input.comentarios as unknown as Json;
      // Responsáveis: `responsaveis` (multi) tem prioridade; o primário acompanha.
      const responsaveis =
        input.responsaveis !== undefined
          ? input.responsaveis
          : input.responsavel_id !== undefined
            ? input.responsavel_id
              ? [input.responsavel_id]
              : []
            : null;
      if (responsaveis !== null) patch.responsavel_id = responsaveis[0] ?? null;

      if (Object.keys(patch).length > 0) {
        const { error } = await supabase.from("tarefas").update(patch).eq("id", id);
        if (error) throw error;
      }
      if (responsaveis !== null) {
        const empresaId = profile?.empresa_id;
        if (!empresaId) throw new Error("Sem empresa no perfil");
        await syncResponsaveis(id, empresaId, responsaveis);
      }
    },
    onSuccess: invalidate,
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tarefas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { criar, atualizar, excluir };
}
