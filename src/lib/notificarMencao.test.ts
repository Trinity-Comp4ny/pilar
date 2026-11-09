import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args) } }));
vi.mock("@/lib/monitoring", () => ({ monitoring: { captureException: vi.fn() } }));

import { notificarMencao } from "./notificarMencao";

describe("notificarMencao", () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({ error: null });
  });

  it("sem ninguém marcado e sem @all não chama a RPC", async () => {
    await notificarMencao("projeto", "proj-1", [], "só um comentário", "c1");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("menção individual chama a RPC com p_todos falso", async () => {
    await notificarMencao("projeto", "proj-1", ["pessoa-1"], "@Maria olha isso", "c1");
    expect(rpc).toHaveBeenCalledWith(
      "rpc_notificar_mencao",
      expect.objectContaining({ p_mencionados: ["pessoa-1"], p_todos: false, p_comentario_id: "c1" })
    );
  });

  it("@all chama a RPC com p_todos verdadeiro, mesmo sem pessoa marcada", async () => {
    await notificarMencao("tarefa", "t-1", [], "@all prazo mudou", "c2");
    expect(rpc).toHaveBeenCalledWith(
      "rpc_notificar_mencao",
      expect.objectContaining({ p_mencionados: [], p_todos: true, p_entidade_tipo: "tarefa" })
    );
  });
});
