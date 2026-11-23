import { describe, expect, it } from "vitest";
import { dataDaPlaca, PLACA_LABEL, PLACA_STATUS, placaStatusDe } from "./placa";

describe("placa", () => {
  it("tem rótulo para cada situação", () => {
    for (const s of PLACA_STATUS) expect(PLACA_LABEL[s]).toBeTruthy();
  });

  it("normaliza valor desconhecido ou nulo para não instalada", () => {
    expect(placaStatusDe(null)).toBe("nao_instalada");
    expect(placaStatusDe(undefined)).toBe("nao_instalada");
    expect(placaStatusDe("qualquer")).toBe("nao_instalada");
    expect(placaStatusDe("instalada")).toBe("instalada");
    expect(placaStatusDe("retirada")).toBe("retirada");
  });

  it("grava a data só quando a placa saiu de não instalada", () => {
    const hoje = new Date("2026-11-19T12:00:00Z");
    expect(dataDaPlaca("nao_instalada", hoje)).toBeNull();
    expect(dataDaPlaca("instalada", hoje)).toBe("2026-11-19");
    expect(dataDaPlaca("retirada", hoje)).toBe("2026-11-19");
  });
});
