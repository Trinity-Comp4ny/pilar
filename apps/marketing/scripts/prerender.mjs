// Prerender das rotas da landing, rodado no `npm run build` (o build da Vercel e do CI).
//
// A LP é uma SPA: sem isto, o servidor entrega o mesmo HTML quase vazio para toda
// rota e só o JavaScript, no navegador, grava o title, a description, o canonical e
// o conteúdo de cada página. O Google espera o JS, mas o WhatsApp, o LinkedIn
// (preview de link) e a maioria dos robôs de IA leem só o HTML que veio pronto.
//
// Aqui cada rota é montada num documento jsdom, com o código-fonte do App carregado
// pelo Vite em modo SSR (scripts/prerender-entry.tsx), e o HTML final é gravado em
// dist/<rota>/index.html. Sem navegador: a versão anterior usava Playwright, que não
// roda no build da Vercel, e por isso a produção ficou sem prerender e sem o
// spa.html de fallback: toda rota abaixo da home dava 404 (corrigido em 11/11/2026).
//
// O shell original (com o anel de boot, ADR 0049) vira dist/spa.html, que o
// vercel.json usa como fallback para rota sem HTML pronto. Ele é gravado antes de
// tudo: mesmo se uma rota falhar, nenhuma página volta a dar 404.
//
// Usuário de verdade não muda de experiência: o main.tsx monta com createRoot, que
// substitui esse HTML pelo render do React assim que o bundle carrega.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { createServer } from "vite";

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const DIST = join(RAIZ, "dist");
const BASE = "https://www.pilarsoft.com.br";

const ROTAS = [
  "/",
  "/engenharia",
  "/arquitetura",
  "/gestao",
  "/projetos",
  "/obra",
  "/portal",
  "/campo",
  "/planos",
  "/blog",
  "/blog/aditivo-de-projeto",
  "/blog/aporte-obra-administracao",
  "/blog/art-rrt-projeto-obra",
  "/blog/como-organizar-escritorio-arquitetura",
  "/blog/como-organizar-escritorio-engenharia",
  "/blog/como-precificar-projeto-arquitetura-engenharia",
  "/blog/compatibilizacao-de-projetos",
  "/blog/conciliacao-bancaria-escritorio",
  "/blog/contrato-de-projeto",
  "/blog/controle-prazo-projetos-disciplinas",
  "/blog/cotacao-material-obra",
  "/blog/crm-escritorio-arquitetura",
  "/blog/cronograma-projeto-arquitetura",
  "/blog/diario-de-obra-rdo",
  "/blog/efetivo-de-obra",
  "/blog/entrega-tecnica-pos-obra",
  "/blog/escopo-de-projeto-engenharia",
  "/blog/fluxo-de-caixa-escritorio-engenharia",
  "/blog/gestao-de-equipe-escritorio-engenharia",
  "/blog/gestao-de-obra-para-arquitetos",
  "/blog/ia-escritorio-engenharia",
  "/blog/inadimplencia-escritorio-arquitetura",
  "/blog/indicadores-escritorio-engenharia",
  "/blog/medicao-de-obra",
  "/blog/modelo-proposta-projeto-arquitetura",
  "/blog/obra-por-administracao-prestacao-de-contas",
  "/blog/planilha-controle-de-projetos",
  "/blog/portal-do-cliente-arquitetura",
  "/blog/prazo-projeto-estrutural",
  "/blog/projeto-instalacoes-prediais-mep",
  "/blog/proposta-projeto-engenharia",
  "/blog/quanto-cobrar-projeto-eletrico",
  "/blog/quanto-cobrar-projeto-estrutural",
  "/blog/relatorio-de-obra-cliente",
  "/blog/rentabilidade-projeto-engenharia",
  "/blog/retrabalho-projeto-engenharia",
  "/blog/sistema-gestao-escritorio-arquitetura",
  "/blog/software-arquitetura-vs-gestao",
  "/blog/software-gestao-escritorio-engenharia",
  "/blog/taxa-de-administracao-de-obra",
  "/ferramentas",
  "/ferramentas/calculadora-de-honorarios",
  "/ferramentas/modelo-de-proposta",
  "/vs/planilha",
  "/vs/trello",
  "/vs/whatsapp",
  "/vs/notion",
  "/vs/erp-construtora",
  "/faq",
  "/termos",
  "/privacidade",
  "/seguranca",
];

/** Escapa texto para XML (título e descrição dos artigos no feed). */
const xml = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Feed RSS do blog em dist/blog/feed.xml, lido direto dos arquivos de
 * src/content/blog (mesma fonte da página). Leitor de feed e agregador descobrem
 * artigo novo sem esperar o Google passar.
 */
