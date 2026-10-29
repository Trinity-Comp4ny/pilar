import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getSafeErrorMessage } from "@/lib/safeError";
import { reportInvokeError } from "@/lib/monitoring";
import { FEEDBACK_NOVOS_KEY } from "@/hooks/useFeedbackNovosCount";
import { buscarEmpresa, edgeFetch, listarEmpresas, listarUsuarios } from "./api";
import { descreverAcao, ehEcoDeExclusaoManual, type TipoEvento } from "./lib";

/** Todas as chaves do portal começam aqui: invalidar ["ultra-admin"] recarrega tudo. */
export const KEYS = {
  empresas: ["ultra-admin", "empresas"] as const,
  empresa: (id: string) => ["ultra-admin", "empresa", id] as const,
  usuarios: ["ultra-admin", "usuarios"] as const,
  atividade: (empresaId: string | null, limite: number) =>
    ["ultra-admin", "atividade", empresaId ?? "todas", limite] as const,
  mutacoes: (empresaId: string) => ["ultra-admin", "mutacoes", empresaId] as const,
  feedback: ["ultra-admin", "feedback"] as const,
  incidentes: ["ultra-admin", "incidentes"] as const,
  componentes: ["ultra-admin", "componentes"] as const,
};

export function useEmpresas() {
  return useQuery({ queryKey: KEYS.empresas, queryFn: listarEmpresas, staleTime: 30_000 });
}

