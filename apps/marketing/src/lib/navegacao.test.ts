import { describe, expect, it } from "vitest";
import { COMPARATIVOS } from "./comparativos";
import { MODULOS } from "./modules";
import { AREAS, PAGINAS_RECURSO, caminhoRecurso } from "./catalogo";
import { COLUNAS_MENU, COMPARATIVOS_NAV, MODULOS_NAV } from "./navegacao";

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

describe("mega-menu de Funcionalidades", () => {
  it("tem uma coluna por área do catálogo, na mesma ordem", () => {
    expect(COLUNAS_MENU.map((c) => c.id)).toEqual(AREAS.map((a) => a.id));
  });

  it("cada página de recurso aparece uma vez, na coluna da sua área", () => {
    for (const p of PAGINAS_RECURSO) {
      const colunas = COLUNAS_MENU.filter((c) => c.links.some((l) => l.to === caminhoRecurso(p.slug)));
      expect(
        colunas.map((c) => c.id),
        p.slug
      ).toEqual([p.area]);
    }
  });
});
