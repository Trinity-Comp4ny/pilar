import { vi } from "vitest";

/**
 * Supabase falso para testes de tela e hook (obras, campo). Registra cada chamada
 * de `from()` com a operação, o payload e os filtros, e responde pelo `responder`,
 * que o teste troca para simular dado, erro de servidor ou RLS.
 *
 * Uso:
 *   vi.mock("@/integrations/supabase/client", async () => ({
 *     supabase: (await import("@/pages/obras/testing/supabaseFake")).fake.supabase,
 *   }));
 */

export type Resposta = { data: unknown; error: unknown; count?: number | null };

export interface ChamadaTabela {
  tabela: string;
  op: "select" | "insert" | "update" | "upsert" | "delete";
  payload?: unknown;
  filtros: Array<[string, ...unknown[]]>;
  final?: "single" | "maybeSingle";
}

type Responder = (c: ChamadaTabela) => Resposta | undefined;

const OPS = new Set(["insert", "update", "upsert", "delete"]);

function criarFake() {
  const chamadas: ChamadaTabela[] = [];
  let responder: Responder = () => undefined;

  const resolver = (c: ChamadaTabela): Promise<Resposta> => {
    chamadas.push(c);
    const r = responder(c);
    if (r) return Promise.resolve(r);
    if (c.op === "select" && !c.final) return Promise.resolve({ data: [], error: null });
    return Promise.resolve({ data: null, error: null });
  };

  function from(tabela: string) {
    const c: ChamadaTabela = { tabela, op: "select", filtros: [] };
    const alvo: Record<string, unknown> = {};
    const proxy: unknown = new Proxy(alvo, {
      get(_t, prop: string) {
        if (prop === "then") {
          return (ok: (v: Resposta) => unknown, err?: (e: unknown) => unknown) => resolver(c).then(ok, err);
        }
        if (prop === "single" || prop === "maybeSingle") {
          return () => resolver({ ...c, final: prop });
        }
        if (OPS.has(prop)) {
          return (payload?: unknown) => {
            c.op = prop as ChamadaTabela["op"];
            c.payload = payload;
            return proxy;
          };
        }
        if (prop === "select") {
          return () => proxy;
        }
        return (...args: unknown[]) => {
          c.filtros.push([prop, ...args]);
          return proxy;
        };
      },
    });
    return proxy;
  }

  const rpc = vi.fn(async (_nome: string, _args?: unknown): Promise<Resposta> => ({ data: null, error: null }));
  const invoke = vi.fn(async (_nome: string, _opts?: unknown): Promise<Resposta> => ({ data: null, error: null }));
  const upload = vi.fn(async (_path: string, _file: unknown, _opts?: unknown): Promise<Resposta> => ({
    data: { path: "ok" },
    error: null,
  }));
  const storageFrom = vi.fn((_bucket: string) => ({
    upload,
    remove: vi.fn(async () => ({ data: null, error: null })),
    createSignedUrl: vi.fn(async () => ({ data: { signedUrl: "https://signed" }, error: null })),
    createSignedUrls: vi.fn(async () => ({ data: [], error: null })),
    getPublicUrl: vi.fn(() => ({ data: { publicUrl: "https://public" } })),
  }));

  const supabase = {
    from: vi.fn(from),
    rpc,
    functions: { invoke },
    storage: { from: storageFrom },
    channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() })),
    removeChannel: vi.fn(),
  };

  return {
    supabase,
    chamadas,
    rpc,
    invoke,
    upload,
    /** Define como cada chamada de tabela responde (undefined = padrão vazio). */
    responder(fn: Responder) {
      responder = fn;
    },
    /** Escritas (insert/update/upsert/delete) registradas, na ordem. */
    escritas(tabela?: string) {
      return chamadas.filter((c) => c.op !== "select" && (!tabela || c.tabela === tabela));
    },
    reset() {
      chamadas.length = 0;
      responder = () => undefined;
      rpc.mockReset();
      rpc.mockImplementation(async () => ({ data: null, error: null }));
      invoke.mockReset();
      invoke.mockImplementation(async () => ({ data: null, error: null }));
      upload.mockClear();
    },
  };
}

export const fake = criarFake();

/** Atalho: responde `rpc("get_user_empresa_id")` com a empresa do seed e o resto vazio. */
export function rpcComEmpresa(outras: Record<string, Resposta> = {}) {
  fake.rpc.mockImplementation(async (nome: string) => {
    if (nome === "get_user_empresa_id") return { data: "emp-1", error: null };
    return outras[nome] ?? { data: null, error: null };
  });
}
