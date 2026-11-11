import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { supabaseFake } from "@/hooks/testing/supabaseFake";

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("@/hooks/testing/supabaseFake")).supabaseFake.client,
}));
const h = vi.hoisted(() => ({
  user: null as { id: string } | null,
  id: "11111111-1111-4111-8111-111111111111" as string | null,
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: h.user }) }));
vi.mock("@/lib/dispositivo", () => ({ idDoDispositivo: () => h.id, descricaoDoNavegador: () => "Chrome no Windows" }));

import { useRegistrarDispositivo } from "./useRegistrarDispositivo";

const registros = () => supabaseFake.rpcCalls.filter((c) => c.fn === "registrar_dispositivo");

// O hook guarda em memória quem já registrou neste carregamento: cada teste usa um usuário próprio.
beforeEach(() => {
  supabaseFake.reset();
  h.id = "11111111-1111-4111-8111-111111111111";
});

describe("useRegistrarDispositivo (SPEC 159)", () => {
  it("sem sessão não registra", () => {
    h.user = null;
    renderHook(() => useRegistrarDispositivo());
    expect(registros()).toHaveLength(0);
  });

  it("registra o navegador uma vez por usuário, mesmo re-renderizando", () => {
    h.user = { id: "u-uma-vez" };
    const { rerender } = renderHook(() => useRegistrarDispositivo());
    h.user = { id: "u-uma-vez" };
    rerender();
    expect(registros()).toEqual([
      {
        fn: "registrar_dispositivo",
        args: { p_dispositivo_id: "11111111-1111-4111-8111-111111111111", p_descricao: "Chrome no Windows" },
      },
    ]);
  });

  it("sem storage no navegador não registra", () => {
    h.user = { id: "u-sem-storage" };
    h.id = null;
    renderHook(() => useRegistrarDispositivo());
    expect(registros()).toHaveLength(0);
  });

  it("se o registro falha, tenta de novo na próxima montagem", async () => {
    h.user = { id: "u-falha" };
    supabaseFake.respondRpc("registrar_dispositivo", { error: { message: "rede" } });
    const primeira = renderHook(() => useRegistrarDispositivo());
    await waitFor(() => expect(registros()).toHaveLength(1));
    await new Promise((r) => setTimeout(r, 0));
    primeira.unmount();

    supabaseFake.respondRpc("registrar_dispositivo", { data: null });
    renderHook(() => useRegistrarDispositivo());
    expect(registros()).toHaveLength(2);
  });
});
