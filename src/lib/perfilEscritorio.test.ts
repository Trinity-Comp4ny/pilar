import { describe, expect, it } from "vitest";
import { normalizarLinkedin, normalizarSite, rotuloDe, PORTES, sugerirSite } from "./perfilEscritorio";

describe("sugerirSite", () => {
  it("usa o domínio do e-mail corporativo", () => {
    expect(sugerirSite("joao@alfaeng.com.br")).toBe("alfaeng.com.br");
    expect(sugerirSite("Joao@AlfaEng.com.br ")).toBe("alfaeng.com.br");
  });

  it("não sugere para e-mail pessoal ou inválido", () => {
    expect(sugerirSite("joao@gmail.com")).toBeNull();
    expect(sugerirSite("joao@hotmail.com.br")).toBeNull();
    expect(sugerirSite("joao")).toBeNull();
    expect(sugerirSite(null)).toBeNull();
  });
});

describe("normalizarSite", () => {
  it("tira protocolo, www e barra final", () => {
    expect(normalizarSite("https://www.Alfa.com.br/")).toBe("alfa.com.br");
    expect(normalizarSite("  ")).toBeNull();
  });
});

describe("normalizarLinkedin", () => {
  it("vazio é válido (campo opcional)", () => {
    expect(normalizarLinkedin("")).toEqual({ ok: true, url: null });
  });

  it("completa URL sem protocolo e usuário solto", () => {
    expect(normalizarLinkedin("linkedin.com/in/joao-silva/")).toEqual({
      ok: true,
      url: "https://linkedin.com/in/joao-silva",
    });
    expect(normalizarLinkedin("joao-silva")).toEqual({ ok: true, url: "https://www.linkedin.com/in/joao-silva" });
    expect(normalizarLinkedin("https://br.linkedin.com/in/joao")).toEqual({
      ok: true,
      url: "https://br.linkedin.com/in/joao",
    });
  });

  it("recusa outro site", () => {
    expect(normalizarLinkedin("https://instagram.com/joao")).toEqual({ ok: false });
  });
});

describe("rotuloDe", () => {
  it("devolve o rótulo ou null", () => {
    expect(rotuloDe(PORTES, "6-15")).toBe("6 a 15");
    expect(rotuloDe(PORTES, "x")).toBeNull();
    expect(rotuloDe(PORTES, null)).toBeNull();
  });
});
