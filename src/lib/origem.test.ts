import { describe, expect, it } from "vitest";
import { origemDaRota } from "./origem";

describe("origemDaRota", () => {
  it.each([
    ["/campo", "campo"],
    ["/campo/registrar", "campo"],
    ["/cliente/login", "portal"],
    ["/cliente/projeto/abc", "portal"],
    ["/projetos", "app"],
    ["/campos-extras", "app"],
    ["/", "app"],
  ])("%s → %s", (rota, esperado) => {
    expect(origemDaRota(rota)).toBe(esperado);
  });
});
