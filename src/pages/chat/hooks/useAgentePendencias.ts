import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type PendenciaSeveridade = "critical" | "high" | "medium" | "low";
export type PendenciaArea = "financeiro" | "prazos" | "orcamento" | "obra" | "planejamento" | "comercial";

/** Pendência de acompanhamento (SPEC 146). `dados` carrega os fatos da regra; o front só formata. */
export type Pendencia = Omit<Tables<"agente_pendencias">, "dados" | "severidade" | "area"> & {
  dados: Record<string, unknown>;
  severidade: PendenciaSeveridade;
  area: PendenciaArea;
};

export type CobrancaRascunho = Pick<
  Tables<"cobrancas">,
  "id" | "etapa" | "status" | "destinatario_email" | "assunto" | "abertura"
> & { fatos: Record<string, unknown> };

const pendenciasKey = ["agente_pendencias"] as const;

/**
 * Fila de pendências da empresa. Abrir a aba atualiza a fila (a função pula se rodou há menos de
 * 5 minutos); depois lê só o que está aberto. Quem não vê dinheiro recebe só as áreas que a RLS libera.
 */
export function useAgentePendencias() {
  return useQuery({
    queryKey: pendenciasKey,
    queryFn: async (): Promise<Pendencia[]> => {
      const { error: erroAtualizar } = await supabase.rpc("agente_pendencias_atualizar");
      if (erroAtualizar) throw erroAtualizar;

      const { data, error } = await supabase
        .from("agente_pendencias")
        .select("*")
        .eq("status", "aberta")
        .order("primeira_deteccao", { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as Pendencia[];
    },
    staleTime: 1000 * 60 * 2,
  });
}

export function useAdiarPendencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dias }: { id: string; dias: number }) => {
      const { error } = await supabase.rpc("agente_pendencia_adiar", { p_id: id, p_dias: dias });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: pendenciasKey }),
  });
}

export function useDispensarPendencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("agente_pendencia_dispensar", { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: pendenciasKey }),
  });
}

/** Rascunho de cobrança preparado pelo agente (SPEC 148), para o usuário revisar. */
export function useCobranca(id: string | null) {
  return useQuery({
    queryKey: ["cobrancas", id],
    enabled: !!id,
    queryFn: async (): Promise<CobrancaRascunho> => {
      const { data, error } = await supabase
        .from("cobrancas")
        .select("id, etapa, status, destinatario_email, assunto, abertura, fatos")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as unknown as CobrancaRascunho;
    },
  });
}

/** Aprovar e enviar: único caminho que manda o e-mail (função cobranca-enviar). */
export function useEnviarCobranca() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ cobrancaId, abertura }: { cobrancaId: string; abertura?: string }) => {
      const { data, error } = await supabase.functions.invoke("cobranca-enviar", {
        body: { cobranca_id: cobrancaId, ...(abertura ? { abertura } : {}) },
      });
      if (error) {
        const corpo = error.context ? await error.context.json?.().catch(() => null) : null;
        throw new Error(corpo?.error || error.message || "Erro desconhecido");
      }
      if (data?.error) throw new Error(data.error);
      return data as { email: string; etapa: number };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: pendenciasKey }),
  });
}

/** Recusar a etapa ou registrar que já cobrou por fora. */
export function useDecidirCobranca() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ cobrancaId, status }: { cobrancaId: string; status: "recusada" | "externa" }) => {
      const { error } = await supabase.rpc("cobranca_decidir", { p_id: cobrancaId, p_status: status });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: pendenciasKey }),
  });
}

/** Varre a fila já, sem esperar o intervalo de 5 minutos: usado depois de uma ação que muda o dado de origem. */
async function atualizarFila(): Promise<void> {
  const { error } = await supabase.rpc("agente_pendencias_atualizar", { p_forcar: true });
  if (error) throw error;
}

export type ProjetoOrcamento = {
  nome: string;
  contrato: number | null;
  podeVerValor: boolean;
  disciplinas: string[];
};

/** Projeto, valor de contrato (só para quem vê dinheiro) e disciplinas a orçar. */
export function useOrcamentoGuiado(projetoId: string | null) {
  return useQuery({
    queryKey: ["orcamento_guiado", projetoId],
    enabled: !!projetoId,
    queryFn: async (): Promise<ProjetoOrcamento> => {
      const [projeto, disciplinas] = await Promise.all([
        supabase.from("projetos_safe").select("nome, valor_contrato, pode_ver_valor").eq("id", projetoId!).single(),
        supabase.from("projeto_disciplinas").select("nome").eq("projeto_id", projetoId!).order("ordem_etapa"),
      ]);
      if (projeto.error) throw projeto.error;
      if (disciplinas.error) throw disciplinas.error;
      const nomes = [...new Set((disciplinas.data ?? []).map((d) => d.nome))];
      return {
        nome: projeto.data.nome ?? "Projeto",
        contrato: projeto.data.pode_ver_valor ? Number(projeto.data.valor_contrato ?? 0) : null,
        podeVerValor: projeto.data.pode_ver_valor === true,
        disciplinas: nomes,
      };
    },
  });
}

export type LinhaOrcamentoSalvar = { disciplina: string; horasEstimadas: number; custoHora: number };

