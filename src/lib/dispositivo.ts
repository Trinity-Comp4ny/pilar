/**
 * Navegador da conta (SPEC 159): id aleatório guardado no próprio navegador, sem impressão
 * digital do aparelho. Limpar os dados do navegador gera um id novo (e um alerta de acesso novo).
 */
const CHAVE = "pilar:dispositivo";

export function idDoDispositivo(): string | null {
  try {
    const salvo = localStorage.getItem(CHAVE);
    if (salvo && /^[0-9a-f-]{36}$/i.test(salvo)) return salvo;
    const novo = crypto.randomUUID();
    localStorage.setItem(CHAVE, novo);
    return novo;
  } catch {
    // Sem storage (aba privada, bloqueio): não registra, para não alertar a cada visita.
    return null;
  }
}

/** "Chrome no Windows", "Safari no iPhone". Só para a pessoa reconhecer o acesso. */
export function descricaoDoNavegador(ua: string): string {
  const navegador = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Navegador";
  const sistema = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Windows/.test(ua)
          ? "Windows"
          : /Mac OS X|Macintosh/.test(ua)
            ? "Mac"
            : /Linux/.test(ua)
              ? "Linux"
              : null;
  return sistema ? `${navegador} no ${sistema}` : navegador;
}
