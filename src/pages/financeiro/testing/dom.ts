import { screen } from "@testing-library/react";

function subirAte<T extends Element>(rotulo: string | RegExp, achar: (el: HTMLElement) => T | null): T {
  const label = screen.getByText(rotulo, { selector: "label" });
  let el: HTMLElement | null = label.parentElement;
  while (el) {
    const achado = achar(el);
    if (achado) return achado;
    el = el.parentElement;
  }
  throw new Error(`campo "${String(rotulo)}" não encontrado`);
}

/**
 * `<select>` (ver nativeSelect) do campo cujo rótulo visível é `rotulo`. Os
 * Labels do financeiro não têm htmlFor, então sobe do rótulo até o bloco do campo.
 */
export function campoSelect(rotulo: string | RegExp): HTMLSelectElement {
  return subirAte(rotulo, (el) => el.querySelector("select"));
}

/** `<input>` do campo cujo rótulo visível é `rotulo` (mesma regra de `campoSelect`). */
export function campoInput(rotulo: string | RegExp): HTMLInputElement {
  return subirAte(rotulo, (el) => el.querySelector("input"));
}
