import type { UserEvent } from "@testing-library/user-event";
import { screen, within } from "@testing-library/react";

/** Abre o menu de três pontinhos da linha (RowActions) e escolhe a ação pelo nome. */
export async function clicarAcao(user: UserEvent, linha: HTMLElement, acao: string) {
  await user.click(within(linha).getByRole("button", { name: /^Mais ações/ }));
  await user.click(await screen.findByRole("menuitem", { name: acao }));
}

/** Variante pelo nome da linha: abre "Mais ações de <nome>" e escolhe a ação. */
export async function clicarAcaoDe(user: UserEvent, nome: string, acao: string) {
  await user.click(screen.getByRole("button", { name: `Mais ações de ${nome}` }));
  await user.click(await screen.findByRole("menuitem", { name: acao }));
}

/** Abre o menu de "<nome>" e devolve o item da ação (para checar desabilitado). */
export async function itemDeAcao(user: UserEvent, nome: string, acao: string) {
  await user.click(screen.getByRole("button", { name: `Mais ações de ${nome}` }));
  return screen.findByRole("menuitem", { name: acao });
}