export function useEmpresa(id: string | undefined) {
  return useQuery({
    queryKey: KEYS.empresa(id ?? ""),
    queryFn: () => buscarEmpresa(id as string),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useUsuariosPlataforma() {
  return useQuery({ queryKey: KEYS.usuarios, queryFn: listarUsuarios, staleTime: 60_000 });
}

export type EventoAtividade = {
  id: string;
  quando: string;
  /** Quem fez; null = evento da plataforma (cadastro, feedback), sem ator humano do nosso lado. */
  ator: string | null;
  frase: string;
  detalhe: string | null;
  tipo: TipoEvento;
  empresaId: string | null;
  link: string | null;
};

const TIPO_AVISO: Record<string, TipoEvento> = {
  novo_cadastro: "cadastro",
  feedback_recebido: "feedback",
};

/**
 * Feed único (SPEC 117): log administrativo (admin_audit_logs, cross-empresa
 * via RLS is_ultra_admin) + avisos da plataforma que chegaram no sino do
 * próprio ultra admin (notificacoes categoria "sistema": novo cadastro,
 * feedback, plano bloqueado). Os avisos são a única trilha de "empresa se
 * cadastrou sozinha", que não passa pelo log administrativo.
 */
export function useAtividade(empresaId: string | null, limite = 150) {
  const { user } = useAuth();
  return useQuery({
    queryKey: KEYS.atividade(empresaId, limite),
    staleTime: 30_000,
    queryFn: async (): Promise<EventoAtividade[]> => {
      let qAudit = supabase
        .from("admin_audit_logs")
        .select("id, actor_email, action, category, target_name, empresa_id, metadata, created_at")
        .order("created_at", { ascending: false })
        .limit(limite);
      if (empresaId) qAudit = qAudit.eq("empresa_id", empresaId);

      let qAvisos = supabase
        .from("notificacoes")
        .select("id, tipo, titulo, mensagem, empresa_id, link, created_at")
        .eq("categoria", "sistema")
        .eq("destinatario_id", user?.id ?? "")
        .order("created_at", { ascending: false })
        .limit(limite);
      if (empresaId) qAvisos = qAvisos.eq("empresa_id", empresaId);

      const [{ data: audit, error: e1 }, { data: avisos, error: e2 }] = await Promise.all([qAudit, qAvisos]);
      if (e1) throw e1;
      if (e2) throw e2;

      const eventos: EventoAtividade[] = [
        ...(audit ?? [])
          .filter((a) => !ehEcoDeExclusaoManual(a.action, (a.metadata ?? null) as Record<string, unknown> | null))
          .map((a) => {
            const { frase, tipo } = descreverAcao({
              action: a.action,
              category: a.category,
              targetName: a.target_name,
              metadata: (a.metadata ?? null) as Record<string, unknown> | null,
            });
            return {
              id: `audit-${a.id}`,
              quando: a.created_at,
              ator: a.actor_email,
              frase,
              detalhe: null,
              tipo,
              empresaId: a.empresa_id,
              link: null,
            };
          }),
        ...(avisos ?? []).map((n) => ({
          id: `aviso-${n.id}`,
          quando: n.created_at,
          ator: null,
          frase: n.titulo,
          detalhe: n.mensagem,
          tipo: TIPO_AVISO[n.tipo] ?? ("cobranca" as TipoEvento),
          empresaId: n.empresa_id,
          link: n.link,
        })),
      ];
      return eventos.sort((a, b) => (a.quando < b.quando ? 1 : -1)).slice(0, limite);
    },
    enabled: !!user?.id,
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type Mutacao = { id: string; ator: string | null; action: string; tabela: string | null; quando: string };

/**
 * Mudanças de funcionalidade e papel da empresa (audit_logs). Os triggers gravam
 * a empresa em metadata.empresa_id e deixam a coluna empresa_id nula, então filtrar
 * só pela coluna devolvia sempre vazio. Alteração de dado de negócio (projeto,
 * despesa) ainda não é registrada em nenhuma tabela.
 */
export function useMutacoesEmpresa(empresaId: string) {
  return useQuery({
    queryKey: KEYS.mutacoes(empresaId),
    staleTime: 30_000,
    // O id entra na string do .or(): só UUID passa (vem da rota).
    enabled: UUID.test(empresaId),
    queryFn: async (): Promise<Mutacao[]> => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, actor_email, action, target_table, created_at")
        .or(`empresa_id.eq.${empresaId},metadata->>empresa_id.eq.${empresaId}`)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []).map((a) => ({
        id: a.id,
        ator: a.actor_email,
        action: a.action,
        tabela: a.target_table,
        quando: a.created_at,
      }));
    },
  });
}

/**
 * Wrapper das ações sobre empresa: chama a edge, avisa e recarrega lista e
 * detalhe. Erro vira toast com a mensagem da edge e é relançado, pra o
 * dialog ficar aberto pro usuário tentar de novo.
 */
export function useAcaoEmpresa<TInput>(opts: {
  run: (input: TInput) => Promise<unknown>;
  /** null: o chamador decide o aviso (ex.: criar empresa, que pode voltar com ressalva). */
  sucesso: string | ((input: TInput) => string) | null;
  erro: string;
  contexto: string;
}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: opts.run,
    onSuccess: (_d, input) => {
      if (opts.sucesso) toast.success(typeof opts.sucesso === "function" ? opts.sucesso(input) : opts.sucesso);
      void qc.invalidateQueries({ queryKey: ["ultra-admin"] });
    },
    onError: (err) => {
      reportInvokeError(err, opts.contexto);
      toast.error(opts.erro, { description: getSafeErrorMessage(err, "Tente de novo em instantes.") });
    },
  });
}

/** Empresa da equipe ou de teste sai dos números do Time (SPEC 129). */
export async function marcarEmpresaInterna(empresaId: string, interna: boolean): Promise<void> {
  const { error } = await supabase.rpc("ops_marcar_empresa_interna", { p_empresa_id: empresaId, p_interna: interna });
  if (error) throw error;
}

export function atualizarEmpresa(empresaId: string, patch: Record<string, unknown>) {
  return edgeFetch("ultra-admin-empresas", { method: "PUT", body: { empresa_id: empresaId, ...patch } });
}

// ─── Feedback ────────────────────────────────────────────────────────────

export type FeedbackStatus = "novo" | "em_analise" | "planejado" | "resolvido" | "descartado";

export type FeedbackItem = {
  id: string;
  tipo: "bug" | "sugestao";
  titulo: string | null;
  descricao: string;
  createdAt: string;
  createdBy: string;
  empresaId: string | null;
  rota: string | null;
  navegador: string | null;
  janela: string | null;
  printPath: string | null;
  sentryEventId: string | null;
  status: FeedbackStatus;
};

export function useFeedback() {
  return useQuery({
    queryKey: KEYS.feedback,
    staleTime: 30_000,
    queryFn: async (): Promise<FeedbackItem[]> => {
      const { data, error } = await supabase
        .from("feature_suggestions")
        .select(
          "id, tipo, titulo, descricao, created_at, status_interno, created_by, empresa_id, print_path, contexto, sentry_event_id"
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((s) => {
        const ctx = (s.contexto ?? null) as { rota?: string; navegador?: string; janela?: string } | null;
        return {
          id: s.id,
          tipo: s.tipo === "bug" ? "bug" : "sugestao",
          titulo: s.titulo,
          descricao: s.descricao,
          createdAt: s.created_at,
          createdBy: s.created_by,
          empresaId: s.empresa_id,
          rota: ctx?.rota ?? null,
          navegador: ctx?.navegador ?? null,
          janela: ctx?.janela ?? null,
          printPath: s.print_path,
          sentryEventId: s.sentry_event_id,
          status: s.status_interno as FeedbackStatus,
        };
      });
    },
  });
}

export function useMudarStatusFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: FeedbackStatus }) => {
      const { error } = await supabase.from("feature_suggestions").update({ status_interno: status }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: KEYS.feedback });
      const antes = qc.getQueryData<FeedbackItem[]>(KEYS.feedback);
      qc.setQueryData<FeedbackItem[]>(KEYS.feedback, (prev) => prev?.map((f) => (f.id === id ? { ...f, status } : f)));
      return { antes };
    },
    onError: (err, _v, ctx) => {
      if (ctx?.antes) qc.setQueryData(KEYS.feedback, ctx.antes);
      toast.error("Não foi possível mudar o status", { description: getSafeErrorMessage(err) });
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: FEEDBACK_NOVOS_KEY });
    },
  });
}

