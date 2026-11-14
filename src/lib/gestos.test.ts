import { describe, expect, it } from "vitest";
import { decidirDeslize, deveFecharSheet, ehHorizontal, limitarDeslize } from "./gestos";

describe("gestos", () => {
  it("distingue arrasto horizontal de rolagem", () => {
    expect(ehHorizontal(30, 5)).toBe(true);
    expect(ehHorizontal(30, 40)).toBe(false);
    expect(ehHorizontal(4, 0)).toBe(false);
  });
  it("limita o deslize ao lado que tem ação", () => {
    expect(limitarDeslize(50, 0, 88)).toBe(0);
    expect(limitarDeslize(-50, 88, 0)).toBe(0);
    expect(limitarDeslize(500, 88, 88)).toBe(110);
    expect(limitarDeslize(-500, 88, 88)).toBe(-110);
  });
  it("só confirma passando de 60% da ação", () => {
    expect(decidirDeslize(60, 88, 88)).toBe("esquerda");
    expect(decidirDeslize(40, 88, 88)).toBe("volta");
    expect(decidirDeslize(-60, 88, 88)).toBe("direita");
    expect(decidirDeslize(60, 0, 88)).toBe("volta");
  });
  it("sheet fecha com 1/3 da altura ou flick", () => {
    expect(deveFecharSheet(150, 400, 0)).toBe(true);
    expect(deveFecharSheet(50, 400, 0)).toBe(false);
    expect(deveFecharSheet(50, 400, 0.9)).toBe(true);
    expect(deveFecharSheet(-10, 400, 2)).toBe(false);
    expect(deveFecharSheet(20, 400, 2)).toBe(false);
  });
});
