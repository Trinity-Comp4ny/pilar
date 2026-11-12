import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Ação, progresso e seleção usam o verde da marca, nunca o preto (`--primary` é o ink).
// Pedido do Matheus em 12/11: barra de progresso e botão de adicionar pretos saíram do app.
const PRIMITIVOS = ["button", "progress", "switch", "checkbox", "calendar", "badge", "sonner"];

describe("sem preto em ação, progresso e seleção", () => {
  it.each(PRIMITIVOS)("ui/%s não pinta fundo com bg-primary", (nome) => {
    const fonte = readFileSync(`src/components/ui/${nome}.tsx`, "utf8");
    expect(fonte).not.toMatch(/bg-primary(?!\/)/);
  });
});
