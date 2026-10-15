// Ordenação única dos quadros Kanban (Tarefas, Projetos, Leads). Cada quadro
// declara quais chaves suporta e como ler o valor de cada uma; o resto (rótulos,
// direção, vazio por último, empate estável) é daqui, para o controle ser igual
// em todo lugar. Ver SPEC 122.
export type KanbanSortKey = "priority" | "dueDate" | "value" | "name" | "created";
export type KanbanSortDir = "asc" | "desc";
export type KanbanSort = { key: KanbanSortKey; dir: KanbanSortDir };

export const KANBAN_SORT_KEYS: readonly KanbanSortKey[] = ["priority", "dueDate", "value", "name", "created"];

export const KANBAN_SORT_LABELS: Record<KanbanSortKey, string> = {
  priority: "Prioridade",
  dueDate: "Previsão",
  value: "Valor",
  name: "Nome",
  created: "Criação",
};

/** Rótulo de cada direção, na linguagem da chave ("Alta primeiro", não "Crescente"). */
export const KANBAN_SORT_DIR_LABELS: Record<KanbanSortKey, Record<KanbanSortDir, string>> = {
  priority: { asc: "Alta primeiro", desc: "Baixa primeiro" },
  dueDate: { asc: "Mais próxima primeiro", desc: "Mais distante primeiro" },
  value: { asc: "Menor primeiro", desc: "Maior primeiro" },
  name: { asc: "A a Z", desc: "Z a A" },
  created: { asc: "Mais antigos primeiro", desc: "Mais recentes primeiro" },
};

export function isKanbanSortKey(v: unknown): v is KanbanSortKey {
  return typeof v === "string" && (KANBAN_SORT_KEYS as readonly string[]).includes(v);
}

export function isKanbanSortDir(v: unknown): v is KanbanSortDir {
  return v === "asc" || v === "desc";
}

/** Lê "chave.direção" (formato da URL e do localStorage). Valor inválido cai no padrão. */
export function parseKanbanSort(raw: string | null | undefined, fallback: KanbanSort): KanbanSort {
  const [key, dir] = (raw ?? "").split(".");
  return { key: isKanbanSortKey(key) ? key : fallback.key, dir: isKanbanSortDir(dir) ? dir : fallback.dir };
}

export function formatKanbanSort(sort: KanbanSort): string {
  return `${sort.key}.${sort.dir}`;
}

type Valor = number | string | null | undefined;

/**
 * Como ler cada chave num item. `priority` devolve o peso (0 = alta). Chave sem
 * leitor mantém a ordem original do servidor (`created` é a ordem em que o
 * servidor entrega: mais recentes primeiro).
 */
export type KanbanSortAccessors<T> = Partial<Record<KanbanSortKey, (item: T) => Valor>>;

function comparar(a: number | string, b: number | string): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "pt-BR");
}

/**
 * Ordena sem mutar. Valor vazio (sem data, sem valor) vai para o fim nas duas
 * direções. Empate preserva a ordem de entrada.
 */
export function ordenarKanban<T>(items: readonly T[], sort: KanbanSort, accessors: KanbanSortAccessors<T>): T[] {
  const ler = accessors[sort.key];
  const sinal = sort.dir === "asc" ? 1 : -1;

  if (!ler) {
    // Ordem do servidor = mais recentes primeiro; "asc" inverte.
    return sort.key === "created" && sort.dir === "asc" ? [...items].reverse() : [...items];
  }

  return items
    .map((item, index) => ({ item, index, valor: ler(item) }))
    .sort((a, b) => {
      const va = a.valor;
      const vb = b.valor;
      const aVazio = va === null || va === undefined || va === "";
      const bVazio = vb === null || vb === undefined || vb === "";
      if (aVazio && bVazio) return a.index - b.index;
      if (aVazio) return 1;
      if (bVazio) return -1;
      return comparar(va as number | string, vb as number | string) * sinal || a.index - b.index;
    })
    .map(({ item }) => item);
}
