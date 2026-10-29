import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Logo } from "./Logo";
import { PilarMark } from "./motion/PilarMark";
import { PilarWordmark } from "./motion/PilarWordmark";

// BEZ-385: o que roda em produção é o logotipo oficial de brand/assets/logo/ (brand/logo.md, seção 11).
// Antes: caneluras 0,5u fora do eixo, traço #0A0A0A em vez do token #1A1A1A, nome escrito como texto.

const raiz = process.cwd();
const ler = (rel: string) => readFileSync(join(raiz, rel), "utf8");
const oficial = (nome: string) => ler(`brand/assets/logo/${nome}`);

describe("arquivos de produção são os oficiais", () => {
  it.each([
    ["public/favicon.svg", "pilar-favicon.svg"],
    ["apps/marketing/public/favicon.svg", "pilar-favicon.svg"],
    ["public/app-icon.svg", "pilar-app-icon.svg"],
    ["public/pilar-logo.svg", "pilar-mark-ink.svg"],
    ["apps/marketing/public/pilar-logo.svg", "pilar-mark-ink.svg"],
  ])("%s é igual a brand/assets/logo/%s", (producao, ofic) => {
    expect(ler(producao)).toBe(oficial(ofic));
  });

  it("nenhum SVG de produção usa o traço antigo #0A0A0A fora do tile do app-icon", () => {
    for (const f of ["public/favicon.svg", "public/pilar-logo.svg", "apps/marketing/public/favicon.svg"]) {
      expect(ler(f), f).not.toContain("#0A0A0A");
    }
  });
});

/** Largura e altura do PNG, lidas do cabeçalho IHDR. */
function dimensoesPng(rel: string): [number, number] {
  const b = readFileSync(join(raiz, rel));
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

describe("PNGs saem do ícone oficial", () => {
  it.each([
    ["public/apple-touch-icon.png", 180],
    ["public/icon-192.png", 192],
    ["public/icon-512.png", 512],
    ["public/maskable-512.png", 512],
    ["apps/marketing/public/email/logo-v2.png", 96],
  ])("%s tem %i px", (rel, lado) => {
    expect(dimensoesPng(rel)).toEqual([lado, lado]);
  });

  it("o e-mail aponta para a logo versionada v2", () => {
    expect(ler("supabase/functions/_shared/email/brand.ts")).toContain("/email/logo-v2.png");
  });
});

/** Segmentos "x1,y1 x2,y2" de um path de linha reta (M x y H x | V y), em ordem canônica. */
function segmentos(d: string): string {
  const [, x, y, eixo, fim] = d.match(/M([\d.]+) ([\d.]+)([HV])([\d.]+)/)!;
  const a = [Number(x), Number(y)];
  const b = eixo === "H" ? [Number(fim), Number(y)] : [Number(x), Number(fim)];
  return [a, b]
    .sort((p, q) => p[0] - q[0] || p[1] - q[1])
    .map((p) => p.map((n) => +n.toFixed(2)).join(","))
    .join(" ");
}

describe("PilarMark tem a geometria do símbolo oficial", () => {
  it("as seis linhas coincidem com pilar-mark-ink.svg (escala 4x, origem na caixa visível)", () => {
    const traços = [...oficial("pilar-mark-ink.svg").matchAll(/<path d="([^"]+)"/g)].map((m) => m[1]);
    // Oficial: unidade u * 4, com origem em (0,2; 1,2): capitel x1 = 1, y = 2 (ver scripts/brand/build.py).
    const esperado = traços
      .map((d) => {
        const [, x, y, eixo, fim] = d.match(/M([\d.]+) ([\d.]+)([HV])([\d.]+)/)!;
        const u = (v: string, o: number) => +(Number(v) / 4 + o).toFixed(2);
        const [x1, y1] = [u(x, 0.2), u(y, 1.2)];
        const [x2, y2] = eixo === "H" ? [u(fim, 0.2), y1] : [x1, u(fim, 1.2)];
        return segmentos(`M${x1} ${y1}${eixo}${eixo === "H" ? x2 : y2}`);
      })
      .sort();

    const { container } = render(<PilarMark />);
    const atual = [...container.querySelectorAll("path")].map((p) => segmentos(p.getAttribute("d")!)).sort();
    expect(atual).toEqual(esperado);
  });
});

describe("PilarWordmark é o nome oficial em curva", () => {
  it("usa o mesmo caminho e a mesma translação de pilar-wordmark-ink.svg", () => {
    const svg = oficial("pilar-wordmark-ink.svg");
    const d = svg.match(/<path d="([^"]+)" transform="([^"]+)"/)!;
    const { container } = render(<PilarWordmark />);
    const p = container.querySelector("path")!;
    expect(p.getAttribute("d")).toBe(d[1]);
    expect(p.getAttribute("transform")).toBe(d[2]);
    expect(container.querySelector("svg")!.getAttribute("viewBox")).toBe(svg.match(/viewBox="([^"]+)"/)![1]);
  });
});

describe("Logo", () => {
  it("o nome não é texto: some da árvore de texto e entra como desenho", () => {
    const { container } = render(<Logo />);
    expect(screen.queryByText("Pilar")).not.toBeInTheDocument();
    expect(container.querySelectorAll("svg")).toHaveLength(2);
  });

  it("variante só do símbolo não leva o nome", () => {
    const { container } = render(<Logo variant="mark" />);
    expect(container.querySelectorAll("svg")).toHaveLength(1);
    expect(screen.getByRole("img", { name: "Pilar" })).toBeInTheDocument();
  });
});
