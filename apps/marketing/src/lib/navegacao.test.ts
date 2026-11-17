import { describe, expect, it } from "vitest";
import { COMPARATIVOS } from "./comparativos";
import { MODULOS } from "./modules";
import { COMPARATIVOS_NAV, MODULOS_NAV } from "./navegacao";

describe("navegacao.ts acompanha as fontes completas", () => {
  it("módulos: mesma ordem, nome, resumo e cor do ponto", () => {
    expect(MODULOS_NAV).toEqual(
      MODULOS.map((m) => ({ slug: m.slug, nome: m.nome, resumo: m.resumo, corStrong: m.cor.strong }))
    );
  });

  it("comparativos: mesma ordem e adversário", () => {
    expect(COMPARATIVOS_NAV).toEqual(COMPARATIVOS.map((c) => ({ slug: c.slug, adversario: c.adversario })));
  });
});
