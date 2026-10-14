import * as React from "react";

/**
 * Devolve o foco ao elemento que abriu o modal quando ele fecha.
 *
 * O Radix só devolve o foco ao `Trigger`. O app abre quase todo modal por estado
 * (`open={...}` a partir de um botão comum, sem `DialogTrigger`), então o Radix não tinha
 * para onde devolver e o foco caía no `<body>`: quem usa teclado perdia o lugar na página
 * a cada Esc ou Cancelar. Guarda o `activeElement` na abertura e o restaura no fechamento.
 *
 * Respeita um `onCloseAutoFocus` próprio que chame `preventDefault` (ex.: composer que
 * mantém o foco onde está), e só restaura se o elemento ainda estiver na página.
 */
export function useRestaurarFoco(
  onOpenAutoFocus?: (evento: Event) => void,
  onCloseAutoFocus?: (evento: Event) => void
) {
  const abertoPor = React.useRef<HTMLElement | null>(null);

  return {
    onOpenAutoFocus: (evento: Event) => {
      const ativo = document.activeElement;
      abertoPor.current = ativo instanceof HTMLElement && ativo !== document.body ? ativo : null;
      onOpenAutoFocus?.(evento);
    },
    onCloseAutoFocus: (evento: Event) => {
      onCloseAutoFocus?.(evento);
      const alvo = abertoPor.current;
      abertoPor.current = null;
      if (evento.defaultPrevented || !alvo?.isConnected) return;
      evento.preventDefault();
      alvo.focus();
    },
  };
}
