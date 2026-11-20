import type { FilaDiaItem, FilaStore } from "./campoOfflineQueue";
import type { FilaRegistroItem, RegistroFilaStore } from "./campoRegistroFila";

/**
 * A fila offline pode conter fotos, áudio e informações de obras.
 * Os dois stores antigos são preservados para não apagar trabalho feito sem rede.
 * A partir desta versão, cada item novo pertence à conta, empresa e obra do
 * último login verificado do Pilar Campo. Itens antigos sem dono são colocados
 * em quarentena: NUNCA são mostrados, enviados ou reassociados automaticamente.
 */
const DB_NAME = "pilar-campo";
const DB_VERSION = 2;
const STORE_DIAS = "fila-dias";
const STORE_REGISTROS = "fila-registros";
const CAMPO_TOKEN = "pilar_campo_token";
const CAMPO_ACCOUNT = "pilar_campo_account";
const OWNER_KEY = "__campoOwner" as const;

type Owned<T> = T & { [OWNER_KEY]?: string };

function ownerAtual(): string | null {
  try {
    // O token não é usado como chave: ele pode ser renovado durante a sessão.
    if (!sessionStorage.getItem(CAMPO_TOKEN)) return null;
    const raw = sessionStorage.getItem(CAMPO_ACCOUNT);
    if (!raw) return null;
    const obj = JSON.parse(raw) as Record<string, unknown>;
    if (
      typeof obj.account_id !== "string" ||
      typeof obj.empresa_id !== "string" ||
      typeof obj.obra_id !== "string" ||
      !obj.account_id ||
      !obj.empresa_id ||
      !obj.obra_id
    ) return null;
    return JSON.stringify([obj.empresa_id, obj.obra_id, obj.account_id]);
  } catch {
    return null;
  }
}

function requireOwner(): string {
  const owner = ownerAtual();
  if (!owner) throw new Error("Sessão do Pilar Campo não verificada. Entre novamente antes de salvar offline.");
  return owner;
}

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

function lerTudo<T extends { id: string }>(nome: string): Promise<Owned<T>[]> {
  return abrirDb().then(
    (db) => new Promise<Owned<T>[]>((resolve, reject) => {
      const tx = db.transaction(nome, "readonly");
      const req = tx.objectStore(nome).getAll();
      req.onsuccess = () => resolve(req.result as Owned<T>[]);
      req.onerror = () => reject(req.error);
    })
  );
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
      const owner = ownerAtual();
      if (!owner) return [];
      const itens = await lerTudo<T>(nome);
      // Se houve troca de conta durante a leitura, não entregue o resultado.
      if (ownerAtual() !== owner) return [];
      return itens.filter((item) => item[OWNER_KEY] === owner);
    },
    async salvar(item) {
      const owner = requireOwner();
      const storedOwner = (item as Owned<T>)[OWNER_KEY];
      if (storedOwner && storedOwner !== owner) {
        throw new Error("Registro offline pertence a outra conta do Pilar Campo.");
      }
      const existentes = await lerTudo<T>(nome);
      if (existentes.some((x) => x.id === item.id && x[OWNER_KEY] !== owner)) {
        throw new Error("Registro offline existente pertence a outra conta ou está sem identificação.");
      }
      if (ownerAtual() !== owner) throw new Error("A conta mudou durante a gravação offline.");
      const db = await abrirDb();
      if (ownerAtual() !== owner) throw new Error("A conta mudou durante a gravação offline.");
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(nome, "readwrite");
        tx.objectStore(nome).put({ ...item, [OWNER_KEY]: owner });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
    async remover(id) {
      // A fila pode terminar um envio após logout: não apaga itens sem a
      // identidade correta, mas também não transforma esse caso em erro fatal.
      const owner = ownerAtual();
      if (!owner) return;
      const existentes = await lerTudo<T>(nome);
      if (!existentes.some((x) => x.id === id && x[OWNER_KEY] === owner)) return;
      if (ownerAtual() !== owner) return;
      const db = await abrirDb();
      if (ownerAtual() !== owner) return;
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(nome, "readwrite");
        tx.objectStore(nome).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
  };
}

/**
 * Apenas contagem, sem expor texto, fotos, áudio, ids ou dados de quem criou.
 * A versão anterior não gravava identidade; associar esses dados ao próximo
 * login seria inseguro. Um fluxo de recuperação assistida pode ser criado depois.
 */
export async function contarPendenciasAntigas(): Promise<number> {
  const [dias, registros] = await Promise.all([
    lerTudo<FilaDiaItem>(STORE_DIAS),
    lerTudo<FilaRegistroItem>(STORE_REGISTROS),
  ]);
  return [...dias, ...registros].filter((item) => !item[OWNER_KEY]).length;
}

export const filaOfflineDb: FilaStore = criarStore<FilaDiaItem>(STORE_DIAS);
export const filaRegistroDb: RegistroFilaStore = criarStore<FilaRegistroItem>(STORE_REGISTROS);
