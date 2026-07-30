import { beforeEach, describe, expect, it } from "vitest";
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
    expect(routeToModule("/financeiro")).toBe("gestao");
    expect(routeToModule("/equipe")).toBe("gestao");
    expect(routeToModule("/fornecedores")).toBe("gestao");
    expect(routeToModule("/leads")).toBe("projetos");
    expect(routeToModule("/documentos")).toBe("projetos");
    expect(routeToModule("/clientes")).toBe("projetos");
    expect(routeToModule("/projetos")).toBe("projetos");
    expect(routeToModule("/calendario")).toBe("projetos");
    expect(routeToModule("/obras")).toBe("obras");
  });

  it("resolve sub-rotas por prefixo (detalhes)", () => {
    expect(routeToModule("/projetos/abc-123")).toBe("projetos");
    expect(routeToModule("/clientes/9f2/financeiro")).toBe("projetos");
    expect(routeToModule("/financeiro/lancamentos")).toBe("gestao");
  });

  it("não confunde prefixo parcial de segmento", () => {
    // "/projetos-x" não é sub-rota de "/projetos"
    expect(routeToModule("/projetosx")).toBeNull();
    expect(routeToModule("/financeiroy")).toBeNull();
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
    expect(routeToModule("/financeiro/")).toBe("gestao");
    expect(routeToModule("/projetos/")).toBe("projetos");
  });

  it("rotas extras fora do menu pertencem a um módulo", () => {
    expect(routeToModule("/mapa")).toBe("projetos");
    expect(routeToModule("/rentabilidade")).toBe("projetos");
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

  it("obras é módulo real gated pela feature (reaberto — ADR 0011)", () => {
    expect(MODULES.obras.emBreve).toBeUndefined();
    expect(MODULE_ORDER).toContain("obras");
    expect(MODULES.obras.items.every((i) => i.feature === "obras")).toBe(true);
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
