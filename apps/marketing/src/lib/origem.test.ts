import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { classificarCanal, extrairOrigem, registrarOrigem } from "./origem";

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

  it("corta valor de UTM longo em 200 caracteres", () => {
    const origem = extrairOrigem(`?utm_campaign=${"x".repeat(500)}`, "", "www.pilarsoft.com.br");
    expect(origem.utm_campaign).toHaveLength(200);
  });
});

describe("registrarOrigem", () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.replaceState(null, "", "/");
  });

  it("guarda o primeiro toque da sessão e não sobrescreve nas navegações seguintes", () => {
    window.history.replaceState(null, "", "/?utm_source=google&utm_medium=cpc");
    registrarOrigem();
    expect(JSON.parse(sessionStorage.getItem("pilar_origem") ?? "{}")).toEqual({
      utm_source: "google",
      utm_medium: "cpc",
    });

    window.history.replaceState(null, "", "/planos?utm_source=outro");
    registrarOrigem();
    expect(JSON.parse(sessionStorage.getItem("pilar_origem") ?? "{}").utm_source).toBe("google");
  });

  it("sem sessionStorage (modo privado antigo) segue sem quebrar", () => {
    vi.stubGlobal("sessionStorage", {
      getItem: () => {
        throw new Error("bloqueado");
      },
    });
    expect(() => registrarOrigem()).not.toThrow();
  });
});

describe("classificarCanal (SPEC 149)", () => {
  it("separa as IAs pelo utm_source ou pelo site que mandou", () => {
    expect(classificarCanal({ utm_source: "chatgpt.com" })).toBe("chatgpt");
    expect(classificarCanal({ ref: "chat.openai.com" })).toBe("chatgpt");
    expect(classificarCanal({ ref: "www.perplexity.ai" })).toBe("perplexity");
    expect(classificarCanal({ ref: "gemini.google.com" })).toBe("gemini");
    expect(classificarCanal({ ref: "claude.ai" })).toBe("claude");
  });

  it("anúncio vem antes do resto", () => {
    expect(classificarCanal({ gclid: "abc", utm_source: "chatgpt.com" })).toBe("google_ads");
    expect(classificarCanal({ fbclid: "abc" })).toBe("meta_ads");
  });

  it("busca orgânica e redes pelo referrer", () => {
    expect(classificarCanal({ ref: "www.google.com.br" })).toBe("google");
    expect(classificarCanal({ ref: "lnkd.in" })).toBe("linkedin");
    expect(classificarCanal({ ref: "l.instagram.com" })).toBe("instagram");
    expect(classificarCanal({ ref: "blog.qualquer.com.br" })).toBe("outro_site");
  });

  it("utm_source desconhecido vira o próprio nome, saneado", () => {
    expect(classificarCanal({ utm_source: "Newsletter CREA" })).toBe("newsletter_crea");
  });

  it("sem nada é acesso direto", () => {
    expect(classificarCanal({})).toBe("direto");
  });
});
