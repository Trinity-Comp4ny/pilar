import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { supabaseFake } from "@/hooks/testing/supabaseFake";

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("@/hooks/testing/supabaseFake")).supabaseFake.client,
}));
const h = vi.hoisted(() => ({ user: { id: "u1" } as { id: string } | null }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: h.user }) }));

import { useAvisosPlataforma, useComunicadosModal } from "./useAvisosPlataforma";

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

const INCIDENTE = {
  id: "i1",
  titulo: "Lentidão no Financeiro",
  severidade: "parcial",
  status: "investigando",
  resolved_at: null,
  status_incident_components: [
    { status_components: { nome_exibicao: "Portal do cliente", ordem: 2 } },
    { status_components: null },
    { status_components: { nome_exibicao: "Aplicação Pilar", ordem: 1 } },
  ],
  status_incident_updates: [
    { id: "u1", mensagem: "Investigando.", created_at: "2026-11-11T10:00:00Z" },
    { id: "u2", mensagem: "Causa encontrada.", created_at: "2026-11-11T10:30:00Z" },
  ],
};

const COMUNICADOS = [
  { id: "c1", titulo: "Faixa", mensagem: "a", formato: "faixa", link_url: null, link_rotulo: null },
  { id: "c2", titulo: "Modal", mensagem: "b", formato: "modal", link_url: null, link_rotulo: null },
];

beforeEach(() => {
  supabaseFake.reset();
  h.user = { id: "u1" };
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

describe("useAvisosPlataforma (SPEC 153 e 157)", () => {
  it("sem sessão não consulta e não mostra nada", () => {
    h.user = null;
    const { result } = renderHook(() => useAvisosPlataforma(), { wrapper });
    expect(result.current).toEqual([]);
    expect(supabaseFake.calls).toHaveLength(0);
  });

  it("monta a faixa com a atualização mais recente e os componentes em ordem", async () => {
    supabaseFake.respond("status_incidents", "select", { data: [INCIDENTE] });
    supabaseFake.respondRpc("comunicados_para_mim", { data: COMUNICADOS });
    const { result } = renderHook(() => useAvisosPlataforma(), { wrapper });
    await waitFor(() => expect(result.current).toHaveLength(2));
    expect(result.current[0]).toMatchObject({
      chave: "incidente:i1:u2",
      texto: "Causa encontrada.",
      detalhe: "Afeta: Aplicação Pilar, Portal do cliente",
    });
    expect(result.current[1].chave).toBe("comunicado:c1");
  });

  it("manutenção futura entra como programada", async () => {
    const inicio = new Date(Date.now() + 60 * 60_000).toISOString();
    const fim = new Date(Date.now() + 2 * 60 * 60_000).toISOString();
    supabaseFake.respond("status_manutencoes", "select", {
      data: [{ id: "m1", titulo: "Banco", mensagem: null, inicio, fim, cancelada_em: null }],
    });
    const { result } = renderHook(() => useAvisosPlataforma(), { wrapper });
    await waitFor(() => expect(result.current).toHaveLength(1));
    expect(result.current[0].chave).toBe("manutencao:m1:programada");
  });

  it("falha nos comunicados não esconde o incidente", async () => {
    supabaseFake.respond("status_incidents", "select", {
      data: [{ ...INCIDENTE, status_incident_components: null, status_incident_updates: null }],
    });
    supabaseFake.respondRpc("comunicados_para_mim", { error: { message: "x" } });
    const { result } = renderHook(() => useAvisosPlataforma(), { wrapper });
    await waitFor(() => expect(result.current).toHaveLength(1));
    expect(result.current[0]).toMatchObject({ texto: "Já estamos atuando.", detalhe: null });
  });

  it("falha nos incidentes ou nas manutenções deixa a faixa vazia", async () => {
    supabaseFake.respond("status_incidents", "select", { error: { message: "rls" } });
    const a = renderHook(() => useAvisosPlataforma(), { wrapper });
    await waitFor(() => expect(client.getQueryState(["avisos-plataforma"])?.status).toBe("error"));
    expect(a.result.current).toEqual([]);

    supabaseFake.reset();
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    supabaseFake.respond("status_manutencoes", "select", { error: { message: "rls" } });
    const b = renderHook(() => useAvisosPlataforma(), { wrapper });
    await waitFor(() => expect(client.getQueryState(["avisos-plataforma"])?.status).toBe("error"));
    expect(b.result.current).toEqual([]);
  });
});

describe("useComunicadosModal", () => {
  it("devolve só os comunicados em formato modal", async () => {
    supabaseFake.respondRpc("comunicados_para_mim", { data: COMUNICADOS });
    const { result } = renderHook(() => useComunicadosModal(), { wrapper });
    await waitFor(() => expect(result.current).toHaveLength(1));
    expect(result.current[0].id).toBe("c2");
  });
});
