import { useSyncExternalStore } from "react";

/**
 * Onde as faixas de sistema (somente leitura, "visualizando como") se encaixam: o bloco fixo
 * do topo do Layout (FaixasDoTopo), cuja altura vira `--faixas-h` e empurra as páginas. Elas
 * são montadas fora do Layout (App, PrivateRoute); sem o bloco (tela fora do app, teste),
 * seguem fixas por conta própria. Antes cobriam os 36 px de cima do cabeçalho.
 */
let alvo: HTMLElement | null = null;
const ouvintes = new Set<() => void>();

export function registrarAlvoFaixas(el: HTMLElement | null) {
  alvo = el;
  ouvintes.forEach((f) => f());
}

function assinar(f: () => void) {
  ouvintes.add(f);
  return () => ouvintes.delete(f);
}

export function useAlvoFaixas(): HTMLElement | null {
  return useSyncExternalStore(
    assinar,
    () => alvo,
    () => null
  );
}
