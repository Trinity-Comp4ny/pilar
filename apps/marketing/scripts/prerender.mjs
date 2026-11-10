// Prerender das rotas de marketing, rodado como `postbuild` (ver package.json).
//
// A LP é uma SPA: o servidor entrega um HTML quase vazio e só depois que o
// JS roda no navegador é que `usePageMeta` (src/lib/seo.ts) grava o title, a
// description e o canonical certos de cada rota. O Google espera o JS rodar,
// mas o WhatsApp, o LinkedIn (preview de link) e a maioria dos robôs de IA
// não esperam: eles leem só o HTML que veio pronto. Pra eles, toda rota virava
// a home.
//
// Este script abre cada rota num Chromium headless (Playwright, já usado no
// repo pros testes e2e), deixa o React montar e o `usePageMeta` gravar as tags
// certas, e salva o HTML final como arquivo estático em `dist/<rota>/index.html`.
// A Vercel serve arquivo estático antes de aplicar o rewrite de SPA do
// vercel.json, então cada rota passa a chegar pronta pra quem não roda JS.
//
// Usuário de verdade não muda de experiência: o `main.tsx` continua montando
// com `createRoot`, que substitui esse HTML pelo render do React assim que o
// bundle carrega. O que fica gravado é só uma "foto" de um estado plausível
// (deslogado): não é usado como fonte de verdade, é usado como HTML de
// primeira leitura para quem não executa JavaScript.

import { chromium } from "playwright";
import { createServer } from "node:http";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DIST = fileURLToPath(new URL("../dist", import.meta.url));

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
];

const TIPOS_MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".json": "application/json; charset=utf-8",
};

/** Arquivos de `dist/` por URL ("/assets/x.js" → caminho no disco). */
function listarArquivos(dir, prefixo = "") {
  const mapa = new Map();
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const url = `${prefixo}/${item.name}`;
    const caminho = join(dir, item.name);
    if (!item.isDirectory()) mapa.set(url, caminho);
    else for (const [u, c] of listarArquivos(caminho, url)) mapa.set(u, c);
  }
  return mapa;
}

/** Serve `dist/` com o mesmo fallback da Vercel: rota (URL sem extensão) recebe o
 * spa.html, o shell original; o index.html raiz vira a home pré-renderizada logo
 * na primeira rota. É o suficiente pra primeira carga do Chromium; o React Router
 * assume o resto no cliente. Asset sai de um mapa montado na partida, então nada
 * da URL vira caminho de disco ("/../package.json" simplesmente não existe). */
function servirDist() {
  const arquivos = listarArquivos(DIST);
  const shell = join(DIST, "spa.html");
  return createServer((req, res) => {
    const url = req.url.split("?")[0];
    const caminho = extname(url) ? arquivos.get(url) : shell;
    if (!caminho) {
      res.writeHead(404);
      res.end();
      return;
    }
    const tipo = TIPOS_MIME[extname(caminho)] ?? "application/octet-stream";
    res.writeHead(200, { "Content-Type": tipo });
    res.end(readFileSync(caminho));
  });
}

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

async function main() {
  if (!existsSync(join(DIST, "index.html"))) {
    console.error("[prerender] dist/index.html não existe. Rode `vite build` antes.");
    process.exit(1);
  }

  const servidor = servirDist();
  await new Promise((resolve) => servidor.listen(0, resolve));
  const porta = servidor.address().port;
  const base = `http://127.0.0.1:${porta}`;

  // O boot (ADR 0049) é o anel que cobre a página enquanto o JavaScript baixa. Rota
  // pré-renderizada já chega pronta e não precisa dele: o bloco sai do HTML, junto
  // com o <script> síncrono que seguraria a leitura do conteúdo (LCP). O shell
  // original, com o boot, vira spa.html, que o vercel.json usa de fallback para
  // rota sem HTML pronto. Gravado antes do loop: o "/" sobrescreve o index.html.
  const original = readFileSync(join(DIST, "index.html"), "utf8");
  const BLOCO_BOOT = /[ \t]*<!-- boot:start -->[\s\S]*?<!-- boot:end -->\n?/;
  if (!BLOCO_BOOT.test(original)) {
    console.error("[prerender] index.html sem o bloco <!-- boot:start/end -->.");
    process.exit(1);
  }
  writeFileSync(join(DIST, "spa.html"), original);
  const semBoot = (html) => html.replace(BLOCO_BOOT, "");

  const browser = await chromium.launch();
  const contexto = await browser.newContext();

  let ok = 0;
  for (const rota of ROTAS) {
    const pagina = await contexto.newPage();
    try {
      await pagina.goto(`${base}${rota}`, { waitUntil: "networkidle", timeout: 15000 });
      // Dá tempo pro useEffect de usePageMeta gravar title/meta antes do
      // snapshot; a UI em si já está montada no primeiro paint.
      await pagina.waitForTimeout(200);
      const html = semBoot(await pagina.content());

      const destino = rota === "/" ? join(DIST, "index.html") : join(DIST, rota.replace(/^\//, ""), "index.html");
      mkdirSync(join(destino, ".."), { recursive: true });
      writeFileSync(destino, html);
      ok++;
    } catch (erro) {
      console.error(`[prerender] falhou em ${rota}:`, erro.message);
    } finally {
      await pagina.close();
    }
  }

  await browser.close();
  servidor.close();

  console.log(`[prerender] ${ok}/${ROTAS.length} rotas gravadas em dist/, shell com boot em dist/spa.html.`);
  console.log(`[prerender] feed do blog com ${gravarFeed()} artigos em dist/blog/feed.xml.`);
  if (ok !== ROTAS.length) process.exit(1);
}

main();
