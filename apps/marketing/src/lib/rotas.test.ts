import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MODULOS } from "./modules";
import { COMPARATIVOS } from "./comparativos";

/**
 * As rotas da landing vivem em quatro lugares que não se importam entre si: o
 * roteador (`App.tsx`), o `sitemap.xml`, o `llms.txt` e a lista do prerender.
 * Página nova que entra num e esquece os outros some da busca (ou vira 404 no
 * HTML pronto). Aqui os quatro são lidos como texto e comparados.
 */

const ler = (relativo: string) => readFileSync(fileURLToPath(new URL(relativo, import.meta.url)), "utf8");

const BASE = "https://www.pilarsoft.com.br";

/** Slugs dos artigos: um arquivo `.md` por artigo em `src/content/blog`. */
const SLUGS_BLOG = readdirSync(join(dirname(fileURLToPath(import.meta.url)), "../content/blog"))
  .filter((n) => n.endsWith(".md"))
  .map((n) => n.replace(/\.md$/, ""));

/** Paths declarados no `<Routes>` do App, sem o curinga do 404. */
function rotasDeclaradas(): string[] {
  const fonte = ler("../App.tsx");
  return [...fonte.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1]).filter((p) => p !== "*");
}

/** As URLs de verdade: a rota dinâmica do artigo vira uma URL por arquivo do blog. */
function rotasDoApp(): string[] {
  return rotasDeclaradas().flatMap((p) => (p === "/blog/:slug" ? SLUGS_BLOG.map((s) => `/blog/${s}`) : [p]));
}

function rotasDoSitemap(): string[] {
  return [...ler("../../public/sitemap.xml").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) =>
    m[1].replace(BASE, "").replace(/(.)\/$/, "$1")
  );
}

function rotasDoLlms(): string[] {
  return [...ler("../../public/llms.txt").matchAll(/\]\((https:\/\/www\.pilarsoft\.com\.br[^)]*)\)/g)].map((m) =>
    m[1].replace(BASE, "").replace(/(.)\/$/, "$1")
  );
}

function rotasDoPrerender(): string[] {
  const bloco = ler("../../scripts/prerender.mjs").match(/const ROTAS = \[([\s\S]*?)\];/);
  if (!bloco) throw new Error("lista ROTAS não encontrada no prerender.mjs");
  return [...bloco[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

const ordenado = (xs: string[]) => [...xs].sort();

describe("rotas da landing", () => {
  const app = rotasDoApp();

  it("o roteador tem as rotas esperadas e um curinga de 404", () => {
    expect(ordenado(rotasDeclaradas())).toEqual(
      ordenado([
        "/",
        "/gestao",
        "/projetos",
        "/obra",
        "/portal",
        "/campo",
        "/vs/planilha",
        "/vs/trello",
        "/vs/whatsapp",
        "/vs/notion",
        "/vs/erp-construtora",
        "/ferramentas",
        "/ferramentas/calculadora-de-honorarios",
        "/ferramentas/modelo-de-proposta",
        "/engenharia",
        "/arquitetura",
        "/blog",
        "/blog/:slug",
        "/faq",
        "/planos",
        "/termos",
        "/privacidade",
      ])
    );
    expect(ler("../App.tsx")).toMatch(/<Route\s+path="\*"\s+element={<NotFound \/>}/);
  });

  it("todo módulo e todo comparativo tem rota", () => {
    for (const m of MODULOS) expect(app).toContain(`/${m.slug}`);
    for (const c of COMPARATIVOS) expect(app).toContain(`/vs/${c.slug}`);
  });

  it("cada rota de módulo e de comparativo passa o próprio slug para a página", () => {
    const fonte = ler("../App.tsx");
    for (const m of MODULOS) {
      expect(fonte).toContain(`<Route path="/${m.slug}" element={<ModulePage slug="${m.slug}" />} />`);
    }
    for (const c of COMPARATIVOS) {
      expect(fonte).toContain(`<Route path="/vs/${c.slug}" element={<ComparativoPage slug="${c.slug}" />} />`);
    }
  });

  it("o sitemap lista exatamente as rotas do roteador, sem duplicar", () => {
    const sitemap = rotasDoSitemap();
    expect(new Set(sitemap).size).toBe(sitemap.length);
    expect(ordenado(sitemap)).toEqual(ordenado(app));
  });

  it("o prerender gera HTML pronto para exatamente as rotas do roteador", () => {
    expect(ordenado(rotasDoPrerender())).toEqual(ordenado(app));
  });

  it("o llms.txt só aponta para rotas que existem, e cobre módulos, comparativos, planos e FAQ", () => {
    const llms = rotasDoLlms();
    for (const rota of llms) expect(app).toContain(rota);
    for (const m of MODULOS) expect(llms).toContain(`/${m.slug}`);
    for (const c of COMPARATIVOS) expect(llms).toContain(`/vs/${c.slug}`);
    for (const s of SLUGS_BLOG) expect(llms).toContain(`/blog/${s}`);
    expect(llms).toEqual(expect.arrayContaining(["/", "/planos", "/faq", "/blog", "/engenharia", "/arquitetura"]));
  });

  it("toda URL do sitemap tem <lastmod> em AAAA-MM-DD", () => {
    const urls = [...ler("../../public/sitemap.xml").matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => m[1]);
    expect(urls.length).toBeGreaterThan(0);
    for (const u of urls) expect(u).toMatch(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
  });

  it("o blog tem artigo e nenhum artigo some do sitemap", () => {
    expect(SLUGS_BLOG.length).toBeGreaterThan(0);
    for (const s of SLUGS_BLOG) expect(app).toContain(`/blog/${s}`);
  });

  it("o build da Vercel gera o spa.html que o rewrite do vercel.json usa", () => {
    // Em 11/11/2026 o build da Vercel era só `vite build`: sem o prerender não havia
    // spa.html, e toda rota abaixo da home caía em 404 em produção.
    const vercel = JSON.parse(ler("../../vercel.json")) as { rewrites: { source: string; destination: string }[] };
    expect(vercel.rewrites.map((r) => r.destination)).toContain("/spa.html");
    const pacote = JSON.parse(ler("../../package.json")) as { scripts: Record<string, string> };
    expect(pacote.scripts.build).toMatch(/node scripts\/prerender\.mjs/);
    expect(ler("../../scripts/prerender.mjs")).toMatch(/writeFileSync\(join\(DIST, "spa\.html"\)/);
  });

  it("o robots.txt aponta para o sitemap", () => {
    expect(ler("../../public/robots.txt")).toContain(`Sitemap: ${BASE}/sitemap.xml`);
  });

  it("nenhum redirect da Vercel sequestra uma rota da landing para o app", () => {
    const vercel = JSON.parse(ler("../../vercel.json")) as {
      redirects: { source: string; destination: string }[];
    };
    // `/:rota(REGEX)` do path-to-regexp vira `^/(REGEX)$`; os demais sources são literais.
    const padroes = vercel.redirects.map((r) => {
      const grupo = r.source.match(/^\/:rota\((.*)\)$/);
      return grupo ? new RegExp(`^/${grupo[1]}$`) : new RegExp(`^${r.source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);
    });
    for (const rota of app) {
      for (const p of padroes) expect(p.test(rota), `${rota} casa com ${p}`).toBe(false);
    }
    // Sanidade: o padrão realmente captura rota de app (senão o teste acima passaria à toa).
    expect(padroes.some((p) => p.test("/login"))).toBe(true);
    expect(padroes.some((p) => p.test("/projetos/123"))).toBe(true);
  });
});
