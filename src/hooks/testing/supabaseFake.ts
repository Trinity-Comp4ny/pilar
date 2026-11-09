/**
 * Fake do client Supabase para testes do módulo comercial (Leads, Clientes,
 * Propostas, Fornecedores). Substitui o client na fronteira
 * (`@/integrations/supabase/client`), sem mockar funções internas dos hooks.
 *
 * Cada `from(tabela)` devolve um builder encadeável que registra os métodos
 * chamados e, ao ser aguardado, resolve com a resposta configurada para a
 * operação (`select` | `insert` | `update` | `delete` | `upsert`).
 *
 * Uso no teste:
 *   vi.mock("@/integrations/supabase/client", async () => ({
 *     supabase: (await import("@/hooks/testing/supabaseFake")).supabaseFake.client,
 *   }));
 *   supabaseFake.respond("leads", "insert", { data: { id: "l1" }, error: null });
 */

export type FakeResponse = { data?: unknown; error?: unknown; count?: number | null };
export type FakeOp = "select" | "insert" | "update" | "delete" | "upsert";

export type FakeCall = {
  table: string;
  op: FakeOp;
  /** Argumento da operação de escrita (payload do insert/update/upsert). */
  payload: unknown;
  /** Todos os métodos encadeados, na ordem: [["eq", ["id", "x"]], ...]. */
  chain: [string, unknown[]][];
};

const WRITE_OPS: FakeOp[] = ["insert", "update", "delete", "upsert"];

export function createSupabaseFake() {
  const calls: FakeCall[] = [];
  const rpcCalls: { fn: string; args: unknown }[] = [];
  const invokeCalls: { fn: string; options: unknown }[] = [];
  const responses = new Map<string, FakeResponse[] | ((call: FakeCall) => FakeResponse)>();
  const rpcResponses = new Map<string, FakeResponse | ((args: unknown) => FakeResponse)>();
  const invokeResponses = new Map<string, FakeResponse>();
  let user: { id: string } | null = { id: "user-1" };

  const resolveFor = (call: FakeCall): FakeResponse => {
    const handler = responses.get(`${call.table}.${call.op}`) ?? responses.get(call.table);
    if (!handler) return { data: call.op === "select" ? [] : null, error: null };
    if (typeof handler === "function") return handler(call);
    // Fila: consome a primeira resposta; a última fica valendo para as próximas chamadas.
    return handler.length > 1 ? (handler.shift() as FakeResponse) : handler[0];
  };

  const builder = (table: string) => {
    const call: FakeCall = { table, op: "select", payload: undefined, chain: [] };
    calls.push(call);
    const proxy: Record<string, unknown> = new Proxy(
      {},
      {
        get(_t, prop: string) {
          if (prop === "then") {
            return (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => {
              const r = resolveFor(call);
              return Promise.resolve({ data: r.data ?? null, error: r.error ?? null, count: r.count ?? null }).then(
                onFulfilled,
                onRejected
              );
            };
          }
          return (...args: unknown[]) => {
            call.chain.push([prop, args]);
            if ((WRITE_OPS as string[]).includes(prop) && !WRITE_OPS.includes(call.op)) {
              call.op = prop as FakeOp;
              call.payload = args[0];
            }
            return proxy;
          };
        },
      }
    );
    return proxy;
  };

  const client = {
    from: (table: string) => builder(table),
    rpc: (fn: string, args?: unknown) => {
      rpcCalls.push({ fn, args });
      const h = rpcResponses.get(fn);
      const r = typeof h === "function" ? h(args) : (h ?? { data: null, error: null });
      return Promise.resolve({ data: r.data ?? null, error: r.error ?? null });
    },
    auth: {
      getUser: () => Promise.resolve({ data: { user }, error: null }),
      getSession: () => Promise.resolve({ data: { session: user ? { user } : null }, error: null }),
    },
    functions: {
      invoke: (fn: string, options?: unknown) => {
        invokeCalls.push({ fn, options });
        const r = invokeResponses.get(fn) ?? { data: null, error: null };
        return Promise.resolve({ data: r.data ?? null, error: r.error ?? null });
      },
    },
  };

  return {
    client,
    calls,
    rpcCalls,
    invokeCalls,
    /** Uma resposta (ou fila, consumida em ordem) para `tabela.op`, ou para a tabela toda. */
    respond(table: string, op: FakeOp | null, ...r: FakeResponse[]) {
      responses.set(op ? `${table}.${op}` : table, r);
    },
    respondWith(table: string, op: FakeOp, fn: (call: FakeCall) => FakeResponse) {
      responses.set(`${table}.${op}`, fn);
    },
    respondRpc(fn: string, r: FakeResponse | ((args: unknown) => FakeResponse)) {
      rpcResponses.set(fn, r);
    },
    respondInvoke(fn: string, r: FakeResponse) {
      invokeResponses.set(fn, r);
    },
    setUser(u: { id: string } | null) {
      user = u;
    },
    /** Chamadas de uma tabela/op, na ordem. */
    callsTo(table: string, op?: FakeOp) {
      return calls.filter((c) => c.table === table && (!op || c.op === op));
    },
    reset() {
      calls.length = 0;
      rpcCalls.length = 0;
      invokeCalls.length = 0;
      responses.clear();
      rpcResponses.clear();
      invokeResponses.clear();
      user = { id: "user-1" };
    },
  };
}

export type SupabaseFake = ReturnType<typeof createSupabaseFake>;

/** Instância única por arquivo de teste (cada arquivo tem seu próprio registry de módulos). */
export const supabaseFake = createSupabaseFake();
