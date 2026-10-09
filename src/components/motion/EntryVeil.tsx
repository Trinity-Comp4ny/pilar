import { useEffect, useState } from "react";
import { ReadingRing } from "./ReadingRing";
import { bootIsShowing, dismissBoot, setBootCaption } from "./boot";
import { isEntryVeilMounted, isOwnVeilShowing, veilMounted, veilUnmounted } from "./veilState";

const DEFAULT_LABEL = "Abrindo o Pilar";

/**
 * Véu de entrada (T02, ADR 0049): cobre a tela entre o login e a primeira tela do
 * app com o anel e "Abrindo {empresa}". Se o boot do index.html ainda está na
 * tela, o véu reaproveita o anel dele (troca só a legenda) em vez de montar outro.
 */
export function EntryVeil({ label }: { label?: string }) {
  const text = label ?? DEFAULT_LABEL;
  const [usesBoot] = useState(bootIsShowing);

  useEffect(() => {
    veilMounted(!usesBoot);
    return () => {
      if (!veilUnmounted(!usesBoot) || !usesBoot) return;
      window.setTimeout(() => {
        if (!isEntryVeilMounted()) dismissBoot();
      }, 0);
    };
  }, [usesBoot]);

  useEffect(() => {
    if (usesBoot) setBootCaption(text);
  }, [usesBoot, text]);

  if (usesBoot) {
    return (
      <span role="status" className="sr-only">
        {text}
      </span>
    );
  }

  return (
    <div role="status" aria-live="polite" className="entry-veil">
      <div className="entry-veil__body">
        <ReadingRing size={112} delay={0} />
        <p className="entry-veil__caption">{text}</p>
      </div>
    </div>
  );
}

/**
 * Saída do véu: montado pelo Layout, cobre o app recém-montado com a cor da página
 * e some em 360ms. Só aparece no lugar de um véu próprio; o boot sai sozinho.
 */
export function VeilExit() {
  const [show, setShow] = useState(isOwnVeilShowing);

  useEffect(() => {
    if (!show) return;
    const id = window.setTimeout(() => setShow(false), 420);
    return () => window.clearTimeout(id);
  }, [show]);

  return show ? <div aria-hidden="true" className="veil-exit" /> : null;
}
