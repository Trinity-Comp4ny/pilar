import { useEffect, useRef } from "react";

interface Snapshot<T> {
  values: T;
  step?: number;
  savedAt: number;
}

interface Options<T> {
  /** Chave lógica do rascunho (sem prefixo). */
  storageKey: string;
  /** Valores atuais do form, salvos a cada mudança. */
  values: T;
  /** Passo atual (forms em etapas). Opcional. */
  step?: number;
  /** Chamado ao restaurar um rascunho válido. */
  onRestore: (snapshot: { values: T; step?: number }) => void;
  /** TTL em horas (padrão 24). Rascunhos mais antigos são descartados. */
  ttlHours?: number;
  /**
   * Quando false, não persiste nem restaura (ex.: modo edição ou dialog fechado).
   * O rascunho é restaurado quando `enabled` passa a true (ou no mount, se já true).
   */
  enabled?: boolean;
}

const PREFIX = "pilar-form:";

/**
 * Persiste o rascunho de um form no localStorage e o restaura na próxima abertura.
 *
 * - TTL de 24h: rascunho vencido é apagado e ignorado.
 * - Snapshot corrompido (JSON inválido) é descartado silenciosamente.
 * - Só persiste depois de restaurar, para não sobrescrever o rascunho salvo
 *   com o estado inicial vazio do form.
 */
export function useFormPersist<T>({
  storageKey,
  values,
  step,
  onRestore,
  ttlHours = 24,
  enabled = true,
}: Options<T>) {
  const key = PREFIX + storageKey;
  const restoredRef = useRef(false);
  // Mantém a referência mais recente do callback sem re-disparar o efeito de restauração.
  const onRestoreRef = useRef(onRestore);
  onRestoreRef.current = onRestore;

  // Restaura ao habilitar (ou no mount, se já habilitado).
  useEffect(() => {
    if (!enabled) {
      restoredRef.current = false;
      return;
    }
    if (restoredRef.current) return;
    restoredRef.current = true;
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return;
      const snapshot = JSON.parse(raw) as Snapshot<T>;
      const ageMs = Date.now() - snapshot.savedAt;
      if (ageMs > ttlHours * 60 * 60 * 1000) {
        window.localStorage.removeItem(key);
        return;
      }
      onRestoreRef.current({ values: snapshot.values, step: snapshot.step });
    } catch {
      // Snapshot corrompido: descarta.
      try {
        window.localStorage.removeItem(key);
      } catch {
        /* localStorage indisponível */
      }
    }
  }, [enabled, key, ttlHours]);

  // Persiste enquanto habilitado e após a restauração inicial.
  useEffect(() => {
    if (!enabled || !restoredRef.current) return;
    if (typeof window === "undefined") return;
    try {
      const snapshot: Snapshot<T> = { values, step, savedAt: Date.now() };
      window.localStorage.setItem(key, JSON.stringify(snapshot));
    } catch {
      // Storage cheio ou desabilitado: ignora.
    }
  }, [key, values, step, enabled]);
}

/** Apaga o rascunho persistido (chamar após submit bem-sucedido). */
export function clearFormPersist(storageKey: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PREFIX + storageKey);
  } catch {
    /* localStorage indisponível */
  }
}
