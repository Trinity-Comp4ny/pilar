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
  "/gestao",
  "/projetos",
  "/obra",
  "/portal",
  "/campo",
  "/vs/planilha",
  "/vs/trello",
  "/faq",
  "/planos",
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
  if (ok !== ROTAS.length) process.exit(1);
}

main();
