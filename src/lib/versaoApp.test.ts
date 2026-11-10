import { afterEach, describe, expect, it, vi } from "vitest";
import { descreverVersao, versaoAtual } from "./versaoApp";

const SHA = "0b62931e4f2a9c1d7e8b3a5c6d9f0e1a2b3c4d5e";
const BUILD = "2026-11-10T15:30:00.000Z";
const BUILD_LOCAL = new Date(BUILD).toLocaleString("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("descreverVersao", () => {
  it("SHA longo vira os 7 primeiros, com a data do build", () => {
    expect(descreverVersao(SHA, BUILD)).toBe(`Versão 0b62931 · ${BUILD_LOCAL}`);
  });

  it("sem data válida mostra só a versão", () => {
    expect(descreverVersao(SHA, undefined)).toBe("Versão 0b62931");
    expect(descreverVersao(SHA, "lixo")).toBe("Versão 0b62931");
  });

  it("release que não é SHA (SENTRY_RELEASE manual) aparece inteiro", () => {
    expect(descreverVersao("v1.2.3", BUILD)).toBe(`Versão v1.2.3 · ${BUILD_LOCAL}`);
  });

  it("dev ou vazio é versão de desenvolvimento", () => {
    expect(descreverVersao("dev", BUILD)).toBe("Versão de desenvolvimento");
    expect(descreverVersao("", BUILD)).toBe("Versão de desenvolvimento");
    expect(descreverVersao(undefined, undefined)).toBe("Versão de desenvolvimento");
  });
});

describe("versaoAtual", () => {
  it("lê o que o build injetou", () => {
    vi.stubGlobal("__SENTRY_RELEASE__", SHA);
    vi.stubGlobal("__BUILD_TIME__", BUILD);
    expect(versaoAtual()).toBe(`Versão 0b62931 · ${BUILD_LOCAL}`);
  });

  it("build local (dev)", () => {
    vi.stubGlobal("__SENTRY_RELEASE__", "dev");
    vi.stubGlobal("__BUILD_TIME__", BUILD);
    expect(versaoAtual()).toBe("Versão de desenvolvimento");
  });
});
