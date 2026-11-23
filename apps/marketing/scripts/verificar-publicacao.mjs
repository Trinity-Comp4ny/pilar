// Valida os arquivos que o Firebase realmente vai servir, antes de publicar.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { JSDOM } from "jsdom";

export function validarPublicacao(dist, base, rotas) {
  function ler(arquivo, xml = false) {
    return new JSDOM(readFileSync(join(dist, arquivo), "utf8"), {
      contentType: xml ? "application/xml" : "text/html",
    });
  }

  const sitemap = ler("sitemap.xml", true);
  const urls = Array.from(sitemap.window.document.getElementsByTagName("loc"), (loc) => loc.textContent.trim());
  sitemap.window.close();
  const esperadas = new Set(rotas.map((rota) => new URL(rota, base).href));
  const encontradas = new Set();
  const falhas = [];
  for (const url of urls) {
    if (!esperadas.has(url)) falhas.push(`URL sem prerender no sitemap: ${url}`);
    if (encontradas.has(url)) falhas.push(`URL repetida no sitemap: ${url}`);
    encontradas.add(url);
  }

  for (const rota of rotas) {
    const url = new URL(rota, base).href;
    if (!encontradas.has(url)) falhas.push(`URL ausente no sitemap: ${url}`);
    const dom = ler(rota === "/" ? "index.html" : join(rota.slice(1), "index.html"));
    const doc = dom.window.document;
    const canonicals = doc.head.querySelectorAll('link[rel="canonical"]');
    if (canonicals.length !== 1 || canonicals[0].getAttribute("href") !== url) {
      falhas.push(`Canonical inválido em ${rota}`);
    }
    const diretivas = [...doc.head.querySelectorAll('meta[name="robots" i], meta[name="googlebot" i]')];
    if (diretivas.some((meta) => /(?:^|[\s,])(?:noindex|none)(?=$|[\s,])/i.test(meta.content))) {
      falhas.push(`Rota do sitemap com noindex: ${rota}`);
    }
    if (!doc.title.trim() || !doc.head.querySelector('meta[name="description"]')?.content.trim()) {
      falhas.push(`Título ou descrição ausente em ${rota}`);
    }
    const ogUrls = doc.head.querySelectorAll('meta[property="og:url"]');
    if (ogUrls.length !== 1 || ogUrls[0].getAttribute("content") !== url) {
      falhas.push(`URL de compartilhamento inválida em ${rota}`);
    }
    if (![...doc.querySelectorAll("#root main h1")].some((h1) => h1.textContent.trim())) {
      falhas.push(`HTML pré-renderizado sem título principal em ${rota}`);
    }
    dom.window.close();
  }

  const erro = ler("404.html");
  const paginaDeErro = erro.window.document;
  const robotsDoErro = paginaDeErro.querySelector('meta[name="robots"]')?.content ?? "";
  if (!paginaDeErro.querySelector("main h1")?.textContent.trim() || !/\bnoindex\b/i.test(robotsDoErro)) {
    falhas.push("Página 404 sem título principal ou noindex");
  }
  if (paginaDeErro.querySelector('link[rel="canonical"]')) falhas.push("Página 404 com canonical");
  erro.window.close();

  const robots = readFileSync(join(dist, "robots.txt"), "utf8");
  if (!robots.split(/\r?\n/).some((linha) => linha.trim() === `Sitemap: ${base}/sitemap.xml`)) {
    falhas.push("robots.txt não referencia o sitemap canônico");
  }
  if (falhas.length) throw new Error(falhas.join("\n"));
  console.log(`[seo] ${encontradas.size} URLs do sitemap com conteúdo, canonical e URL de compartilhamento validados.`);
}
