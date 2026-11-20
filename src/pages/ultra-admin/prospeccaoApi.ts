// SPEC 172 fase 0: leitura e escrita da prospecção no Ultra. Leitura direta (RLS só do ultra
// admin); a importação insere leads; toda mudança de estado passa pelas RPCs prospec_montar_fila
// e prospec_registrar, que gravam o envio e o lead juntos.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Canal, Confianca, LeadImportado, TipoTelefone } from "./prospeccaoLib";

export const LIMITE_DIARIO = 10;

export interface ProspecLead {
  id: string;
  nome: string;
  segmento: string;
  segmento_teste: boolean;
  cidade: string | null;
  telefone_e164: string | null;
  tipo_telefone: TipoTelefone;
  email: string | null;
  site: string | null;
  contato_nome: string | null;
  canal: Canal;
  confianca_contato: Confianca;
  nota_encaixe: number;
  status: string;
  fila_em: string | null;
  ultimo_contato_em: string | null;
}

const COLUNAS =
  "id, nome, segmento, segmento_teste, cidade, telefone_e164, tipo_telefone, email, site, contato_nome, canal, confianca_contato, nota_encaixe, status, fila_em, ultimo_contato_em";

const CHAVES = ["ultra-prospec-leads", "ultra-prospec-fila", "ultra-prospec-resumo"] as const;

/** Início do dia em Brasília, no formato aceito pelo Postgres. */
function inicioDoDia(): string {
  const dia = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  return `${dia}T00:00:00-03:00`;
}

export function useLeads() {
  return useQuery({
    queryKey: ["ultra-prospec-leads"],
    queryFn: async (): Promise<ProspecLead[]> => {
      const { data, error } = await supabase
        .from("prospec_leads")
        .select(COLUNAS)
        .order("nota_encaixe", { ascending: false })
        .order("nome")
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as unknown as ProspecLead[];
    },
  });
}

export function useFilaHoje() {
  return useQuery({
    queryKey: ["ultra-prospec-fila"],
    queryFn: async (): Promise<ProspecLead[]> => {
      const { data, error } = await supabase
        .from("prospec_leads")
        .select(COLUNAS)
        .eq("status", "fila")
        .order("segmento_teste")
        .order("nota_encaixe", { ascending: false })
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as ProspecLead[];
    },
  });
}

export interface ResumoProspeccao {
  enviadosHoje: number;
  bloqueiosSemana: number;
  naFila: number;
  novosProntos: number;
}

export function useResumo() {
  return useQuery({
    queryKey: ["ultra-prospec-resumo"],
    queryFn: async (): Promise<ResumoProspeccao> => {
      const semana = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
      const [env, blq, fila, novos] = await Promise.all([
        supabase
          .from("prospec_envios")
          .select("id", { count: "exact", head: true })
          .eq("resultado", "enviei")
          .gte("created_at", inicioDoDia()),
        supabase
          .from("prospec_envios")
          .select("id", { count: "exact", head: true })
          .in("resultado", ["parar", "numero_errado"])
          .gte("created_at", semana),
        supabase.from("prospec_leads").select("id", { count: "exact", head: true }).eq("status", "fila"),
        supabase
          .from("prospec_leads")
          .select("id", { count: "exact", head: true })
          .eq("status", "novo")
          .eq("canal", "whatsapp"),
      ]);
      const erro = env.error ?? blq.error ?? fila.error ?? novos.error;
      if (erro) throw erro;
      return {
        enviadosHoje: env.count ?? 0,
        bloqueiosSemana: blq.count ?? 0,
        naFila: fila.count ?? 0,
        novosProntos: novos.count ?? 0,
      };
    },
  });
}

function useInvalidar() {
  const qc = useQueryClient();
  return () => Promise.all(CHAVES.map((k) => qc.invalidateQueries({ queryKey: [k] })));
}

