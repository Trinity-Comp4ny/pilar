import { supabase } from "@/integrations/supabase/client";
import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Helper para chamar RPCs do Postgres que ainda NÃO estão nos tipos gerados
 * (`src/integrations/supabase/types.ts`). Use isto em vez de `supabase.rpc as any`.
 *
 * Quando `npm run gen:types` for rodado e a função estiver nos tipos, prefira
 * `supabase.rpc("nome", args)` diretamente para ganhar inferência completa.
 */
export async function callUntypedRpc<TReturn = unknown>(
  fnName: string,
  args?: Record<string, unknown>
): Promise<{ data: TReturn | null; error: PostgrestError | null }> {
  // Cast deliberado: a função não está em Database['public']['Functions'].
  const client = supabase.rpc as unknown as (
    name: string,
    args?: Record<string, unknown>
  ) => Promise<{ data: TReturn | null; error: PostgrestError | null }>;
  return client(fnName, args);
}

/**
 * Helper tipado para tabelas/views que ainda NÃO estão em Database['public']['Tables'].
 * Encapsula o `as unknown as ...` em um único ponto.
 *
 * Uso:
 *   const q = untypedFrom<{ plan_id: string | null }>("pilar_subscriptions");
 *   const { data } = await q.select("plan_id").eq("empresa_id", id).maybeSingle();
 */
export function untypedFrom<TRow = Record<string, unknown>>(table: string) {
  // Cast deliberado: a tabela não está em Database['public']['Tables'].
  const client = supabase as unknown as {
    from: (t: string) => UntypedQueryBuilder<TRow>;
  };
  return client.from(table);
}

type UntypedResult<TRow> = { data: TRow[] | null; error: PostgrestError | null };

interface UntypedQueryBuilder<TRow> extends PromiseLike<UntypedResult<TRow>> {
  select: (cols?: string) => UntypedQueryBuilder<TRow> & {
    maybeSingle: () => Promise<{ data: TRow | null; error: PostgrestError | null }>;
    single: () => Promise<{ data: TRow; error: PostgrestError | null }>;
  };
  eq: (col: string, val: unknown) => UntypedQueryBuilder<TRow>;
  in: (col: string, vals: unknown[]) => UntypedQueryBuilder<TRow>;
  ilike: (col: string, pattern: string) => UntypedQueryBuilder<TRow>;
  order: (col: string, opts?: { ascending?: boolean }) => UntypedQueryBuilder<TRow>;
  limit: (n: number) => UntypedQueryBuilder<TRow>;
  is: (col: string, val: unknown) => UntypedQueryBuilder<TRow>;
  insert: (rows: Record<string, unknown> | Record<string, unknown>[]) => Promise<{ error: PostgrestError | null }>;
  update: (row: Record<string, unknown>) => UntypedQueryBuilder<TRow>;
  delete: () => UntypedQueryBuilder<TRow>;
  maybeSingle: () => Promise<{ data: TRow | null; error: PostgrestError | null }>;
  single: () => Promise<{ data: TRow; error: PostgrestError | null }>;
}
