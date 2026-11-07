import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseFrom, type ChainQuery, type ChainResult } from "@/test/supabaseChain";

// Camada de dados do portal ultra admin: edge com JWT da sessão, normalização do que a edge
// devolve (status, papel, cobrança, features) e o fallback de usuários direto em profiles.

const h = vi.hoisted(() => ({
  token: "jwt-1" as string | null,
  resolve: (() => ({ data: [] })) as (q: ChainQuery) => ChainResult,
}));
const chain = vi.hoisted(() => ({ from: null as unknown as ReturnType<typeof createSupabaseFrom> }));

vi.mock("@/integrations/supabase/client", async () => {
  const { createSupabaseFrom } = await import("@/test/supabaseChain");
  chain.from = createSupabaseFrom((q) => h.resolve(q));
  return {
    supabase: {
      from: chain.from.from,
      auth: {
        getSession: async () => ({ data: { session: h.token ? { access_token: h.token } : null } }),
      },
    },
  };
});
vi.mock("@/lib/env", () => ({ env: { VITE_SUPABASE_URL: "https://ref.supabase.co" } }));

import { buscarEmpresa, edgeFetch, listarEmpresas, listarUsuarios, normalizeRole } from "./api";

const fetchMock = vi.fn();

function resposta(body: unknown, init: { ok?: boolean; status?: number; json?: boolean } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: init.json === false ? async () => Promise.reject(new Error("not json")) : async () => body,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.token = "jwt-1";
  h.resolve = () => ({ data: [] });
  chain.from.calls.length = 0;
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("normalizeRole", () => {
  it("mantém os papéis conhecidos e rebaixa o resto para user", () => {
    expect(normalizeRole("ultra_admin")).toBe("ultra_admin");
    expect(normalizeRole("admin")).toBe("admin");
    expect(normalizeRole("coordenador")).toBe("coordenador");
    expect(normalizeRole("superuser")).toBe("user");
    expect(normalizeRole(null)).toBe("user");
    expect(normalizeRole(undefined)).toBe("user");
  });
});

describe("edgeFetch", () => {
  it("sem sessão nem chama a rede", async () => {
    h.token = null;
    await expect(edgeFetch("x")).rejects.toThrow("Sessão expirada");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("GET por padrão, com Bearer e params na query", async () => {
    fetchMock.mockResolvedValue(resposta({ ok: 1 }));
    const r = await edgeFetch("ultra-admin-empresas", { params: { id: "e 1" } });
    expect(r).toEqual({ ok: 1 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://ref.supabase.co/functions/v1/ultra-admin-empresas?id=e+1");
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer jwt-1");
    expect(init.body).toBeUndefined();
  });

  it("com body vira POST com JSON; método explícito prevalece", async () => {
    fetchMock.mockResolvedValue(resposta({}));
    await edgeFetch("fn", { body: { a: 1 } });
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "POST", body: '{"a":1}' });
    await edgeFetch("fn", { method: "PUT", body: { b: 2 } });
    expect(fetchMock.mock.calls[1][1].method).toBe("PUT");
  });

  it("erro HTTP usa a mensagem da edge quando existe", async () => {
    fetchMock.mockResolvedValue(resposta({ error: "Empresa não encontrada" }, { ok: false, status: 404 }));
    await expect(edgeFetch("fn")).rejects.toThrow("Empresa não encontrada");
  });

  it("erro HTTP sem JSON cai no código", async () => {
    fetchMock.mockResolvedValue(resposta(null, { ok: false, status: 502, json: false }));
    await expect(edgeFetch("fn")).rejects.toThrow("HTTP 502");
  });

  it("sucesso com corpo não-JSON devolve objeto vazio", async () => {
    fetchMock.mockResolvedValue(resposta(null, { json: false }));
    await expect(edgeFetch("fn")).resolves.toEqual({});
  });
});

describe("listarEmpresas", () => {
  it("esconde empresa excluída e normaliza status, plano, features e cobrança", async () => {
    fetchMock.mockResolvedValue(
      resposta([
        {
          id: "e1",
          nome: "Alfa Engenharia",
          cnpj: null,
          status: "suspended",
          features: { leads: true, inexistente: true, dashboard: "sim" },
          plano: "pro",
          usersCount: 4,
          cobranca: { status: "active", trial_ends_at: null, is_paying: true, convidada: false },
          created_at: "2026-01-01",
          ultimo_acesso: "2026-11-01",
        },
        { id: "e2", nome: "Beta", cnpj: "1", status: "estranho", features: null },
        { id: "e3", nome: "[empresa excluida]", cnpj: null, status: "cancelled", features: {} },
      ])
    );
    const lista = await listarEmpresas();
    expect(lista.map((e) => e.id)).toEqual(["e1", "e2"]);
    expect(lista[0]).toMatchObject({
      status: "suspended",
      plano: "pro",
      usersCount: 4,
      features: { leads: true },
      cobranca: { status: "active", isPaying: true, convidada: false, trialEndsAt: null },
      ultimoAcesso: "2026-11-01",
    });
    expect(lista[0].features).not.toHaveProperty("inexistente");
    expect(lista[0].features).not.toHaveProperty("dashboard");
    expect(lista[1]).toMatchObject({
      status: "active",
      plano: "starter",
      usersCount: 0,
      createdAt: null,
      ultimoAcesso: null,
      cobranca: { status: null, isPaying: false, convidada: false, trialEndsAt: null },
    });
  });
});

describe("buscarEmpresa", () => {
  it("monta usuários e convites pendentes, contando só os ativos", async () => {
    fetchMock.mockResolvedValue(
      resposta({
        empresa: {
          id: "e1",
          nome: "Alfa",
          cnpj: "123",
          status: "cancelled",
          features: {},
          max_projetos_override: 20,
          max_usuarios_override: null,
          interna: true,
        },
        plano: null,
        planoMaxProjetos: 10,
        planoMaxUsuarios: 5,
        cobranca: { status: "trialing", trial_ends_at: "2026-12-01", is_paying: false, convidada: true },
        uso: { projetos_ativos: 3, ultimo_acesso: "2026-11-02" },
        usuarios: [
          {
            id: "u1",
            nome: null,
            email: "ana@alfa.com",
            role: "admin",
            financeiro_delegado: true,
            equipe_delegado: null,
            metas_delegado: false,
            last_sign_in_at: "2026-11-02",
          },
          {
            id: "u2",
            nome: null,
            email: null,
            role: null,
            financeiro_delegado: null,
            equipe_delegado: null,
            metas_delegado: null,
          },
        ],
        convites: [{ id: "c1", email: "novo@alfa.com", nome: null, cargo: "coordenador" }],
      })
    );
    const e = await buscarEmpresa("e1");
    expect(fetchMock.mock.calls[0][0]).toContain("ultra-admin-empresas?id=e1");
    expect(e).toMatchObject({
      status: "cancelled",
      plano: "starter",
      interna: true,
      projetosAtivos: 3,
      ultimoAcesso: "2026-11-02",
      maxProjetosOverride: 20,
      maxUsuariosOverride: null,
      planoMaxProjetos: 10,
      usersCount: 2,
      cobranca: { status: "trialing", convidada: true, trialEndsAt: "2026-12-01" },
    });
    expect(e.usuarios).toHaveLength(3);
    expect(e.usuarios[0]).toMatchObject({
      name: "ana@alfa.com",
      role: "admin",
      financeiroDelegado: true,
      equipeDelegado: false,
    });
    // Sem nome nem e-mail, o id é o nome de exibição.
    expect(e.usuarios[1]).toMatchObject({ name: "u2", email: "", role: "user", lastSignInAt: null });
    expect(e.usuarios[2]).toMatchObject({
      id: "convite-c1",
      inviteId: "c1",
      name: "novo@alfa.com",
      role: "coordenador",
      isPending: true,
    });
  });

  it("edge antiga sem uso/convites/interna não quebra", async () => {
    fetchMock.mockResolvedValue(
      resposta({
        empresa: {
          id: "e1",
          nome: "Alfa",
          cnpj: null,
          status: null,
          features: {},
          max_projetos_override: null,
          max_usuarios_override: null,
        },
        plano: "enterprise",
        planoMaxProjetos: null,
        planoMaxUsuarios: null,
        cobranca: undefined,
        usuarios: [],
      })
    );
    const e = await buscarEmpresa("e1");
    expect(e).toMatchObject({
      interna: false,
      projetosAtivos: null,
      ultimoAcesso: null,
      usersCount: 0,
      plano: "enterprise",
    });
  });
});

describe("listarUsuarios", () => {
  it("usa a edge quando ela responde lista", async () => {
    fetchMock.mockResolvedValue(
      resposta([
        {
          id: "u1",
          nome: "Ana",
          email: "a@x",
          role: "admin",
          empresa_id: "e1",
          empresa_nome: "Alfa",
          created_at: "c",
          last_sign_in_at: "l",
        },
        { id: "u2", nome: null, email: null, role: "qualquer", empresa_id: null },
      ])
    );
    const us = await listarUsuarios();
    expect(us[0]).toEqual({
      id: "u1",
      nome: "Ana",
      email: "a@x",
      role: "admin",
      empresaId: "e1",
      empresaNome: "Alfa",
      createdAt: "c",
      lastSignInAt: "l",
    });
    expect(us[1]).toMatchObject({ role: "user", empresaNome: null, createdAt: null, lastSignInAt: null });
    expect(chain.from.from).not.toHaveBeenCalled();
  });

  it("edge sem GET (resposta não-lista) cai em profiles, sem último login", async () => {
    fetchMock.mockResolvedValue(resposta({ message: "method not allowed" }));
    h.resolve = (q) =>
      q.table === "profiles"
        ? {
            data: [
              {
                id: "u1",
                nome: "Ana",
                email: "a@x",
                role: "coordenador",
                empresa_id: "e1",
                created_at: "c",
                empresas: { nome: "Alfa" },
              },
              { id: "u2", nome: "Bia", email: "b@x", role: null, empresa_id: null, created_at: null, empresas: null },
            ],
          }
        : { data: [] };
    const us = await listarUsuarios();
    expect(us).toHaveLength(2);
    expect(us[0]).toMatchObject({ role: "coordenador", empresaNome: "Alfa", lastSignInAt: null });
    expect(us[1]).toMatchObject({ role: "user", empresaNome: null });
    const q = chain.from.calls.find((c) => c.table === "profiles")!;
    expect(q.filters).toContainEqual(["is", "desativado_em", null]);
  });

  it("edge fora do ar e profiles com erro propagam o erro do banco", async () => {
    fetchMock.mockRejectedValue(new Error("network"));
    h.resolve = () => ({ data: null, error: new Error("RLS negou") });
    await expect(listarUsuarios()).rejects.toThrow("RLS negou");
  });

  it("profiles sem dados devolve lista vazia", async () => {
    fetchMock.mockResolvedValue(resposta(null, { ok: false, status: 500 }));
    h.resolve = () => ({ data: null });
    await expect(listarUsuarios()).resolves.toEqual([]);
  });
});