function gravarFeed() {
  const dir = fileURLToPath(new URL("../src/content/blog", import.meta.url));
  if (!existsSync(dir)) return 0;
  const artigos = readdirSync(dir)
    .filter((n) => n.endsWith(".md"))
    .map((nome) => {
      const fm = readFileSync(join(dir, nome), "utf8").match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
      const campo = (c) => fm.match(new RegExp(`^${c}:\\s*(.*)$`, "m"))?.[1]?.trim() ?? "";
      return {
        slug: nome.replace(/\.md$/, ""),
        titulo: campo("titulo"),
        descricao: campo("descricao"),
        categoria: campo("categoria"),
        data: campo("publicadoEm"),
      };
    })
    .sort((a, b) => b.data.localeCompare(a.data));
  const BASE = "https://www.pilarsoft.com.br";
  const itens = artigos
    .map(
      (a) => `    <item>
      <title>${xml(a.titulo)}</title>
      <link>${BASE}/blog/${a.slug}</link>
      <guid isPermaLink="true">${BASE}/blog/${a.slug}</guid>
      <description>${xml(a.descricao)}</description>
      <category>${xml(a.categoria)}</category>
      <pubDate>${new Date(`${a.data}T12:00:00Z`).toUTCString()}</pubDate>
    </item>`
    )
    .join("\n");
  const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Blog do Pilar</title>
    <link>${BASE}/blog</link>
    <atom:link href="${BASE}/blog/feed.xml" rel="self" type="application/rss+xml" />
    <description>Gestão para escritórios de engenharia e arquitetura: proposta, prazo, obra e financeiro.</description>
    <language>pt-BR</language>
${itens}
  </channel>
</rss>
`;
  mkdirSync(join(DIST, "blog"), { recursive: true });
  writeFileSync(join(DIST, "blog", "feed.xml"), feed);
  return artigos.length;
}

/**
 * Põe o documento jsdom no escopo global, como num navegador, e preenche o que o
 * jsdom não tem e a landing usa (matchMedia, IntersectionObserver, ResizeObserver,
 * scrollTo): os mesmos stubs do ambiente de teste (src/test/ambiente.tsx).
 */
function instalarDocumento(dom) {
  const w = dom.window;
  class ObservadorParado {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  w.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  });
  w.IntersectionObserver = ObservadorParado;
  w.ResizeObserver = ObservadorParado;
  w.scrollTo = () => {};
  // canvas da cena da hero: sem contexto 2D no jsdom, a cena só não desenha.
  w.HTMLCanvasElement.prototype.getContext = () => null;

  const globais = [
    "window",
    "document",
    "navigator",
    "location",
    "history",
    "localStorage",
    "sessionStorage",
    "HTMLElement",
    "HTMLCanvasElement",
    "Element",
    "Node",
    "Text",
    "DocumentFragment",
    "MutationObserver",
    "IntersectionObserver",
    "ResizeObserver",
    "getComputedStyle",
    "matchMedia",
    "requestAnimationFrame",
    "cancelAnimationFrame",
    "CustomEvent",
    "Event",
    "KeyboardEvent",
    "MouseEvent",
    "SVGElement",
  ];
  for (const nome of globais) {
    Object.defineProperty(globalThis, nome, { configurable: true, writable: true, value: w[nome] });
  }
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
}

async function main() {
  if (!existsSync(join(DIST, "index.html"))) {
    console.error("[prerender] dist/index.html não existe. Rode `vite build` antes.");
    process.exit(1);
  }

  const original = readFileSync(join(DIST, "index.html"), "utf8");
  const BLOCO_BOOT = /[ \t]*<!-- boot:start -->[\s\S]*?<!-- boot:end -->\n?/;
  if (!BLOCO_BOOT.test(original)) {
    console.error("[prerender] index.html sem o bloco <!-- boot:start/end -->.");
    process.exit(1);
  }
  // Primeiro o fallback: com ele no lugar, rota sem HTML pronto ainda abre (como SPA).
  writeFileSync(join(DIST, "spa.html"), original);
  const shellSemBoot = original.replace(BLOCO_BOOT, "");

  // O jsdom precisa existir antes de o App ser importado (framer-motion e afins
  // olham window no carregamento do módulo).
  instalarDocumento(new JSDOM(shellSemBoot, { url: `${BASE}/`, pretendToBeVisual: true }));

  const vite = await createServer({
    root: RAIZ,
    configFile: join(RAIZ, "vite.config.ts"),
    logLevel: "error",
    appType: "custom",
    server: { middlewareMode: true, hmr: false, ws: false },
  });

  let ok = 0;
  const falhas = [];
  try {
    const { renderizar } = await vite.ssrLoadModule("/scripts/prerender-entry.tsx");
    for (const rota of ROTAS) {
      const dom = new JSDOM(shellSemBoot, { url: `${BASE}${rota}`, pretendToBeVisual: true });
      instalarDocumento(dom);
      try {
        const desmontar = await renderizar(rota);
        const html = dom.serialize();
        await desmontar();
        const destino = rota === "/" ? join(DIST, "index.html") : join(DIST, rota.replace(/^\//, ""), "index.html");
        mkdirSync(join(destino, ".."), { recursive: true });
        writeFileSync(destino, html);
        ok++;
      } catch (erro) {
        falhas.push(rota);
        console.error(`[prerender] falhou em ${rota}:`, erro.message);
      } finally {
        dom.window.close();
      }
    }
  } finally {
    await vite.close();
  }

  console.log(`[prerender] ${ok}/${ROTAS.length} rotas gravadas em dist/, shell com boot em dist/spa.html.`);
  console.log(`[prerender] feed do blog com ${gravarFeed()} artigos em dist/blog/feed.xml.`);
  if (falhas.length) process.exit(1);
  // Timers de animação do jsdom seguram o processo aberto.
  process.exit(0);
}

main();
