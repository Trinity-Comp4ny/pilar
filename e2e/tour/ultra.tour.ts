import { test } from "../fixtures";
import { Tour } from "./explorar";

// Telas de plataforma (ultra admin do seed). Exploração curta: são telas internas.
const SUB = [
  "", "empresas", "empresas/00000000-0000-0000-0000-000000000001", "usuarios", "testes", "funcionalidades",
  "feedback", "releases", "ajuda", "satisfacao", "dores", "reunioes", "prospeccao", "cerebro",
  "comunicados", "previas", "atividade", "incidentes", "custos-ia", "estimativa", "lgpd", "time",
];

for (const s of SUB) {
  const tela = s === "" ? "inicio" : s.startsWith("empresas/") ? "empresa-detalhe" : s;
  test(`plataforma · ${tela}`, async ({ page }) => {
    test.setTimeout(5 * 60_000);
    await new Tour(page, "plataforma", tela, `/ultra-admin${s ? `/${s}` : ""}`, {
      orcamentoMs: 120_000,
      maxProf: 1,
    }).rodar();
  });
}
