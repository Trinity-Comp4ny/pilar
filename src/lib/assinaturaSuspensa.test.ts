import { describe, it, expect, vi } from "vitest";
import { avisarAssinaturaSuspensa, EVENTO_ASSINATURA_SUSPENSA, ehErroDeAssinaturaSuspensa } from "./assinaturaSuspensa";
import { getSafeErrorMessage } from "./safeError";

describe("assinatura suspensa", () => {
  it("reconhece o erro do banco em Error, PostgrestError e texto", () => {
    expect(ehErroDeAssinaturaSuspensa(new Error("empresa_assinatura_suspensa"))).toBe(true);
    expect(ehErroDeAssinaturaSuspensa({ message: "P0001: empresa_assinatura_suspensa" })).toBe(true);
    expect(ehErroDeAssinaturaSuspensa("empresa_assinatura_suspensa")).toBe(true);
    expect(ehErroDeAssinaturaSuspensa(new Error("outro erro"))).toBe(false);
    expect(ehErroDeAssinaturaSuspensa(null)).toBe(false);
  });

  it("avisar dispara o evento que o gate escuta", () => {
    const ouvinte = vi.fn();
    window.addEventListener(EVENTO_ASSINATURA_SUSPENSA, ouvinte);
    avisarAssinaturaSuspensa();
    window.removeEventListener(EVENTO_ASSINATURA_SUSPENSA, ouvinte);
    expect(ouvinte).toHaveBeenCalledTimes(1);
  });

  it("a mensagem para o usuário é clara e não vaza o código do banco", () => {
    const msg = getSafeErrorMessage({ message: "empresa_assinatura_suspensa" });
    expect(msg).toMatch(/assinatura da sua empresa está suspensa/);
    expect(msg).not.toMatch(/empresa_assinatura/);
    expect(getSafeErrorMessage({ message: "empresa_em_leitura" })).toMatch(/somente leitura/);
  });
});
