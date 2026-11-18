import { describe, expect, it } from "vitest";
import { CONFIG_COMERCIAL_PADRAO } from "../hooks/useConfigComercial";
import { resumoMargemProposta } from "@/lib/margemProposta";
import { lerSimulacao, montarSnapshot } from "./simulacaoSnapshot";

const config = { ...CONFIG_COMERCIAL_PADRAO, margemAlvoPct: 30, margemMinimaPct: 15 };
const sim = { impostoPct: 6, meioId: "pix", parcelas: 1, margemAlvoPct: 30, descontoPct: 0 };

describe("simulacaoSnapshot", () => {
  it("grava e relê a simulação sem perder o preço de tabela", () => {
    const snap = montarSnapshot({ ...sim, descontoPct: 10 }, 10000, 7000, config);
    const lida = lerSimulacao(snap);
    expect(lida?.precoTabela).toBe(10000);
    expect(lida?.simulacao.descontoPct).toBe(10);
  });

  it("resume margem e semáforo; vermelho abaixo do mínimo", () => {
    // preço 10000 com 10% de desconto = 9000; 1 - 7000/9000 - 0,06 = 16,2% => amarelo
    expect(resumoMargemProposta(montarSnapshot({ ...sim, descontoPct: 10 }, 10000, 7000, config))?.semaforo).toBe(
      "amarelo"
    );
    expect(resumoMargemProposta(montarSnapshot({ ...sim, descontoPct: 20 }, 10000, 7000, config))?.semaforo).toBe(
      "vermelho"
    );
  });

  it("é nulo sem simulação ou malformada", () => {
    expect(resumoMargemProposta(null)).toBeNull();
    expect(resumoMargemProposta({ foo: 1 })).toBeNull();
    expect(lerSimulacao([])).toBeNull();
  });
});
