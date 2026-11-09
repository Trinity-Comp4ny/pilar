import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ profile: null }) }));

import { classificarFalha } from "./useDescreverObra";

describe("classificarFalha", () => {
  it.each([400, 402, 403, 429])("status %i com mensagem é algo que a pessoa resolve", (status) => {
    expect(classificarFalha(status, { error: "Os tokens de IA da empresa acabaram neste ciclo." })).toEqual({
      tipo: "bloqueio",
      mensagem: "Os tokens de IA da empresa acabaram neste ciclo.",
    });
  });

  it("saída inválida ou truncada do provedor vira resposta inválida", () => {
    expect(
      classificarFalha(502, { error: "A IA não conseguiu montar uma resposta válida.", tipo: "saida_invalida" })
    ).toMatchObject({ tipo: "invalida" });
    expect(classificarFalha(502, { tipo: "saida_truncada" })).toMatchObject({ tipo: "invalida" });
  });

  it("falha do provedor, erro nosso e corpo ilegível viram erro, com texto de reserva", () => {
    expect(
      classificarFalha(503, { error: "O serviço de IA está com muita procura agora.", tipo: "limite_do_provedor" })
    ).toMatchObject({ tipo: "erro", mensagem: "O serviço de IA está com muita procura agora." });
    expect(classificarFalha(500, null)).toEqual({ tipo: "erro", mensagem: "Não consegui falar com a IA agora." });
    expect(classificarFalha(undefined, null).tipo).toBe("erro");
  });

  it("400 sem mensagem não vira bloqueio mudo", () => {
    expect(classificarFalha(402, {}).tipo).toBe("erro");
  });
});
