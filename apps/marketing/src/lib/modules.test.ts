import { describe, expect, it } from "vitest";
import { MODULOS, MODULOS_POR_SLUG, type ModuloSlug } from "./modules";
import { COMPARATIVOS, COMPARATIVOS_POR_SLUG } from "./comparativos";

const SLUGS_MODULO: ModuloSlug[] = ["gestao", "projetos", "obra", "portal", "campo"];

const preenchido = (s: string) => s.trim().length > 0;

describe("MODULOS", () => {
  it("tem os cinco módulos na ordem do menu, com slug único", () => {
    expect(MODULOS.map((m) => m.slug)).toEqual(SLUGS_MODULO);
  });

  it("MODULOS_POR_SLUG aponta para o mesmo objeto de cada módulo", () => {
    expect(Object.keys(MODULOS_POR_SLUG).sort()).toEqual([...SLUGS_MODULO].sort());
    for (const m of MODULOS) expect(MODULOS_POR_SLUG[m.slug]).toBe(m);
  });

  it.each(MODULOS.map((m) => [m.slug, m] as const))(
    "%s tem título, descrição, URL do mock e cores preenchidos",
    (_slug, m) => {
      for (const campo of [m.numero, m.nome, m.resumo, m.headline, m.headlineFim, m.lede, m.url]) {
        expect(preenchido(campo)).toBe(true);
      }
      expect(m.url).toMatch(/^app\.pilarsoft\.com\.br\//);
      for (const classe of Object.values(m.cor)) expect(preenchido(classe)).toBe(true);
    }
  );

  it.each(MODULOS.map((m) => [m.slug, m] as const))(
    "%s tem FAQ com pelo menos três perguntas, sem repetir pergunta",
    (_slug, m) => {
      // Parte das "perguntas" é objeção afirmativa ("O canteiro não tem sinal."),
      // então o teste não exige ponto de interrogação, só texto.
      expect(m.faq.length).toBeGreaterThanOrEqual(3);
      for (const f of m.faq) {
        expect(preenchido(f.pergunta)).toBe(true);
        expect(preenchido(f.resposta)).toBe(true);
      }
      expect(new Set(m.faq.map((f) => f.pergunta)).size).toBe(m.faq.length);
    }
  );

  it.each(MODULOS.map((m) => [m.slug, m] as const))(
    "%s tem grupos com print em /screens e features preenchidas",
    (_slug, m) => {
      expect(m.grupos.length).toBeGreaterThan(0);
      for (const g of m.grupos) {
        expect(preenchido(g.titulo)).toBe(true);
        expect(preenchido(g.frase)).toBe(true);
        expect(g.img).toMatch(/^\/screens\/[a-z-]+\.png$/);
        expect(g.features.length).toBeGreaterThan(0);
        for (const f of g.features) {
          expect(preenchido(f.titulo)).toBe(true);
          expect(preenchido(f.texto)).toBe(true);
        }
      }
      // A key do React na página é o título do grupo e o da feature.
      expect(new Set(m.grupos.map((g) => g.titulo)).size).toBe(m.grupos.length);
    }
  );

  it("o mock de celular só aparece nos grupos do Campo", () => {
    for (const m of MODULOS) {
      for (const g of m.grupos) {
        expect(g.mock.startsWith("campo")).toBe(m.slug === "campo");
      }
    }
  });

  it("'Conecta com' só aponta para outro módulo existente, sem repetir", () => {
    for (const m of MODULOS) {
      const alvos = m.conecta.map((c) => c.slug);
      for (const alvo of alvos) {
        expect(SLUGS_MODULO).toContain(alvo);
        expect(alvo).not.toBe(m.slug);
      }
      expect(new Set(alvos).size).toBe(alvos.length);
      for (const c of m.conecta) expect(preenchido(c.texto)).toBe(true);
    }
  });
});

describe("COMPARATIVOS", () => {
  it("tem os cinco comparativos, indexados por slug", () => {
    expect(COMPARATIVOS.map((c) => c.slug)).toEqual(["planilha", "trello", "whatsapp", "notion", "erp-construtora"]);
    for (const c of COMPARATIVOS) expect(COMPARATIVOS_POR_SLUG[c.slug]).toBe(c);
  });

  it.each(COMPARATIVOS.map((c) => [c.slug, c] as const))(
    "vs %s tem título, descrição, tabela, sinais de migração e FAQ",
    (_slug, c) => {
      for (const campo of [c.adversario, c.headline, c.headlineFim, c.lede]) {
        expect(preenchido(campo)).toBe(true);
      }
      expect(c.linhas.length).toBeGreaterThan(0);
      for (const l of c.linhas) {
        expect(preenchido(l.criterio)).toBe(true);
        expect(preenchido(l.pilar)).toBe(true);
        if (l.alternativa !== false) expect(preenchido(l.alternativa)).toBe(true);
      }
      expect(new Set(c.linhas.map((l) => l.criterio)).size).toBe(c.linhas.length);
      expect(c.quandoMigrar.length).toBeGreaterThan(0);
      expect(c.faq.length).toBeGreaterThan(0);
      for (const f of c.faq) {
        expect(preenchido(f.pergunta)).toBe(true);
        expect(preenchido(f.resposta)).toBe(true);
      }
    }
  );
});
