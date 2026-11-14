/**
 * Número no ícone do app instalado (Badging API). Funciona no PWA instalado (Android, iOS 16.4+,
 * desktop); em aba comum e em navegadores sem suporte, é no-op. Só atualiza com o app aberto:
 * badge com o app fechado depende de push (ainda não existe no Pilar).
 */
interface NavegadorComBadge {
  setAppBadge?: (n?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
}

export function definirBadgeApp(total: number): void {
  if (typeof navigator === "undefined") return;
  const nav = navigator as Navigator & NavegadorComBadge;
  const n = Math.max(0, Math.floor(total));
  try {
    if (n > 0) void nav.setAppBadge?.(n)?.catch(() => undefined);
    else void nav.clearAppBadge?.()?.catch(() => undefined);
  } catch {
    // Cosmético.
  }
}
