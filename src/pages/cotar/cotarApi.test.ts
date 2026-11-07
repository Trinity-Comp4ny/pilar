import { beforeEach, describe, expect, it, vi } from "vitest";
import { sb } from "@/pages/financeiro/testing/supabaseMock";

// API pública da cotação (fornecedor sem login): consultar o link e enviar a
// proposta pela edge `cotacao-link`. Link encerrado não é erro; erro de rede ou
// da edge vira mensagem legível.

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("@/pages/financeiro/testing/supabaseMock")).sb.client,
}));

import { consultarCotacao, enviarProposta } from "./cotarApi";

const invoke = () => vi.mocked(sb.client.functions.invoke);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("consultarCotacao", () => {
  it("devolve a cotação quando o link está aberto", async () => {
    invoke().mockResolvedValueOnce({ data: { ok: true, descricao: "Cimento", quantidade: 10 }, error: null } as never);
    await expect(consultarCotacao("tok")).resolves.toEqual({ ok: true, descricao: "Cimento", quantidade: 10 });
    expect(invoke()).toHaveBeenCalledWith("cotacao-link", { body: { acao: "consultar", token: "tok" } });
  });

  it("link encerrado (ok falso ou sem corpo) devolve null", async () => {
    invoke()
      .mockResolvedValueOnce({ data: { ok: false }, error: null } as never)
      .mockResolvedValueOnce({ data: null, error: null } as never);
    await expect(consultarCotacao("tok")).resolves.toBeNull();
    await expect(consultarCotacao("tok")).resolves.toBeNull();
  });

  it("erro da edge usa a mensagem do corpo da resposta", async () => {
    const context = new Response(JSON.stringify({ error: "Muitas tentativas" }), { status: 429 });
    invoke().mockResolvedValueOnce({ data: null, error: { context } } as never);
    await expect(consultarCotacao("tok")).rejects.toThrow("Muitas tentativas");
  });

  it("sem resposta do servidor avisa falta de conexão", async () => {
    invoke().mockResolvedValueOnce({ data: null, error: new Error("fetch failed") } as never);
    await expect(consultarCotacao("tok")).rejects.toThrow("Sem conexão com o servidor");
  });
});

describe("enviarProposta", () => {
  const proposta = {
    valor: 1000,
    valor_parcelado: null,
    condicao_pagamento: "30 dias",
    desconto_pct: null,
    prazo_entrega_dias: 5,
    observacoes: null,
  };

  it("envia a proposta junto do token e confirma quando a edge guarda", async () => {
    invoke().mockResolvedValueOnce({ data: { ok: true }, error: null } as never);
    await expect(enviarProposta("tok", proposta as never)).resolves.toBe(true);
    expect(invoke()).toHaveBeenCalledWith("cotacao-link", {
      body: { acao: "responder", token: "tok", ...proposta },
    });
  });

  it("link que encerrou durante o preenchimento devolve false", async () => {
    invoke()
      .mockResolvedValueOnce({ data: { ok: false }, error: null } as never)
      .mockResolvedValueOnce({ data: null, error: null } as never);
    await expect(enviarProposta("tok", proposta as never)).resolves.toBe(false);
    await expect(enviarProposta("tok", proposta as never)).resolves.toBe(false);
  });

  it("erro com corpo ilegível vira 'Erro <status>'", async () => {
    const context = new Response("<html>", { status: 502 });
    invoke().mockResolvedValueOnce({ data: null, error: { context } } as never);
    await expect(enviarProposta("tok", proposta as never)).rejects.toThrow("Erro 502");
  });
});
