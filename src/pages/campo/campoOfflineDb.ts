import type { FilaDiaItem, FilaStore } from "./campoOfflineQueue";

/**
 * Adapter de IndexedDB para a fila offline do Pilar Campo. API crua (sem lib)
 * de propósito: a lógica que importa (retry parcial, idempotência) já está
 * testada em `campoOfflineQueue.test.ts` contra um store em memória; aqui é só
 * o CRUD, verificado manualmente no navegador (IndexedDB não roda em jsdom).
 */
const DB_NAME = "pilar-campo";
const DB_VERSION = 1;
const STORE = "fila-dias";

function abrirDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const filaOfflineDb: FilaStore = {
  async listar() {
    const db = await abrirDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result as FilaDiaItem[]);
      req.onerror = () => reject(req.error);
    });
  },
  async salvar(item) {
    const db = await abrirDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
  async remover(id) {
    const db = await abrirDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
};
