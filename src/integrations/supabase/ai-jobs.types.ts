/**
 * Tipos manuais para a tabela `jobs` do ADR 0006 (migration 20260715000010).
 *
 * Stub temporário: a tabela ainda NÃO foi aplicada em banco, então não está em
 * `types.ts` (gerado). Depois de aplicar a migration, rode `npm run gen:types` e
 * migre estes tipos para o `Database` gerado, removendo este arquivo. Enquanto
 * isso, importe daqui para tipar código que fala com `jobs`.
 *
 * `ai_usage_logs` já existe em staging (migration 20260514200003) com outro
 * schema, então NÃO é tipada aqui: sai do `types.ts` gerado. As colunas de
 * pricing (custo, human_equivalent_hours) entram junto com o consumidor real.
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
