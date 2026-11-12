import { useCallback, useState, useSyncExternalStore } from "react";
import { analytics } from "@/lib/analytics";
import { abrirInstalacaoNativa, assinarInstalacao, lerEstadoInstalacao, type PublicoApp } from "@/lib/instalarApp";
import { InstrucoesInstalar } from "@/components/instalar/InstrucoesInstalar";

/** De onde a pessoa pediu para instalar (propriedade do evento, nunca texto livre). */
export type OrigemInstalar = "convite" | "menu";

/**
 * Ação "Instalar o Pilar" pronta para qualquer tela: decide entre a janela
 * nativa (Android com o evento guardado) e os passos (iPhone, ou Android sem o
 * evento). `dialogo` é o painel de passos; a tela só precisa renderizá-lo.
 */
export function useInstalarApp(publico: PublicoApp, origem: OrigemInstalar) {
  const estado = useSyncExternalStore(assinarInstalacao, lerEstadoInstalacao, lerEstadoInstalacao);
  const [passosAbertos, setPassosAbertos] = useState(false);

  const disponivel = estado.plataforma === "ios" || estado.plataforma === "android";
  const nativo = estado.plataforma === "android" && estado.promptNativo !== null;

  const instalar = useCallback(async () => {
    const plataforma = lerEstadoInstalacao().plataforma;
    if (plataforma === "android" && lerEstadoInstalacao().promptNativo) {
      const aceitou = await abrirInstalacaoNativa();
      analytics.track("app_instalar_acao", { plataforma, publico, origem, modo: "nativo", aceitou });
      return;
    }
    analytics.track("app_instalar_acao", { plataforma, publico, origem, modo: "passos" });
    setPassosAbertos(true);
  }, [publico, origem]);

  const dialogo =
    estado.plataforma === "ios" || estado.plataforma === "android" ? (
      <InstrucoesInstalar plataforma={estado.plataforma} open={passosAbertos} onOpenChange={setPassosAbertos} />
    ) : null;

  return { plataforma: estado.plataforma, disponivel, nativo, instalar, dialogo };
}
