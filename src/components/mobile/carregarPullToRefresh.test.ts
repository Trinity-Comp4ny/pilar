import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { carregarPullToRefresh } from "./carregarPullToRefresh";

describe("carregarPullToRefresh", () => {
  it("não gera outro erro quando o Vite suprime a rejeição durante o reload", async () => {
    const modulo = await carregarPullToRefresh(async () => undefined);
    expect(modulo.default()).toBeNull();
  });

  it("preserva o componente do módulo carregado", async () => {
    const PullToRefresh = () => createElement("div");
    await expect(carregarPullToRefresh(async () => ({ PullToRefresh }))).resolves.toEqual({ default: PullToRefresh });
  });

  it("preserva a falha original de uma importação não recuperada", async () => {
    const erro = new Error("Importing a module script failed.");
    await expect(
      carregarPullToRefresh(async () => {
        throw erro;
      })
    ).rejects.toBe(erro);
  });
});
