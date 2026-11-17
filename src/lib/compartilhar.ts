import { haptico } from "./haptico";

/**
 * Compartilhar (celular): abre a folha nativa do sistema (WhatsApp, E-mail, Mensagens...), que é
 * o jeito normal de mandar proposta ou link do portal para cliente. Fora do celular, ou quando o
 * navegador não oferece `navigator.share`, cai em copiar para a área de transferência.
 */
export interface DadosCompartilhar {
  titulo?: string;
  texto?: string;
  url?: string;
}

export type ResultadoCompartilhar = "compartilhado" | "copiado" | "cancelado" | "falhou";

/** A folha nativa só vale em tela de toque: no desktop o Chrome abre um menu pobre, copiar é melhor. */
export function temCompartilharNativo(): boolean {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") return false;
  return !!window.matchMedia?.("(pointer: coarse)").matches;
}

export async function compartilhar(dados: DadosCompartilhar): Promise<ResultadoCompartilhar> {
  const payload: ShareData = { title: dados.titulo, text: dados.texto, url: dados.url };

  if (temCompartilharNativo() && (!navigator.canShare || navigator.canShare(payload))) {
    try {
      await navigator.share(payload);
      haptico("sucesso");
      return "compartilhado";
    } catch (e) {
      // Fechar a folha sem escolher não é erro.
      if (e instanceof DOMException && e.name === "AbortError") return "cancelado";
      // Qualquer outra falha cai no copiar.
    }
  }

  const texto = [dados.texto, dados.url].filter(Boolean).join("\n");
  try {
    await navigator.clipboard.writeText(texto);
    return "copiado";
  } catch {
    return "falhou";
  }
}

/** Link `wa.me` para quem quer o WhatsApp direto (desktop incluído). */
export function linkWhatsApp(texto: string, url?: string): string {
  const mensagem = [texto, url].filter(Boolean).join("\n");
  return `https://wa.me/?text=${encodeURIComponent(mensagem)}`;
}
