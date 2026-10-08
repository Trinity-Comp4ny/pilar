import { describe, expect, it } from "vitest";
import { extrairOrigemCadastro } from "./origemCadastro";

const host = "app.pilarsoft.com.br";

describe("extrairOrigemCadastro", () => {
  it("lê UTMs e o ref repassados pela landing", () => {
    expect(
      extrairOrigemCadastro(
        "?utm_source=google&utm_medium=cpc&ref=www.google.com",
        "https://www.pilarsoft.com.br/",
        host
      )
    ).toEqual({ utm_source: "google", utm_medium: "cpc", ref: "www.google.com" });
  });

  it("sem ref nos parâmetros, usa o referrer externo", () => {
    expect(extrairOrigemCadastro("", "https://www.pilarsoft.com.br/planos", host)).toEqual({
      ref: "www.pilarsoft.com.br",
    });
  });

  it("referrer do próprio app não é origem", () => {
    expect(extrairOrigemCadastro("", "https://app.pilarsoft.com.br/login", host)).toEqual({});
  });

  it("corta valor gigante", () => {
    const longo = "x".repeat(500);
    expect(extrairOrigemCadastro(`?utm_campaign=${longo}`, "", host).utm_campaign).toHaveLength(200);
  });
});
