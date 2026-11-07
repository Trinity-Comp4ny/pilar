import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Adapter de IndexedDB das filas do Pilar Campo. O jsdom não tem IndexedDB: aqui
// um IndexedDB mínimo em memória (open/upgrade, getAll/put/delete com os mesmos
// callbacks assíncronos) verifica o CRUD, a criação das duas stores e os erros.

type Req<T> = { result?: T; error?: unknown; onsuccess?: () => void; onerror?: () => void };

function criarIndexedDbFalso() {
  const stores = new Map<string, Map<string, unknown>>();
  const falhas = { open: false, getAll: false, tx: false };
  let versaoCriada = false;

  const db = {
    objectStoreNames: { contains: (n: string) => stores.has(n) },
    createObjectStore: (n: string) => {
      stores.set(n, new Map());
    },
    transaction: (nome: string) => {
      const tx: { oncomplete?: () => void; onerror?: () => void; error?: unknown; objectStore: () => unknown } = {
        objectStore: () => ({
          getAll: () => {
            const req: Req<unknown[]> = {};
            setTimeout(() => {
              if (falhas.getAll) {
                req.error = new Error("getAll falhou");
                req.onerror?.();
              } else {
                req.result = [...(stores.get(nome)?.values() ?? [])];
                req.onsuccess?.();
              }
            });
            return req;
          },
          put: (item: { id: string }) => {
            if (!falhas.tx) stores.get(nome)!.set(item.id, item);
          },
          delete: (id: string) => {
            if (!falhas.tx) stores.get(nome)!.delete(id);
          },
        }),
      };
      setTimeout(() => {
        if (falhas.tx) {
          tx.error = new Error("tx falhou");
          tx.onerror?.();
        } else tx.oncomplete?.();
      });
      return tx;
    },
  };

  const indexedDB = {
    open: vi.fn(() => {
      const req: Req<typeof db> & { onupgradeneeded?: () => void } = {};
      setTimeout(() => {
        if (falhas.open) {
          req.error = new Error("open falhou");
          req.onerror?.();
          return;
        }
        req.result = db;
        if (!versaoCriada) {
          versaoCriada = true;
          req.onupgradeneeded?.();
        }
        req.onsuccess?.();
      });
      return req;
    }),
  };
  return { indexedDB, stores, falhas };
}

let idb: ReturnType<typeof criarIndexedDbFalso>;

beforeEach(() => {
  vi.resetModules();
  idb = criarIndexedDbFalso();
  vi.stubGlobal("indexedDB", idb.indexedDB);
});
afterEach(() => vi.unstubAllGlobals());

describe("campoOfflineDb", () => {
  it("cria as duas stores na primeira abertura e faz o CRUD de cada fila separadamente", async () => {
    const { filaOfflineDb, filaRegistroDb } = await import("./campoOfflineDb");
    expect(await filaOfflineDb.listar()).toEqual([]);
    expect(idb.indexedDB.open).toHaveBeenCalledWith("pilar-campo", 2);
    expect([...idb.stores.keys()]).toEqual(["fila-dias", "fila-registros"]);

    await filaOfflineDb.salvar({ id: "d1" } as never);
    await filaRegistroDb.salvar({ id: "r1" } as never);
    await filaRegistroDb.salvar({ id: "r2" } as never);
    expect(await filaOfflineDb.listar()).toEqual([{ id: "d1" }]);
    expect(await filaRegistroDb.listar()).toEqual([{ id: "r1" }, { id: "r2" }]);

    await filaRegistroDb.remover("r1");
    expect(await filaRegistroDb.listar()).toEqual([{ id: "r2" }]);
  });

  it("banco que não abre rejeita a operação", async () => {
    idb.falhas.open = true;
    const { filaOfflineDb } = await import("./campoOfflineDb");
    await expect(filaOfflineDb.listar()).rejects.toThrow("open falhou");
  });

  it("erro na leitura ou na transação de escrita rejeita", async () => {
    const { filaOfflineDb } = await import("./campoOfflineDb");
    idb.falhas.getAll = true;
    await expect(filaOfflineDb.listar()).rejects.toThrow("getAll falhou");
    idb.falhas.tx = true;
    await expect(filaOfflineDb.salvar({ id: "d1" } as never)).rejects.toThrow("tx falhou");
    await expect(filaOfflineDb.remover("d1")).rejects.toThrow("tx falhou");
  });
});
