import { describe, it, expect } from "vitest";
import { getTotalPages, clampPage, getPageRange } from "./pagination";

describe("getTotalPages", () => {
  it("arredonda para cima", () => {
    expect(getTotalPages(57, 20)).toBe(3);
    expect(getTotalPages(40, 20)).toBe(2);
    expect(getTotalPages(41, 20)).toBe(3);
  });

  it("retorna 0 sem resultados", () => {
    expect(getTotalPages(0, 20)).toBe(0);
  });

  it("protege contra pageSize inválido", () => {
    expect(getTotalPages(10, 0)).toBe(0);
  });
});

describe("clampPage", () => {
  it("mantém página válida", () => {
    expect(clampPage(1, 3)).toBe(1);
  });

  it("limita ao máximo", () => {
    expect(clampPage(5, 3)).toBe(2);
  });

  it("limita ao mínimo", () => {
    expect(clampPage(-2, 3)).toBe(0);
  });

  it("volta a 0 sem páginas", () => {
    expect(clampPage(3, 0)).toBe(0);
  });
});

describe("getPageRange", () => {
  it("primeira página", () => {
    expect(getPageRange(0, 20, 57)).toEqual({ from: 1, to: 20 });
  });

  it("página do meio", () => {
    expect(getPageRange(1, 20, 57)).toEqual({ from: 21, to: 40 });
  });

  it("última página parcial", () => {
    expect(getPageRange(2, 20, 57)).toEqual({ from: 41, to: 57 });
  });

  it("vazio sem resultados", () => {
    expect(getPageRange(0, 20, 0)).toEqual({ from: 0, to: 0 });
  });
});
