/**
 * Mock do cliente Supabase na fronteira (supabase-js), para testes do financeiro
 * e de relatórios. Cada `from(tabela)` devolve um builder encadeável que registra
 * as chamadas; o `await` resolve o resultado configurado para "tabela.operação"
 * (operação = select | insert | update | delete | upsert). `rpc` resolve o
 * configurado para o nome da função.
 *
 *   const sb = criarSupabaseMock();
 *   vi.mock("@/integrations/supabase/client", () => ({ supabase: sb.client }));
 *   sb.resultado("despesas.insert", { data: [{ id: "d1" }], error: null });
 *   sb.rpcResultado("get_user_empresa_id", { data: "emp-1", error: null });
 */
import { vi } from "vitest";

export type Resultado = { data?: unknown; error?: unknown; count?: number | null };
export type Chamada = { tabela: string; op: string; metodo: string; args: unknown[] };

const METODOS = [
  "select",
  "insert",
  "update",
  "delete",
  "upsert",
  "eq",
  "neq",
  "in",
  "is",
  "or",
  "not",
  "gt",
  "gte",
  "lt",
  "lte",
  "like",
  "ilike",
  "order",
  "range",
  "limit",
  "match",
  "filter",
  "contains",
];

export function criarSupabaseMock() {
  const resultados = new Map<string, Resultado | Resultado[]>();
  const rpcResultados = new Map<string, Resultado | Resultado[]>();
  const chamadas: Chamada[] = [];

  function proximo(mapa: Map<string, Resultado | Resultado[]>, chave: string, padrao: Resultado): Resultado {
    const r = mapa.get(chave);
    if (!r) return padrao;
    if (Array.isArray(r)) return r.length > 1 ? (r.shift() as Resultado) : (r[0] ?? padrao);
    return r;
  }

  function builder(tabela: string) {
    let op = "";
    const b: Record<string, unknown> = {};
    for (const metodo of METODOS) {
      b[metodo] = (...args: unknown[]) => {
        if (!op && ["insert", "update", "delete", "select", "upsert"].includes(metodo)) op = metodo;
        chamadas.push({ tabela, op, metodo, args });
        return b;
      };
    }
    const resolver = () => proximo(resultados, `${tabela}.${op}`, { data: [], error: null });
    b.single = () => {
      chamadas.push({ tabela, op, metodo: "single", args: [] });
      return Promise.resolve(resolver());
    };
    b.maybeSingle = () => {
      chamadas.push({ tabela, op, metodo: "maybeSingle", args: [] });
      return Promise.resolve(resolver());
    };
    b.then = (resolve: (r: Resultado) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(resolver()).then(resolve, reject);
    return b;
  }

  const rpc = vi.fn(async (nome: string, _args?: unknown) => proximo(rpcResultados, nome, { data: null, error: null }));

  const client = {
    from: vi.fn((tabela: string) => builder(tabela)),
    rpc,
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } }, error: null })),
      getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
    },
    functions: { invoke: vi.fn(async () => ({ data: null, error: null })) },
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(async () => ({ data: null, error: null })),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: "" } })),
      })),
    },
  };

  return {
    client,
    chamadas,
    resultado(chave: string, r: Resultado | Resultado[]) {
      resultados.set(chave, r);
    },
    rpcResultado(nome: string, r: Resultado | Resultado[]) {
      rpcResultados.set(nome, r);
    },
    /** Chamadas de um método numa tabela (ex.: ("despesas", "insert")). */
    de(tabela: string, metodo: string) {
      return chamadas.filter((c) => c.tabela === tabela && c.metodo === metodo);
    },
    /** Argumentos da RPC (primeira chamada, ou a n-ésima). */
    argsRpc(nome: string, n = 0) {
      return rpc.mock.calls.filter((c) => c[0] === nome)[n]?.[1] as Record<string, unknown> | undefined;
    },
    reset() {
      resultados.clear();
      rpcResultados.clear();
      chamadas.length = 0;
      rpc.mockClear();
      client.from.mockClear();
    },
  };
}

/**
 * Instância única por arquivo de teste (cada arquivo roda em módulo isolado).
 * No factory do `vi.mock`, importe dinamicamente:
 *
 *   vi.mock("@/integrations/supabase/client", async () => ({
 *     supabase: (await import("../testing/supabaseMock")).sb.client,
 *   }));
 */
export const sb = criarSupabaseMock();
