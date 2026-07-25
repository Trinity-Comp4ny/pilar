import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Recentes da home Início (spec 001-shell-3-pilares).
 * Persistidos em localStorage POR USUÁRIO para não vazar entre contas no mesmo
 * browser. Máximo de 8, dedupe por rota, mais recente primeiro.
 */
export type RecenteTipo = "projeto" | "cliente" | "fatura" | "proposta" | "lead" | "pagina";

export type Recente = {
  tipo: RecenteTipo;
  rota: string;
  label: string;
  ts: number;
};

const MAX_RECENTES = 8;
const keyFor = (userId: string) => `pilar.recentes.${userId}`;

// useSyncExternalStore para todas as instâncias do hook re-renderizarem juntas.
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

const cache = new Map<string, Recente[]>();

function readStore(userId: string | null): Recente[] {
  if (!userId) return [];
  const cached = cache.get(userId);
  if (cached) return cached;
  let parsed: Recente[] = [];
  try {
    const raw = localStorage.getItem(keyFor(userId));
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    if (Array.isArray(arr)) {
      parsed = arr.filter(
        (r): r is Recente =>
          !!r &&
          typeof r === "object" &&
          typeof (r as Recente).rota === "string" &&
          typeof (r as Recente).label === "string"
      );
    }
  } catch {
    parsed = [];
  }
  cache.set(userId, parsed);
  return parsed;
}

export function useRecentes() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const recentes = useSyncExternalStore(
    subscribe,
    () => readStore(userId),
    () => [] as Recente[]
  );

  const registrar = useCallback(
    (r: Omit<Recente, "ts">) => {
      if (!userId) return;
      const atual = readStore(userId);
      const next = [{ ...r, ts: Date.now() }, ...atual.filter((x) => x.rota !== r.rota)].slice(0, MAX_RECENTES);
      cache.set(userId, next);
      try {
        localStorage.setItem(keyFor(userId), JSON.stringify(next));
      } catch {
        // storage indisponível: recentes viram best-effort em memória.
      }
      emit();
    },
    [userId]
  );

  return { recentes, registrar };
}

/**
 * Atalho para páginas de lista: registra a visita uma vez ao montar.
 * Para entidades (projeto, cliente), use registrar() quando o dado carregar.
 */
export function useRegistrarPagina(tipo: RecenteTipo, rota: string, label: string) {
  const { registrar } = useRecentes();
  useEffect(() => {
    registrar({ tipo, rota, label });
  }, [tipo, rota, label, registrar]);
}
