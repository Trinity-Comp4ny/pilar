import { describe, expect, it } from "vitest";
import { PRAZO_PREVIA_ADITIVO_MS, previaAditivoAtualizada } from "./aditivoPrevia";

describe("validade de prévia financeira de aditivos", () => {
  const now = 1_800_000_000_000;

  it("aceita cálculo recente e exatamente no limite", () => {
    expect(previaAditivoAtualizada(now - 100, now)).toBe(true);
    expect(previaAditivoAtualizada(now - PRAZO_PREVIA_ADITIVO_MS, now)).toBe(true);
  });

  it("recusa prévia mais antiga que o limite", () => {
    expect(previaAditivoAtualizada(now - PRAZO_PREVIA_ADITIVO_MS - 1, now)).toBe(false);
  });

  it("recusa ausência de cálculo e valores futuros inconsistentes", () => {
    expect(previaAditivoAtualizada(0, now)).toBe(false);
    expect(previaAditivoAtualizada(now + 1, now)).toBe(false);
  });
});
