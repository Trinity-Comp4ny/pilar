import { describe, it, expect } from "vitest";
import { msgErroChat, extrairMensagemErroIa, extrairMotivoBloqueioTokens } from "./erros";

describe("msgErroChat", () => {
  it("402 sem motivo: mensagem de saldo da empresa (comportamento original)", () => {
    const err = { context: { status: 402 } };
    expect(msgErroChat(err)).toBe(
      "Os tokens de IA da empresa acabaram neste ciclo. Aguarde a renovação ou fale com o administrador."
    );
  });

  it("402 com motivo saldo_empresa: mesma mensagem de saldo (prioridade sobre teto pessoal)", () => {
    const err = { context: { status: 402 } };
    expect(msgErroChat(err, false, "saldo_empresa")).toBe(
      "Os tokens de IA da empresa acabaram neste ciclo. Aguarde a renovação ou fale com o administrador."
    );
  });

  it("402 com motivo limite_usuario: mensagem de teto pessoal, aponta pedir mais ao admin", () => {
    const err = { context: { status: 402 } };
    expect(msgErroChat(err, false, "limite_usuario")).toBe(
      "Você atingiu seu limite de tokens de IA deste mês. Peça mais tokens ao administrador da sua empresa em Configurações > Uso."
    );
  });

  it("402 com motivo trial_pausado: mensagem de circuit breaker do trial (spec 098)", () => {
    const err = { context: { status: 402 } };
    expect(msgErroChat(err, false, "trial_pausado")).toBe(
      "Uso de IA em contas de teste está pausado por hoje. Volta amanhã, ou fale com a gente pra liberar antes."
    );
  });

  it("429 continua com a mensagem de rate limit, motivo é ignorado fora do 402", () => {
    const err = { context: { status: 429 } };
    expect(msgErroChat(err, false, "limite_usuario")).toBe(
      "Muitas chamadas de IA em sequência. Aguarde um minuto e tente de novo."
    );
  });

  it("timeout tem prioridade sobre qualquer status", () => {
    const err = { context: { status: 402 } };
    expect(msgErroChat(err, true, "limite_usuario")).toBe(
      "A resposta demorou demais e foi interrompida. Tente de novo ou simplifique o pedido."
    );
  });
});

describe("extrairMotivoBloqueioTokens", () => {
  it("lê motivo de um contexto plano (caminho do enviarStream/fetch direto)", async () => {
    const err = { context: { status: 402, motivo: "limite_usuario" } };
    await expect(extrairMotivoBloqueioTokens(err)).resolves.toBe("limite_usuario");
  });

  it("lê motivo do corpo de uma Response (caminho do functions.invoke)", async () => {
    const response = new Response(JSON.stringify({ error: "bloqueado", motivo: "saldo_empresa" }), { status: 402 });
    const err = { context: response };
    await expect(extrairMotivoBloqueioTokens(err)).resolves.toBe("saldo_empresa");
  });

  it("sem contexto reconhecível, retorna undefined sem lançar", async () => {
    await expect(extrairMotivoBloqueioTokens(new Error("rede caiu"))).resolves.toBeUndefined();
  });

  it("Response sem corpo JSON válido não lança, retorna undefined", async () => {
    const response = new Response("não é json", { status: 402 });
    const err = { context: response };
    await expect(extrairMotivoBloqueioTokens(err)).resolves.toBeUndefined();
  });
});

describe("extrairMensagemErroIa", () => {
  const corpo = { error: "O serviço de IA não respondeu. Tente de novo em instantes.", tipo: "provedor_indisponivel" };

  it("lê do objeto plano montado pelo enviarStream", async () => {
    expect(await extrairMensagemErroIa({ context: { status: 502, ...corpo } })).toBe(corpo.error);
  });

  it("lê da Response do functions.invoke sem consumir o corpo", async () => {
    const res = new Response(JSON.stringify(corpo), { status: 502 });
    expect(await extrairMensagemErroIa({ context: res })).toBe(corpo.error);
    expect(res.bodyUsed).toBe(false);
  });

  it("ignora corpo sem tipo (erro antigo ou de outra origem)", async () => {
    expect(await extrairMensagemErroIa({ context: { status: 500, error: "Gemini API error (500): {...}" } })).toBe(
      undefined
    );
    expect(await extrairMensagemErroIa(new Error("x"))).toBe(undefined);
  });

  it("msgErroChat usa a mensagem do tipo no lugar do genérico", () => {
    expect(msgErroChat({ context: { status: 502 } }, false, undefined, corpo.error)).toBe(corpo.error);
  });

  it("msgErroChat mantém timeout e 402 acima da mensagem do tipo", () => {
    expect(msgErroChat({ context: { status: 502 } }, true, undefined, corpo.error)).toContain("demorou demais");
    expect(msgErroChat({ context: { status: 402 } }, false, undefined, corpo.error)).toContain("tokens de IA");
  });
});
