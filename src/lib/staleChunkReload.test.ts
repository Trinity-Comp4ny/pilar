import { describe, expect, it } from "vitest";
import { isStaleChunkError } from "./staleChunkReload";

/**
 * As mensagens abaixo são as REAIS que o Sentry registrou neste projeto, não
 * invenções. Se alguém apertar a regex e uma delas voltar a ser tratada como erro
 * de aplicação, o usuário passa a ver tela de erro depois de deploy outra vez.
 */
describe("isStaleChunkError: assinaturas vistas em produção", () => {
  it("PILAR-D: React.lazy recebeu módulo sem default (fallback de SPA)", () => {
    expect(
      isStaleChunkError(new TypeError("Cannot read properties of undefined (reading 'default')"))
    ).toBe(true);
  });

  it("PILAR-6: importing a module script failed", () => {
    expect(isStaleChunkError(new TypeError("Importing a module script failed."))).toBe(true);
  });

  it("PILAR-5: variante do Safari, avaliando .default", () => {
    expect(
      isStaleChunkError(new TypeError("undefined is not an object (evaluating 't.SettingsDialog.default')"))
    ).toBe(true);
  });

  it("PILAR-4: failed to fetch dynamically imported module", () => {
    expect(
      isStaleChunkError(
        new TypeError(
          "Failed to fetch dynamically imported module: https://app.pilarsoft.com.br/assets/SettingsDialog-CtdKNYD6.js"
        )
      )
    ).toBe(true);
  });

  it("host devolveu HTML no lugar do js", () => {
    expect(
      isStaleChunkError(
        new TypeError("Failed to load module script: Expected a JavaScript module script but the server responded with a MIME type of 'text/html'. Strict MIME type checking is enforced for module scripts per HTML spec.")
      )
    ).toBe(true);
  });
});

describe("isStaleChunkError: não confunde erro de verdade", () => {
  it("erro de RLS não vira reload", () => {
    expect(
      isStaleChunkError(new Error("new row violates row-level security policy for table \"clientes\""))
    ).toBe(false);
  });

  it("undefined em outra propriedade não vira reload", () => {
    expect(
      isStaleChunkError(new TypeError("Cannot read properties of undefined (reading 'nome')"))
    ).toBe(false);
  });

  it("erro sem mensagem não vira reload", () => {
    expect(isStaleChunkError(null)).toBe(false);
    expect(isStaleChunkError(undefined)).toBe(false);
    expect(isStaleChunkError({})).toBe(false);
  });
});