export function useMontarFila() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (limite: number = LIMITE_DIARIO): Promise<number> => {
      const { data, error } = await supabase.rpc("prospec_montar_fila", { p_limite: limite, p_canal: "whatsapp" });
      if (error) throw error;
      return data ?? 0;
    },
    onSuccess: invalidar,
  });
}

export type ResultadoEnvio =
  "enviei" | "pulei" | "numero_errado" | "parar" | "respondeu" | "reuniao_marcada" | "sem_interesse";

export interface RegistroEnvio {
  leadId: string;
  resultado: ResultadoEnvio;
  canal?: Canal;
  texto?: string;
  contatoNome?: string;
}

export function useRegistrarEnvio() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (r: RegistroEnvio) => {
      const { error } = await supabase.rpc("prospec_registrar", {
        p_lead: r.leadId,
        p_resultado: r.resultado,
        p_canal: r.canal,
        p_texto: r.texto,
        p_contato_nome: r.contatoNome,
      });
      if (error) throw error;
    },
    onSuccess: invalidar,
  });
}

// ─── Importação ──────────────────────────────────────────────────────────────

export interface ResultadoImportacao {
  inseridos: number;
  jaExistiam: number;
  bloqueados: number;
}

async function lerTodos<T>(
  buscar: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: Error | null }>
) {
  const todos: T[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await buscar(de, de + 999);
    if (error) throw error;
    todos.push(...(data ?? []));
    if (!data || data.length < 1000) return todos;
  }
}

const chaveDe = (l: Pick<LeadImportado, "telefone_e164" | "email">): string | null =>
  l.telefone_e164 ? `t:${l.telefone_e164}` : l.email ? `e:${l.email.toLowerCase()}` : null;

/** Separa o que é novo do que já existe ou está bloqueado. Puro para ser testado sem banco. */
export function filtrarNovos(
  leads: LeadImportado[],
  existentes: Set<string>,
  bloqueados: Set<string>
): { novos: LeadImportado[]; jaExistiam: number; bloqueados: number } {
  const vistos = new Set(existentes);
  const novos: LeadImportado[] = [];
  let jaExistiam = 0;
  let barrados = 0;
  for (const lead of leads) {
    const chave = chaveDe(lead);
    const emailBloqueado = lead.email ? bloqueados.has(`e:${lead.email.toLowerCase()}`) : false;
    if ((chave && bloqueados.has(chave)) || emailBloqueado) {
      barrados++;
      continue;
    }
    if (!chave || vistos.has(chave)) {
      jaExistiam++;
      continue;
    }
    vistos.add(chave);
    novos.push(lead);
  }
  return { novos, jaExistiam, bloqueados: barrados };
}

export function useImportarLeads() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (leads: LeadImportado[]): Promise<ResultadoImportacao> => {
      const [leadsAtuais, bloqueios] = await Promise.all([
        lerTodos<{ telefone_e164: string | null; email: string | null }>((de, ate) =>
          supabase.from("prospec_leads").select("telefone_e164, email").range(de, ate)
        ),
        lerTodos<{ telefone_e164: string | null; email: string | null }>((de, ate) =>
          supabase.from("prospec_bloqueios").select("telefone_e164, email").range(de, ate)
        ),
      ]);
      const existentes = new Set<string>();
      for (const l of leadsAtuais) {
        const c = chaveDe(l);
        if (c) existentes.add(c);
      }
      const barrados = new Set<string>();
      for (const b of bloqueios) {
        if (b.telefone_e164) barrados.add(`t:${b.telefone_e164}`);
        if (b.email) barrados.add(`e:${b.email.toLowerCase()}`);
      }

      const { novos, jaExistiam, bloqueados } = filtrarNovos(leads, existentes, barrados);
      for (let i = 0; i < novos.length; i += 200) {
        const { error } = await supabase
          .from("prospec_leads")
          .insert(novos.slice(i, i + 200).map((l) => ({ ...l, origem: "import" })));
        if (error) throw error;
      }
      return { inseridos: novos.length, jaExistiam, bloqueados };
    },
    onSuccess: invalidar,
  });
}
