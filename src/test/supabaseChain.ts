import { vi } from "vitest";

/**
 * `supabase.from(...)` falso para testes de tela: aceita qualquer cadeia do
 * query builder (select/eq/order/in/limit/...), registra a consulta e resolve
 * pelo `resolve` do teste, seja no `await` direto, em `.single()` ou
 * `.maybeSingle()`. Serve para telas que encadeiam várias tabelas sem precisar
 * remontar o builder em cada arquivo.
 */
export type ChainOp = "select" | "insert" | "update" | "upsert" | "delete";

export interface ChainQuery {
  table: string;
  op: ChainOp;
  columns?: string;
  payload?: unknown;
  filters: unknown[][];
  single: boolean;
}

export type ChainResult = { data?: unknown; error?: unknown; count?: number | null };

const WRITE_OPS = new Set(["insert", "update", "upsert", "delete"]);

export function createSupabaseFrom(resolve: (q: ChainQuery) => ChainResult | Promise<ChainResult>) {
  const calls: ChainQuery[] = [];
  const from = vi.fn((table: string) => {
    const q: ChainQuery = { table, op: "select", filters: [], single: false };
    calls.push(q);
    const builder: Record<string, unknown> = new Proxy(
      {},
      {
        get(_target, prop) {
          if (prop === "then") {
            return (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
              Promise.resolve()
                .then(() => resolve(q))
                .then((r) => ({ data: null, error: null, ...r }))
                .then(onFulfilled, onRejected);
          }
          return (...args: unknown[]) => {
            const name = String(prop);
            if (WRITE_OPS.has(name)) {
              q.op = name as ChainOp;
              q.payload = args[0];
            } else if (name === "select") {
              if (q.op === "select") q.columns = args[0] as string;
            } else if (name === "single" || name === "maybeSingle") {
              q.single = true;
            } else {
              q.filters.push([name, ...args]);
            }
            return builder;
          };
        },
      }
    );
    return builder;
  });
  return { from, calls };
}

/** Atalho: procura a primeira chamada que casa com tabela/op. */
export function findCall(calls: ChainQuery[], table: string, op?: ChainOp) {
  return calls.find((c) => c.table === table && (!op || c.op === op));
}
