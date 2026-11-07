import { describe, expect, it } from "vitest";
import { agruparPorCanal } from "./OrigemDemos";

describe("agruparPorCanal", () => {
  it("conta por canal, do maior ao menor, com rótulo legível", () => {
    const r = agruparPorCanal([
      { canal: "google" },
      { canal: "chatgpt" },
      { canal: "chatgpt" },
      { canal: "newsletter" },
    ]);
    expect(r).toEqual([
      { canal: "chatgpt", rotulo: "ChatGPT", total: 2 },
      { canal: "google", rotulo: "Google (busca)", total: 1 },
      { canal: "newsletter", rotulo: "newsletter", total: 1 },
    ]);
  });
});