/** Salva o orçamento por disciplina (mesma unicidade da aba Escopo) e atualiza a fila na hora. */
export function useSalvarOrcamentoGuiado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projetoId, linhas }: { projetoId: string; linhas: LinhaOrcamentoSalvar[] }) => {
      const { data: empresaId, error: erroEmpresa } = await supabase.rpc("get_user_empresa_id");
      if (erroEmpresa) throw erroEmpresa;
      if (!empresaId) throw new Error("Usuário não vinculado a uma empresa");
      const { error } = await supabase.from("projeto_orcamento_fases").upsert(
        linhas.map((l) => ({
          empresa_id: empresaId,
          projeto_id: projetoId,
          disciplina: l.disciplina,
          horas_estimadas: l.horasEstimadas,
          custo_hora: l.custoHora,
        })),
        { onConflict: "projeto_id,disciplina" }
      );
      if (error) throw error;
      await atualizarFila();
    },
    onSuccess: (_, { projetoId }) => {
      qc.invalidateQueries({ queryKey: pendenciasKey });
      qc.invalidateQueries({ queryKey: ["projeto_orcamento_fases", projetoId] });
    },
  });
}

export type ProjetoPrazo = {
  nome: string;
  entrega: string | null;
  cliente: { id: string; nome: string; email: string | null } | null;
  disciplinas: { nome: string; status: string | null; data_fim: string | null }[];
};

/** Projeto com prazo em risco: entrega, cliente e disciplinas (as abertas definem o risco). */
export function usePlanoPrazo(projetoId: string | null) {
  return useQuery({
    queryKey: ["plano_prazo", projetoId],
    enabled: !!projetoId,
    queryFn: async (): Promise<ProjetoPrazo> => {
      const [projeto, disciplinas] = await Promise.all([
        supabase.from("projetos_safe").select("nome, data_previsao, cliente_id").eq("id", projetoId!).single(),
        supabase
          .from("projeto_disciplinas")
          .select("nome, status, data_fim")
          .eq("projeto_id", projetoId!)
          .order("data_fim", { ascending: true, nullsFirst: false }),
      ]);
      if (projeto.error) throw projeto.error;
      if (disciplinas.error) throw disciplinas.error;
      let cliente: ProjetoPrazo["cliente"] = null;
      if (projeto.data.cliente_id) {
        const { data } = await supabase
          .from("clientes")
          .select("id, nome, email")
          .eq("id", projeto.data.cliente_id)
          .maybeSingle();
        cliente = data ?? null;
      }
      return {
        nome: projeto.data.nome ?? "Projeto",
        entrega: projeto.data.data_previsao ?? null,
        cliente,
        disciplinas: disciplinas.data ?? [],
      };
    },
  });
}

export type AcoesPrazo = {
  projetoId: string;
  pendenciaId: string;
  avisar: boolean;
  comunicado: { clienteId: string; assunto: string; mensagem: string } | null;
  aditivo: { dias: number; justificativa: string } | null;
};

export type ResultadoAcao = { acao: "avisar" | "comunicado" | "aditivo"; ok: boolean; erro?: string };

/** Corpo de erro de uma Edge Function (o `error` que ela devolveu, quando há). */
async function erroDaFuncao(error: { message: string; context?: { json?: () => Promise<{ error?: string }> } }) {
  const corpo = error.context?.json ? await error.context.json().catch(() => null) : null;
  return corpo?.error || error.message || "Erro desconhecido";
}

/**
 * Aplica as ações marcadas do plano de prazo em risco, uma a uma: falha de uma não impede as outras.
 * Se algo foi aplicado, adia a pendência por 3 dias (o agente já agiu) e atualiza a fila.
 */
export function useAplicarPlanoPrazo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: AcoesPrazo): Promise<ResultadoAcao[]> => {
      const resultados: ResultadoAcao[] = [];

      if (a.avisar) {
        const { error } = await supabase.rpc("projeto_prazo_avisar", { p_projeto: a.projetoId });
        resultados.push({ acao: "avisar", ok: !error, erro: error?.message });
      }
      if (a.comunicado) {
        const { data, error } = await supabase.functions.invoke("send-manual-client-email", {
          body: { cliente_id: a.comunicado.clienteId, subject: a.comunicado.assunto, message: a.comunicado.mensagem },
        });
        const motivo = error ? await erroDaFuncao(error) : data?.error;
        resultados.push({ acao: "comunicado", ok: !motivo, erro: motivo });
      }
      if (a.aditivo) {
        const { error } = await supabase.rpc("projeto_aditivo_prazo_criar", {
          p_projeto: a.projetoId,
          p_dias: a.aditivo.dias,
          p_justificativa: a.aditivo.justificativa,
        });
        resultados.push({ acao: "aditivo", ok: !error, erro: error?.message });
      }

      if (resultados.some((r) => r.ok)) {
        await supabase.rpc("agente_pendencia_adiar", { p_id: a.pendenciaId, p_dias: 3 });
        await atualizarFila();
      }
      return resultados;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: pendenciasKey });
      qc.invalidateQueries({ queryKey: ["escopos"] });
    },
  });
}
