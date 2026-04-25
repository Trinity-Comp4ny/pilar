import { describe, it, expect } from "vitest";
import { passwordSchema, evaluatePassword } from "./passwordPolicy";

describe("passwordSchema", () => {
  it("aceita senha forte com 12+ chars e complexity", () => {
    const r = passwordSchema.safeParse("Abcdef1!ghij");
    expect(r.success).toBe(true);
  });

  it("rejeita senha curta", () => {
    const r = passwordSchema.safeParse("Abc1!");
    expect(r.success).toBe(false);
  });

  it("rejeita sem maiúscula", () => {
    const r = passwordSchema.safeParse("abcdef1!ghij");
    expect(r.success).toBe(false);
  });

  it("rejeita sem minúscula", () => {
    const r = passwordSchema.safeParse("ABCDEF1!GHIJ");
    expect(r.success).toBe(false);
  });

  it("rejeita sem número", () => {
    const r = passwordSchema.safeParse("Abcdef!ghijkl");
    expect(r.success).toBe(false);
  });

  it("rejeita sem especial", () => {
    const r = passwordSchema.safeParse("Abcdef1ghijkl");
    expect(r.success).toBe(false);
  });
});

describe("evaluatePassword", () => {
  it("senha vazia = muito fraca", () => {
    const r = evaluatePassword("");
    expect(r.score).toBe(0);
    expect(r.label).toBe("muito fraca");
    expect(r.feedback.length).toBeGreaterThan(0);
  });

  it("senha forte = muito forte", () => {
    const r = evaluatePassword("SenhaMuitoForte123!");
    expect(r.score).toBe(4);
    expect(r.label).toBe("muito forte");
  });

  it("senha média sem especial", () => {
    const r = evaluatePassword("Senhadelongo123");
    expect(r.score).toBe(3);
    expect(r.feedback.some((f) => /especial/i.test(f))).toBe(true);
  });
});
