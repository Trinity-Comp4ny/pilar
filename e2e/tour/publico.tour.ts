import { test } from "../fixtures";
import { Tour } from "./explorar";

// Telas sem login: entrada, cadastro, portais e páginas públicas.
const ROTAS: [string, string][] = [
  ["raiz", "/"],
  ["login", "/login"],
  ["cadastro", "/cadastro"],
  ["esqueci-senha", "/forgot-password"],
  ["nova-senha", "/reset-password"],
  ["planos", "/planos"],
  ["status", "/status"],
  ["termos", "/termos"],
  ["proposta-compartilhada", "/proposta-compartilhada"],
  ["cotar-token-invalido", "/cotar/token-de-exemplo"],
  ["oauth-autorizar", "/oauth/autorizar"],
  ["cliente-login", "/cliente/login"],
  ["cliente-convite", "/cliente/convite"],
  ["campo-login", "/campo/login"],
  ["campo-convite", "/campo/convite"],
  ["nao-existe", "/rota-que-nao-existe"],
];

for (const [tela, rota] of ROTAS) {
  test(`publico · ${tela}`, async ({ page }) => {
    test.setTimeout(4 * 60_000);
    await new Tour(page, "publico", tela, rota, { orcamentoMs: 60_000, maxProf: 1 }).rodar();
  });
}
