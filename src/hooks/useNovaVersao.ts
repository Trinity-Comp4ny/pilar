import { useEffect, useRef } from "react";
import { toast } from "sonner";

/**
 * Avisa quem está com a aba aberta que saiu deploy novo.
 *
 * Existe por causa de um incidente real: depois do hardening de escrita
 * financeira, uma conta ficou dias batendo 403 porque o navegador seguia
 * rodando o bundle de duas semanas antes, que lia colunas cujo acesso a
 * migration revogou. O erro era invisível para quem não abre o Sentry, e a
 * pessoa não tinha como saber que bastava recarregar.
 *
 * O build escreve o SHA do deploy em /version.json (ver vite.config.ts) e o
 * bundle carrega o seu próprio em __SENTRY_RELEASE__. Divergência entre os dois
 * significa que o servidor já está servindo outra versão.
 *
 * Nunca recarrega sozinho: quem está no meio de um formulário perderia o que
 * digitou. Só oferece o botão.
 */

const INTERVALO_MS = 15 * 60 * 1000;

async function releaseDoServidor(): Promise<string | null> {
  try {
    // no-store: sem isto o próprio arquivo de versão vem do cache e o aviso
    // nunca aparece.
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    const body: unknown = await res.json();
    const release = (body as { release?: unknown })?.release;
    return typeof release === "string" && release ? release : null;
  } catch {
    // Offline ou deploy em andamento: tenta de novo na próxima checagem.
    return null;
  }
}

export function useNovaVersao(): void {
  const avisado = useRef(false);

  useEffect(() => {
    // "dev" é o valor fora da Vercel: em desenvolvimento não há deploy pra comparar.
    const releaseLocal = __SENTRY_RELEASE__;
    if (!releaseLocal || releaseLocal === "dev") return;

    let cancelado = false;

    const checar = async () => {
      if (cancelado || avisado.current || document.visibilityState !== "visible") return;
      const remoto = await releaseDoServidor();
      if (cancelado || !remoto || remoto === releaseLocal) return;

      avisado.current = true;
      toast.info("Nova versão disponível", {
        description: "Recarregue para usar a versão mais recente do Pilar.",
        duration: Infinity,
        action: {
          label: "Recarregar",
          onClick: () => window.location.reload(),
        },
      });
    };

    // Voltar pra aba é o momento mais provável de estar desatualizado.
    document.addEventListener("visibilitychange", checar);
    const timer = window.setInterval(checar, INTERVALO_MS);
    void checar();

    return () => {
      cancelado = true;
      document.removeEventListener("visibilitychange", checar);
      window.clearInterval(timer);
    };
  }, []);
}
