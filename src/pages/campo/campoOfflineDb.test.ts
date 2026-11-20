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
  sessionStorage.clear();
  entrar("acc-1", "empresa-1", "obra-1");
});
afterEach(() => {
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

function entrar(accountId: string, empresaId: string, obraId: string) {
  sessionStorage.setItem("pilar_campo_token", "token-" + accountId);
  sessionStorage.setItem(
    "pilar_campo_account",
    JSON.stringify({
      account_id: accountId,
      empresa_id: empresaId,
      obra_id: obraId,
    })
  );
}

const owner1 = JSON.stringify(["empresa-1", "obra-1", "acc-1"]);

describe("campoOfflineDb", () => {
  it("cria as duas stores na primeira abertura e faz o CRUD de cada fila separadamente", async () => {
    const { filaOfflineDb, filaRegistroDb } = await import("./campoOfflineDb");
    expect(await filaOfflineDb.listar()).toEqual([]);
    expect(idb.indexedDB.open).toHaveBeenCalledWith("pilar-campo", 2);
    expect([...idb.stores.keys()]).toEqual(["fila-dias", "fila-registros"]);

    await filaOfflineDb.salvar({ id: "d1" } as never);
    await filaRegistroDb.salvar({ id: "r1" } as never);
    await filaRegistroDb.salvar({ id: "r2" } as never);
    expect(await filaOfflineDb.listar()).toEqual([{ id: "d1", __campoOwner: owner1 }]);
    expect(await filaRegistroDb.listar()).toEqual([
      { id: "r1", __campoOwner: owner1 },
      { id: "r2", __campoOwner: owner1 },
    ]);

    await filaRegistroDb.remover("r1");
    expect(await filaRegistroDb.listar()).toEqual([{ id: "r2", __campoOwner: owner1 }]);
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
    idb.falhas.getAll = false;
    await filaOfflineDb.salvar({ id: "d1" } as never);
    idb.falhas.tx = true;
    await expect(filaOfflineDb.salvar({ id: "d2" } as never)).rejects.toThrow("tx falhou");
    await expect(filaOfflineDb.remover("d1")).rejects.toThrow("tx falhou");
  });

  it("separa duas contas e obras no mesmo navegador sem expor nem sincronizar dados alheios", async () => {
    const { filaOfflineDb, filaRegistroDb } = await import("./campoOfflineDb");
    await filaOfflineDb.salvar({ id: "dia-a", dia: { p_atividades: "obra privada" } } as never);
    await filaRegistroDb.salvar({ id: "registro-a", texto: "somente conta A" } as never);

    entrar("acc-2", "empresa-2", "obra-2");
    expect(await filaOfflineDb.listar()).toEqual([]);
    expect(await filaRegistroDb.listar()).toEqual([]);
    await filaOfflineDb.remover("dia-a");
    await filaRegistroDb.remover("registro-a");

    await filaRegistroDb.salvar({ id: "registro-b", texto: "somente conta B" } as never);
    expect((await filaRegistroDb.listar()).map((x) => x.id)).toEqual(["registro-b"]);

    entrar("acc-1", "empresa-1", "obra-1");
    expect((await filaOfflineDb.listar()).map((x) => x.id)).toEqual(["dia-a"]);
    expect((await filaRegistroDb.listar()).map((x) => x.id)).toEqual(["registro-a"]);
    await expect(filaRegistroDb.salvar({ id: "registro-b" } as never)).rejects.toThrow("outra conta");
  });

  it("não acessa ou grava dados se o token não tem conta verificada em cache", async () => {
    const { filaOfflineDb } = await import("./campoOfflineDb");
    await filaOfflineDb.salvar({ id: "dia-a" } as never);
    sessionStorage.removeItem("pilar_campo_account");
    expect(await filaOfflineDb.listar()).toEqual([]);
    await expect(filaOfflineDb.salvar({ id: "dia-b" } as never)).rejects.toThrow("não verificada");
  });

  it("preserva itens legados sem dono em quarentena e só expõe a contagem", async () => {
    const { filaOfflineDb, filaRegistroDb, contarPendenciasAntigas } = await import("./campoOfflineDb");
    await filaOfflineDb.listar();
    idb.stores.get("fila-dias")!.set("legacy-1", { id: "legacy-1", dia: { p_atividades: "sigiloso" } });
    idb.stores.get("fila-registros")!.set("legacy-2", { id: "legacy-2", texto: "sigiloso" });

    expect(await contarPendenciasAntigas()).toBe(2);
    expect(await filaOfflineDb.listar()).toEqual([]);
    expect(await filaRegistroDb.listar()).toEqual([]);
    await filaOfflineDb.remover("legacy-1");
    expect(idb.stores.get("fila-dias")!.has("legacy-1")).toBe(true);
  });

  it("não reassocia registro já lido se a conta trocar antes da regravação", async () => {
    const { filaRegistroDb } = await import("./campoOfflineDb");
    await filaRegistroDb.salvar({ id: "registro-a" } as never);
    const [registroA] = await filaRegistroDb.listar();
    entrar("acc-2", "empresa-2", "obra-2");
    await expect(filaRegistroDb.salvar(registroA)).rejects.toThrow("outra conta");
    expect(await filaRegistroDb.listar()).toEqual([]);
  });
});
