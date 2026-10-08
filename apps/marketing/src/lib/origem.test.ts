import { describe, expect, it } from "vitest";
import { extrairOrigem } from "./origem";

describe("extrairOrigem", () => {
  it("pega UTMs e o host de quem mandou o visitante", () => {
    expect(
      extrairOrigem(
        "?utm_source=instagram&utm_campaign=stories&x=1",
        "https://l.instagram.com/abc",
        "www.pilarsoft.com.br"
      )
    ).toEqual({ utm_source: "instagram", utm_campaign: "stories", ref: "l.instagram.com" });
  });

  it("navegação interna não conta como origem", () => {
    expect(extrairOrigem("", "https://www.pilarsoft.com.br/planos", "www.pilarsoft.com.br")).toEqual({});
  });

  it("referrer malformado é ignorado", () => {
    expect(extrairOrigem("?gclid=abc", "nao-e-url", "www.pilarsoft.com.br")).toEqual({ gclid: "abc" });
  });
});
