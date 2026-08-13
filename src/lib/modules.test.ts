import { beforeEach, describe, expect, it } from "vitest";
import { moduleOfFeature, type FeatureKey } from "./features";
import {
  EMPRESA_ITEMS,
  MODULE_ORDER,
  MODULES,
  readUltimoModulo,
  routeToModule,
  saveUltimoModulo,
  ULTIMO_MODULO_KEY,
} from "./modules";

describe("routeToModule", () => {
  it("resolve rota exata de cada item de menu", () => {
    expect(routeToModule("/gestao/financeiro")).toBe("gestao");
    expect(routeToModule("/gestao/equipe")).toBe("gestao");
    expect(routeToModule("/obras/fornecedores")).toBe("obras");
    expect(routeToModule("/gestao/leads")).toBe("gestao");
    expect(routeToModule("/gestao/propostas")).toBe("gestao");
    expect(routeToModule("/gestao/clientes")).toBe("gestao");
    expect(routeToModule("/projetos")).toBe("projetos");
    expect(routeToModule("/projetos/calendario")).toBe("projetos");
    expect(routeToModule("/obras")).toBe("obras");
  });

  it("resolve sub-rotas por prefixo (detalhes)", () => {
    expect(routeToModule("/projetos/abc-123")).toBe("projetos");
    expect(routeToModule("/gestao/clientes/9f2/financeiro")).toBe("gestao");
    expect(routeToModule("/gestao/financeiro/lancamentos")).toBe("gestao");
  });

  it("não confunde prefixo parcial de segmento", () => {
    // "/projetos-x" não é sub-rota de "/projetos"
    expect(routeToModule("/projetosx")).toBeNull();
    expect(routeToModule("/gestaox")).toBeNull();
  });

  it("rotas transversais e desconhecidas retornam null", () => {
    expect(routeToModule("/inicio")).toBeNull();
    // /dashboard foi aposentado (spec 005): não pertence mais a nenhum módulo.
    expect(routeToModule("/dashboard")).toBeNull();
    // /relatorios virou aba do Financeiro: só redireciona, não é rota de módulo.
    expect(routeToModule("/relatorios")).toBeNull();
    expect(routeToModule("/agentes")).toBeNull();
    expect(routeToModule("/profile")).toBeNull();
    expect(routeToModule("/admin")).toBeNull();
    expect(routeToModule("/")).toBeNull();
    expect(routeToModule("/rota-que-nao-existe")).toBeNull();
  });

  it("ignora barra final", () => {
    expect(routeToModule("/gestao/financeiro/")).toBe("gestao");
    expect(routeToModule("/projetos/")).toBe("projetos");
  });

  it("rotas extras fora do menu pertencem a um módulo", () => {
    // /mapa e /rentabilidade são redirects; ainda classificam para o dono conceitual.
    expect(routeToModule("/mapa")).toBe("projetos");
    expect(routeToModule("/rentabilidade")).toBe("gestao");
  });
});

describe("integridade do mapa de módulos", () => {
  it("homeRoute de cada módulo existe entre os itens dele", () => {
    for (const id of MODULE_ORDER) {
      const m = MODULES[id];
      const urls = m.items.map((i) => i.url);
      expect(urls, `homeRoute de ${id}`).toContain(m.homeRoute);
    }
  });

  it("nenhuma URL se repete entre módulos e grupo Empresa", () => {
    const all = [
      ...MODULE_ORDER.flatMap((id) => MODULES[id].items.map((i) => i.url)),
      ...EMPRESA_ITEMS.map((i) => i.url),
    ];
    expect(new Set(all).size).toBe(all.length);
  });

  it("todo item de módulo resolve de volta para o próprio módulo", () => {
    for (const id of MODULE_ORDER) {
      for (const item of MODULES[id].items) {
        expect(routeToModule(item.url), item.url).toBe(id);
      }
    }
  });

  it("obras é módulo real; itens gated por obras ou suas sub-features (ADR 0011/0019)", () => {
    expect(MODULES.obras.emBreve).toBeUndefined();
    expect(MODULE_ORDER).toContain("obras");
    // Após spec 035, Fornecedores/Clima usam sub-features (obras_*); todas
    // resolvem para o módulo obras via moduleOfFeature.
    for (const item of MODULES.obras.items) {
      expect(item.feature && moduleOfFeature(item.feature as FeatureKey)).toBe("obras");
    }
  });
});

describe("último módulo (localStorage)", () => {
  // Ambiente de teste é node: stub simples em memória.
  beforeEach(() => {
    const store = new Map<string, string>();
    globalThis.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, String(v)),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
      key: (i: number) => [...store.keys()][i] ?? null,
      get length() {
        return store.size;
      },
    } as Storage;
  });

  it("fallback é projetos quando não há nada salvo", () => {
    expect(readUltimoModulo()).toBe("projetos");
  });

  it("persiste e lê o módulo salvo", () => {
    saveUltimoModulo("gestao");
    expect(readUltimoModulo()).toBe("gestao");
    expect(localStorage.getItem(ULTIMO_MODULO_KEY)).toBe("gestao");
  });

  it("valor corrompido no storage cai no fallback", () => {
    localStorage.setItem(ULTIMO_MODULO_KEY, "banana");
    expect(readUltimoModulo()).toBe("projetos");
  });
});
