import { describe, expect, it, vi } from "vitest";
// @ts-expect-error módulo .mjs sem tipos
import { comRetentativas } from "./verificar-firebase-preview.mjs";

describe("comRetentativas", () => {
  it("repete até a verificação passar", async () => {
    const op = vi.fn().mockRejectedValueOnce(new Error("404")).mockResolvedValue("ok");
    await expect(comRetentativas(op, { tentativas: 3, esperaMs: 0 })).resolves.toBe("ok");
    expect(op).toHaveBeenCalledTimes(2);
  });
  it("falha com o último erro ao esgotar as tentativas", async () => {
    const op = vi.fn().mockRejectedValue(new Error("404"));
    await expect(comRetentativas(op, { tentativas: 3, esperaMs: 0 })).rejects.toThrow("404");
    expect(op).toHaveBeenCalledTimes(3);
  });
});
