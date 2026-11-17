import { describe, expect, it } from "vitest";
import { lerCusto } from "./semaforoCusto";

describe("lerCusto", () => {
  it("sem orçado não há leitura", () => {
    expect(lerCusto(undefined, 40)).toBeNull();
    expect(lerCusto({ previsto: 0, realizado: 500 }, 40)).toBeNull();
  });

  it("gasto no ritmo do avanço é verde", () => {
    expect(lerCusto({ previsto: 1000, realizado: 500 }, 50)).toEqual({
      semaforo: "verde",
      gastoPct: 50,
      desvioPontos: 0,
    });
  });

  it("gasto até 5 pontos acima do avanço ainda é verde; acima disso, amarelo", () => {
    expect(lerCusto({ previsto: 1000, realizado: 550 }, 50)?.semaforo).toBe("verde");
    expect(lerCusto({ previsto: 1000, realizado: 600 }, 50)?.semaforo).toBe("amarelo");
  });

  it("gasto mais de 15 pontos acima do avanço é vermelho", () => {
    expect(lerCusto({ previsto: 1000, realizado: 800 }, 40)).toEqual({
      semaforo: "vermelho",
      gastoPct: 80,
      desvioPontos: 40,
    });
  });

  it("estourar o orçado é vermelho mesmo com obra quase pronta", () => {
    expect(lerCusto({ previsto: 1000, realizado: 1050 }, 100)?.semaforo).toBe("vermelho");
  });

  it("gastar menos do que a obra andou é verde", () => {
    expect(lerCusto({ previsto: 1000, realizado: 200 }, 60)?.semaforo).toBe("verde");
  });
});