// ─── Incidentes (status page, spec 055) ──────────────────────────────────

export type Severidade = "degradado" | "parcial" | "outage";
export type IncidenteStatus = "investigando" | "identificado" | "monitorando" | "resolvido";

export type Componente = { id: string; slug: string; nome: string };

export type Incidente = {
  id: string;
  titulo: string;
  severidade: Severidade;
  status: IncidenteStatus;
  createdAt: string;
  resolvedAt: string | null;
  componentIds: string[];
  updates: Array<{ id: string; mensagem: string; createdAt: string }>;
};

export function useComponentes() {
  return useQuery({
    queryKey: KEYS.componentes,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Componente[]> => {
      const { data, error } = await supabase
        .from("status_components")
        .select("id, slug, nome_exibicao, ordem")
        .order("ordem");
      if (error) throw error;
      return (data ?? []).map((c) => ({ id: c.id, slug: c.slug, nome: c.nome_exibicao }));
    },
  });
}

export function useIncidentes() {
  return useQuery({
    queryKey: KEYS.incidentes,
    staleTime: 30_000,
    queryFn: async (): Promise<Incidente[]> => {
      const { data, error } = await supabase
        .from("status_incidents")
        .select(
          "id, titulo, severidade, status, created_at, resolved_at, status_incident_components(component_id), status_incident_updates(id, mensagem, created_at)"
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((i) => ({
        id: i.id,
        titulo: i.titulo,
        severidade: i.severidade as Severidade,
        status: i.status as IncidenteStatus,
        createdAt: i.created_at,
        resolvedAt: i.resolved_at,
        componentIds: (i.status_incident_components ?? []).map((c) => c.component_id),
        updates: (i.status_incident_updates ?? [])
          .slice()
          .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
          .map((u) => ({ id: u.id, mensagem: u.mensagem, createdAt: u.created_at })),
      }));
    },
  });
}
