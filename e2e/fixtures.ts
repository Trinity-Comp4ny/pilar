/* eslint-disable react-hooks/rules-of-hooks, no-empty-pattern */
// Playwright fixtures: `use` é o callback do framework de testes (não React Hook),
// e o destructuring `{}` é o pattern oficial quando não há fixtures upstream.
import { test as base, expect } from "@playwright/test";

/**
 * Fixtures compartilhadas para specs autenticados.
 *
 * - `testEmpresa`: nome/slug previsíveis para criação de dados em testes que
 *   precisem isolar registros. NÃO cria nada no banco — fornece apenas
 *   identificadores estáveis para uso em forms/asserts.
 * - `cleanupAfter`: array onde os specs podem registrar callbacks async para
 *   limpeza de dados criados; tudo é executado em ordem reversa no teardown.
 *
 * Uso:
 *   import { test, expect } from "./fixtures";
 *   test("cria receita", async ({ page, cleanupAfter }) => {
 *     // ... cria registro ...
 *     cleanupAfter.push(async () => { /* deleta registro *\/ });
 *   });
 */

export type TestEmpresa = {
  nome: string;
  slug: string;
};

type Fixtures = {
  testEmpresa: TestEmpresa;
  cleanupAfter: Array<() => Promise<void>>;
};

export const test = base.extend<Fixtures>({
  testEmpresa: async ({}, use, testInfo) => {
    const safe = testInfo.title
      .replace(/[^a-z0-9]+/gi, "-")
      .toLowerCase()
      .slice(0, 24);
    const stamp = Date.now().toString(36);
    await use({
      nome: `E2E ${safe} ${stamp}`,
      slug: `e2e-${safe}-${stamp}`,
    });
  },

  cleanupAfter: async ({}, use) => {
    const callbacks: Array<() => Promise<void>> = [];
    await use(callbacks);
    for (const cb of callbacks.reverse()) {
      try {
        await cb();
      } catch (err) {
        // Não falha o teste por erro de cleanup — apenas reporta.
        console.warn("[fixtures] cleanup callback falhou:", err);
      }
    }
  },
});

export { expect };
