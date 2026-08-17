import { useCallback, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

export type RecentItem = {
  tipo: string;
  id: string;
  label: string;
  rota: string;
  ts: number;
};

export type RecentItemInput = Omit<RecentItem, "ts">;

const MAX_RECENTES = 8;

const recentesKey = (profileId: string) => `pilar:recentes:${profileId}`;
const favoritosKey = (profileId: string) => `pilar:favoritos:${profileId}`;

const mesmoItem = (a: { tipo: string; id: string }, b: { tipo: string; id: string }) =>
  a.tipo === b.tipo && a.id === b.id;

function ler(key: string | null): RecentItem[] {
  if (!key) return [];
  try {
    const raw = localStorage.getItem(key);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (r): r is RecentItem =>
        !!r &&
        typeof r === "object" &&
        typeof (r as RecentItem).tipo === "string" &&
        typeof (r as RecentItem).id === "string" &&
        typeof (r as RecentItem).label === "string" &&
        typeof (r as RecentItem).rota === "string"
    );
  } catch {
    return [];
  }
}

function gravar(key: string | null, itens: RecentItem[]) {
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(itens));
  } catch {
    // storage indisponível: mantém só em memória.
  }
}

/**
 * Recentes e favoritos do ⌘K, em localStorage namespaced por usuário para não
 * vazar entre contas no mesmo browser. Sem profileId, roda só em memória.
 */
export function useRecentItems() {
  const { profile } = useAuth();
  const profileId = profile?.id ?? null;
  const keyRecentes = profileId ? recentesKey(profileId) : null;
  const keyFavoritos = profileId ? favoritosKey(profileId) : null;

  const [recentesState, setRecentesState] = useState<RecentItem[]>(() => ler(keyRecentes));
  const [favoritosState, setFavoritosState] = useState<RecentItem[]>(() => ler(keyFavoritos));

  const record = useCallback(
    (item: RecentItemInput) => {
      setRecentesState((atual) => {
        const next = [{ ...item, ts: Date.now() }, ...atual.filter((x) => !mesmoItem(x, item))].slice(
          0,
          MAX_RECENTES
        );
        gravar(keyRecentes, next);
        return next;
      });
    },
    [keyRecentes]
  );

  const toggleFavorito = useCallback(
    (item: RecentItemInput) => {
      setFavoritosState((atual) => {
        const existe = atual.some((x) => mesmoItem(x, item));
        const next = existe
          ? atual.filter((x) => !mesmoItem(x, item))
          : [{ ...item, ts: Date.now() }, ...atual];
        gravar(keyFavoritos, next);
        return next;
      });
    },
    [keyFavoritos]
  );

  const isFavorito = useCallback(
    (item: { tipo: string; id: string }) => favoritosState.some((x) => mesmoItem(x, item)),
    [favoritosState]
  );

  const recentes = useCallback(() => recentesState, [recentesState]);
  const favoritos = useCallback(() => favoritosState, [favoritosState]);

  return { record, recentes, favoritos, toggleFavorito, isFavorito };
}
