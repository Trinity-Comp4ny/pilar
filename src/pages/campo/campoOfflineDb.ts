import type { FilaDiaItem, FilaStore } from "./campoOfflineQueue";
import type { FilaRegistroItem, RegistroFilaStore } from "./campoRegistroFila";

/**
 * Adapter de IndexedDB para as filas offline do Pilar Campo. API crua (sem lib)
 * de propósito: a lógica que importa (retry parcial, idempotência) já está
 * testada em `campoOfflineQueue.test.ts` e `campoRegistroFila.test.ts` contra um
 * store em memória; aqui é só o CRUD, verificado manualmente no navegador
 * (IndexedDB não roda em jsdom).
 *
 * v2 (SPEC 135): acrescenta a fila de registros. Quem estava na v1 mantém a fila de dias.
 */
const DB_NAME = "pilar-campo";
const DB_VERSION = 2;
const STORE_DIAS = "fila-dias";
const STORE_REGISTROS = "fila-registros";

function abrirDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      for (const nome of [STORE_DIAS, STORE_REGISTROS]) {
        if (!req.result.objectStoreNames.contains(nome)) {
          req.result.createObjectStore(nome, { keyPath: "id" });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function criarStore<T extends { id: string }>(
  nome: string
): {
  listar(): Promise<T[]>;
  salvar(item: T): Promise<void>;
  remover(id: string): Promise<void>;
} {
  return {
    async listar() {
      const db = await abrirDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(nome, "readonly");
        const req = tx.objectStore(nome).getAll();
        req.onsuccess = () => resolve(req.result as T[]);
        req.onerror = () => reject(req.error);
      });
    },
    async salvar(item) {
      const db = await abrirDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(nome, "readwrite");
        tx.objectStore(nome).put(item);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
    async remover(id) {
      const db = await abrirDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(nome, "readwrite");
        tx.objectStore(nome).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
  };
}

export const filaOfflineDb: FilaStore = criarStore<FilaDiaItem>(STORE_DIAS);
export const filaRegistroDb: RegistroFilaStore = criarStore<FilaRegistroItem>(STORE_REGISTROS);
