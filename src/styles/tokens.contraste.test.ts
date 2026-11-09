import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// BEZ-389: o comentário do tokens.css afirmava AA garantido nos pares fill/fg, mas branco sobre
// laranja dava 2,8:1 e sobre o verde 3,3:1. Este teste lê o arquivo de verdade e reprova par abaixo de 4,5:1.

const css = readFileSync(join(process.cwd(), "src/styles/tokens.css"), "utf8");

/** Valor de `--nome: ...;` como está no arquivo (sem comentário no fim). */
function valorDe(nome: string): string {
  const m = css.match(new RegExp(`--${nome}:\\s*([^;]+);`));
  if (!m) throw new Error(`token --${nome} não encontrado`);
  return m[1].replace(/\/\*.*?\*\//g, "").trim();
}

/** "142 76% 36%" ou "var(--outro)" até chegar em H S% L%. */
function hslDe(nome: string, profundidade = 0): [number, number, number] {
  if (profundidade > 5) throw new Error(`--${nome}: referência circular`);
  const v = valorDe(nome);
  const ref = v.match(/^var\(--([\w-]+)\)$/);
  if (ref) return hslDe(ref[1], profundidade + 1);
  const m = v.match(/^(-?[\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/);
  if (!m) throw new Error(`--${nome}: formato HSL inesperado (${v})`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function luminancia([h, s, l]: [number, number, number]): number {
  const S = s / 100;
  const L = l / 100;
  const a = S * Math.min(L, 1 - L);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return L - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = [f(0), f(8), f(4)].map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(a: [number, number, number], b: [number, number, number]): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const FAMILIAS = ["danger", "warning", "attention", "info", "success"];

describe("tokens.css: pares fill e texto por cima", () => {
  it.each(FAMILIAS)("fill-%s com o texto fg passa AA (4,5:1)", (familia) => {
    const razao = contraste(hslDe(`fill-${familia}`), hslDe(`fill-${familia}-fg`));
    expect(razao, `${familia}: ${razao.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
  });

  it("a conta bate com valores conhecidos (branco sobre preto 21:1, tinta sobre branco)", () => {
    expect(contraste([0, 0, 0], [0, 0, 100])).toBeCloseTo(21, 0);
    expect(contraste([0, 0, 10], [0, 0, 100])).toBeGreaterThan(16);
  });
});
