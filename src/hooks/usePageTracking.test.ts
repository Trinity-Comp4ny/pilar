import { describe, expect, it } from "vitest";
import { rotaSemIds } from "./usePageTracking";

describe("rotaSemIds", () => {
  it("troca uuid por :id e preserva o resto", () => {
    expect(rotaSemIds("/projetos/ad529416-ddf2-4ba1-9c6e-cbafcc99b5a1")).toBe("/projetos/:id");
    expect(rotaSemIds("/gestao/clientes/718f3005-c891-4ff9-812d-c77e21bd86a4/arquivos")).toBe(
      "/gestao/clientes/:id/arquivos"
    );
    expect(rotaSemIds("/inicio")).toBe("/inicio");
  });
});
