/**
 * Tipos manuais para as tabelas de IA/agentes do ADR 0006 (migrations 030 e 031).
 *
 * Stub temporário: estas tabelas ainda NÃO foram aplicadas em banco, então não
 * estão em `types.ts` (gerado). Depois de aplicar as migrations, rode
 * `npm run gen:types` e migre estes tipos para o `Database` gerado, removendo este
 * arquivo. Enquanto isso, importe daqui para tipar código que fala com `jobs` /
 * `ai_usage_logs`.
 *
 * Formato espelha a saída do `supabase gen types` (Row/Insert/Update + Json).
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

/** Espelha o enum SQL public.job_status (migration 030). */
export type JobStatus = "pending" | "running" | "completed" | "failed";

/** Canal pg_notify emitido no AFTER INSERT de um job pending (ADR 0006 padrão c). */
export const JOBS_NOTIFY_CHANNEL = "jobs_pending" as const;

export interface JobRow {
  id: string;
  empresa_id: string;
  tipo: string;
  status: JobStatus;
  input: Json;
  result: Json | null;
  progress: number;
  stage: string | null;
  error: string | null;
  attempts: number;
  max_attempts: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface JobInsert {
  id?: string;
  empresa_id: string;
  tipo: string;
  status?: JobStatus;
  input?: Json;
  result?: Json | null;
  progress?: number;
  stage?: string | null;
  error?: string | null;
  attempts?: number;
  max_attempts?: number;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
  started_at?: string | null;
  completed_at?: string | null;
}

export type JobUpdate = Partial<JobInsert>;

export interface AiUsageLogRow {
  id: string;
  empresa_id: string;
  function: string;
  job_id: string | null;
  model: string;
  tokens_in: number;
  tokens_out: number;
  /** Custo real da inferência em USD. */
  cost: number;
  /** Estimativa de horas de trabalho humano substituídas (não medição). */
  human_equivalent_hours: number | null;
  created_by: string | null;
  created_at: string;
}

export interface AiUsageLogInsert {
  id?: string;
  empresa_id: string;
  function: string;
  job_id?: string | null;
  model: string;
  tokens_in?: number;
  tokens_out?: number;
  cost?: number;
  human_equivalent_hours?: number | null;
  created_by?: string | null;
  created_at?: string;
}

export type AiUsageLogUpdate = Partial<AiUsageLogInsert>;
