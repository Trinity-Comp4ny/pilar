import { beforeEach, describe, expect, it } from "vitest";
import {
  autorizacaoPendente,
  guardarAutorizacaoPendente,
  hostDoRetorno,
  idDeAutorizacaoValido,
  limparAutorizacaoPendente,
  redirecionamentoSeguro,
  rotaDeAutorizacao,
} from "./oauthPendente";

beforeEach(() => sessionStorage.clear());

describe("pedido de autorização pendente (SPEC 151)", () => {
  it("guarda, lê sem apagar e limpa", () => {
    guardarAutorizacaoPendente("auth_1234abcd");
    expect(autorizacaoPendente()).toBe("auth_1234abcd");
    expect(autorizacaoPendente()).toBe("auth_1234abcd");
    limparAutorizacaoPendente();
    expect(autorizacaoPendente()).toBeNull();
  });

  it("não guarda nem devolve id fora do formato", () => {
    guardarAutorizacaoPendente("../../x?y=<script>");
    expect(autorizacaoPendente()).toBeNull();
    sessionStorage.setItem("pilar_oauth_autorizacao", "a b");
    expect(autorizacaoPendente()).toBeNull();
    expect(idDeAutorizacaoValido("curto")).toBe(false);
    expect(idDeAutorizacaoValido(null)).toBe(false);
    expect(idDeAutorizacaoValido("3f1c2d3e-0000-4000-8000-000000000001")).toBe(true);
  });

  it("monta a rota da tela de autorização", () => {
    expect(rotaDeAutorizacao("auth_1234abcd")).toBe("/oauth/autorizar?authorization_id=auth_1234abcd");
  });
});

describe("retorno ao app externo", () => {
  it("aceita http(s) e esquema de app de desktop, recusa javascript: e data:", () => {
    expect(redirecionamentoSeguro("https://chatgpt.com/connector/oauth/cb?code=1&state=2")).toBe(
      "https://chatgpt.com/connector/oauth/cb?code=1&state=2"
    );
    expect(redirecionamentoSeguro("http://localhost:33418/callback?code=1")).toBe(
      "http://localhost:33418/callback?code=1"
    );
    expect(redirecionamentoSeguro("claude://oauth/callback?code=1")).toBe("claude://oauth/callback?code=1");
    expect(redirecionamentoSeguro("javascript:alert(1)")).toBeNull();
    expect(redirecionamentoSeguro("data:text/html,oi")).toBeNull();
    expect(redirecionamentoSeguro("não é url")).toBeNull();
    expect(redirecionamentoSeguro(undefined)).toBeNull();
  });

  it("mostra o host de retorno", () => {
    expect(hostDoRetorno("https://chatgpt.com/connector/oauth/cb")).toBe("chatgpt.com");
    expect(hostDoRetorno("https://claude.ai/api/mcp/auth_callback")).toBe("claude.ai");
    expect(hostDoRetorno("lixo")).toBeNull();
  });
});
