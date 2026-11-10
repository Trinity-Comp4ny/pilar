// Nota de SEO da landing (0 a 100), para acompanhar a evolução ao longo do tempo.
//
// Uso (depois do build com prerender):
//   npm run build:prerender --workspace=apps/marketing
//   npm run seo:nota --workspace=apps/marketing            # relatório em Markdown
//   node apps/marketing/scripts/seo-nota.mjs --json        # mesmo resultado em JSON
//   node apps/marketing/scripts/seo-nota.mjs <outro-dist>  # mede um build guardado (ex.: o "antes")
//
// Lê o que o Google lê: o HTML pré-renderizado de cada URL do sitemap, o robots.txt
// e o llms.txt de dist/. Soma o conteúdo do blog (src/content/blog) e a checklist do
// que não está no código (Search Console, diretórios, links de outros sites, avaliações),
// mantida à mão em docs/marketing/seo/checklist-externo.json.
//
// A régua e o histórico das notas ficam em docs/marketing/seo/NOTA_SEO.md. Mudou a
// régua? Registre lá, senão a comparação com as notas antigas perde o sentido.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ_APP = fileURLToPath(new URL("..", import.meta.url));
const RAIZ_REPO = join(RAIZ_APP, "..", "..");
const BASE = "https://www.pilarsoft.com.br";

const args = process.argv.slice(2);
const comoJson = args.includes("--json");
const DIST = args.find((a) => !a.startsWith("--")) ?? join(RAIZ_APP, "dist");

/**
 * Palavra-chave alvo de cada página fixa. Os artigos do blog trazem a sua no
 * frontmatter (`palavraChave`). Página fora daqui (termos, privacidade) não entra
 * na conta de palavra-chave, só nas checagens técnicas.
 */
const ALVOS = {
  "/": "gestão escritório engenharia arquitetura",
  "/gestao": "proposta financeiro escritório engenharia",
  "/projetos": "gestão projetos engenharia",
  "/obra": "diário obra",
  "/portal": "portal cliente obra",
  "/campo": "aplicativo diário obra",
  "/planos": "preço software gestão engenharia",
  "/faq": "perguntas frequentes",
  "/vs/planilha": "planilha gestão projetos engenharia",
  "/vs/trello": "trello gestão projetos engenharia",
  "/engenharia": "software gestão escritório engenharia",
  "/arquitetura": "sistema gestão escritório arquitetura",
  "/blog": "blog gestão escritório engenharia arquitetura",
  "/vs/whatsapp": "whatsapp projeto obra",
  "/vs/notion": "notion escritório engenharia arquitetura",
  "/vs/erp-construtora": "erp construtora escritório projeto",
  "/ferramentas": "ferramentas escritório engenharia arquitetura",
  "/ferramentas/calculadora-de-honorarios": "calculadora honorários",
  "/ferramentas/modelo-de-proposta": "modelo proposta projeto",
};

/** Metas de volume: o ponto cheio do item chega quando o número bate aqui. */
const METAS = { artigos: 40, comparativos: 5, ferramentas: 2, palavrasPorArtigo: 900, linksInternos: 3 };

// ---------------------------------------------------------------- leitura

function ler(caminho) {
  return existsSync(caminho) ? readFileSync(caminho, "utf8") : null;
}

function semAcento(texto) {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function decodificar(texto) {
  return texto
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

const textoPuro = (html) =>
  decodificar(html.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();

function atributo(tag, nome) {
  const m = tag.match(new RegExp(`${nome}="([^"]*)"`, "i"));
  return m ? decodificar(m[1]) : null;
}

function meta(html, chave, valor) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    if (atributo(tag, chave) === valor) return atributo(tag, "content");
  }
  return null;
}

function jsonLds(html) {
  const blocos = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  const itens = [];
  for (const [, corpo] of blocos) {
    try {
      const dado = JSON.parse(corpo);
      const lista = Array.isArray(dado) ? dado : dado["@graph"] ? dado["@graph"] : [dado];
      itens.push(...lista);
    } catch {
      itens.push({ "@type": "__invalido__" });
    }
  }
  return itens;
}

/** O <main>, sem header e footer: é o conteúdo próprio da página. */
const corpoPrincipal = (html) => html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? html;

function analisarPagina(rota) {
  const arquivo = rota === "/" ? join(DIST, "index.html") : join(DIST, rota.replace(/^\//, ""), "index.html");
  const html = ler(arquivo);
  if (!html) return { rota, existe: false };
  const main = corpoPrincipal(html);
  const h1s = [...main.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => textoPuro(m[1]));
  const imgs = main.match(/<img\b[^>]*>/gi) ?? [];
  const links = [...main.matchAll(/<a\b[^>]*href="([^"]*)"/gi)].map((m) => m[1]);
  return {
    rota,
    existe: true,
    titulo: decodificar(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? ""),
    descricao: meta(html, "name", "description") ?? "",
    robots: meta(html, "name", "robots") ?? "",
    canonical: atributo(html.match(/<link\b[^>]*rel="canonical"[^>]*>/i)?.[0] ?? "", "href"),
    lang: html.match(/<html\b[^>]*lang="([^"]+)"/i)?.[1] ?? null,
    viewport: Boolean(meta(html, "name", "viewport")),
    ogImage: Boolean(meta(html, "property", "og:image")),
    twitterCard: Boolean(meta(html, "name", "twitter:card")),
    h1s,
    imagens: imgs.length,
    // alt="" é a marcação certa de imagem decorativa; falta é não ter o atributo.
    imagensSemAlt: imgs.filter((t) => atributo(t, "alt") === null).length,
    linksInternos: new Set(links.filter((h) => h.startsWith("/") || h.startsWith(BASE)).map((h) => h.replace(BASE, "")))
      .size,
    palavras: textoPuro(main).split(" ").filter(Boolean).length,
    jsonLd: jsonLds(html),
  };
}

function artigosDoBlog() {
  const dir = join(RAIZ_APP, "src", "content", "blog");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => n.endsWith(".md"))
    .map((nome) => {
      const fonte = readFileSync(join(dir, nome), "utf8");
      const fm = fonte.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
      const campos = Object.fromEntries(
        fm.split("\n").map((l) => {
          const i = l.indexOf(":");
          return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
        })
      );
      return { slug: nome.replace(/\.md$/, ""), ...campos };
    });
}

/** Casa a palavra-chave por radical (5 letras) de cada palavra significativa, sem acento. */
function contemPalavraChave(texto, chave) {
  if (!chave) return false;
  const alvo = semAcento(texto);
  const PARADAS = new Set(["para", "como", "com", "sem", "dos", "das", "por", "uma", "que", "the"]);
  const termos = semAcento(chave)
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length > 2 && !PARADAS.has(p));
  return termos.length > 0 && termos.every((t) => alvo.includes(t.slice(0, 5)));
}

// ---------------------------------------------------------------- régua

const itens = [];
function item(categoria, nome, max, fracao, dica) {
  const f = Math.max(0, Math.min(1, Number.isFinite(fracao) ? fracao : 0));
  itens.push({ categoria, nome, max, pontos: Math.round(max * f * 10) / 10, dica: f < 1 ? dica : null });
}
const fracaoDe = (lista, ok) => (lista.length ? lista.filter(ok).length / lista.length : 0);

const sitemap = ler(join(DIST, "sitemap.xml")) ?? "";
const urls = [...sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => ({
  rota:
    m[1]
      .match(/<loc>([^<]+)<\/loc>/)?.[1]
      .replace(BASE, "")
      .replace(/(.)\/$/, "$1") ?? "",
  lastmod: /<lastmod>/.test(m[1]),
}));
const paginas = urls.map((u) => analisarPagina(u.rota));
const prontas = paginas.filter((p) => p.existe);
const artigos = artigosDoBlog();
const paginasArtigo = prontas.filter((p) => p.rota.startsWith("/blog/"));
const alvoDe = (rota) =>
  rota.startsWith("/blog/") ? artigos.find((a) => `/blog/${a.slug}` === rota)?.palavraChave : ALVOS[rota];
const comAlvo = prontas.filter((p) => alvoDe(p.rota));
const robots = ler(join(DIST, "robots.txt")) ?? "";
const llms = ler(join(DIST, "llms.txt")) ?? "";
const externo = JSON.parse(ler(join(RAIZ_REPO, "docs", "marketing", "seo", "checklist-externo.json")) ?? "{}");
const tipos = (p) => p.jsonLd.map((j) => j["@type"]);
const home = prontas.find((p) => p.rota === "/");
const grafoHome = home?.jsonLd ?? [];

// 1. Técnico (20)
const T = "Técnico";
item(
  T,
  "Toda URL do sitemap tem HTML pré-renderizado",
  3,
  urls.length ? prontas.length / urls.length : 0,
  "Incluir a rota no ROTAS do prerender.mjs."
);
item(
  T,
  "robots.txt libera o site e aponta o sitemap",
  3,
  (/Allow: \//.test(robots) ? 0.5 : 0) + (/Sitemap: /.test(robots) ? 0.5 : 0),
  "Ajustar public/robots.txt."
);
item(
  T,
  "Sitemap com <lastmod> em toda URL",
  2,
  fracaoDe(urls, (u) => u.lastmod),
  "Pôr <lastmod> em cada <url> do sitemap.xml."
);
item(
  T,
  "Canonical apontando para a própria URL",
  3,
  fracaoDe(prontas, (p) => p.canonical === `${BASE}${p.rota === "/" ? "/" : p.rota}`),
  "usePageMeta com o caminho certo."
);
item(
  T,
  "lang pt-BR e viewport",
  2,
  fracaoDe(prontas, (p) => p.lang === "pt-BR" && p.viewport),
  "Conferir o index.html."
);
item(
  T,
  "Imagem de compartilhamento (og:image e twitter:card)",
  2,
  fracaoDe(prontas, (p) => p.ogImage && p.twitterCard),
  "Conferir as metas de OG."
);
item(
  T,
  "Nenhuma página do sitemap com noindex",
  2,
  fracaoDe(prontas, (p) => !/noindex/.test(p.robots)),
  "Tirar do sitemap ou tirar o noindex."
);
{
  const t = prontas.map((p) => p.titulo);
  const d = prontas.map((p) => p.descricao);
  const unicos = (xs) => (xs.length ? new Set(xs).size / xs.length : 0);
  item(
    T,
    "Título e descrição únicos por página",
    3,
    (unicos(t) + unicos(d)) / 2,
    "Cada página com title e description próprios."
  );
}

// 2. On-page (25)
const O = "On-page";
item(
  O,
  "Título com 30 a 65 caracteres",
  5,
  fracaoDe(prontas, (p) => p.titulo.length >= 30 && p.titulo.length <= 65),
  "Ajustar o tamanho dos títulos fora da faixa."
);
item(
  O,
  "Descrição com 110 a 160 caracteres",
  4,
  fracaoDe(prontas, (p) => p.descricao.length >= 110 && p.descricao.length <= 160),
  "Ajustar as descrições fora da faixa."
);
item(
  O,
  "Exatamente um H1 por página",
  3,
  fracaoDe(prontas, (p) => p.h1s.length === 1),
  "Uma página, um H1."
);
item(
  O,
  "Palavra-chave alvo no título",
  6,
  fracaoDe(comAlvo, (p) => contemPalavraChave(p.titulo, alvoDe(p.rota))),
  "Pôr a palavra-chave no title."
);
item(
  O,
  "Palavra-chave alvo no H1",
  4,
  fracaoDe(comAlvo, (p) => contemPalavraChave(p.h1s.join(" "), alvoDe(p.rota))),
  "Pôr a palavra-chave no H1."
);
item(
  O,
  "Imagens com texto alternativo",
  3,
  prontas.reduce((s, p) => s + p.imagens, 0)
    ? 1 - prontas.reduce((s, p) => s + p.imagensSemAlt, 0) / prontas.reduce((s, p) => s + p.imagens, 0)
    : 1,
  "alt descritivo em toda <img>."
);

// 3. Conteúdo (30)
const C = "Conteúdo";
item(
  C,
  `Artigos publicados no blog (meta: ${METAS.artigos})`,
  12,
  paginasArtigo.length / METAS.artigos,
  `Publicar mais artigos (${paginasArtigo.length}/${METAS.artigos}).`
);
{
  const publicados = artigos.filter((a) => paginasArtigo.some((p) => p.rota === `/blog/${a.slug}`));
  const recente = publicados.some(
    (a) => a.publicadoEm && (Date.now() - Date.parse(a.atualizadoEm || a.publicadoEm)) / 864e5 <= 30
  );
  item(
    C,
    "Artigo novo ou atualizado nos últimos 30 dias",
    3,
    recente ? 1 : 0,
    "Publicar ou atualizar um artigo neste mês."
  );
}
item(
  C,
  "Página por público (engenharia e arquitetura)",
  4,
  ["/engenharia", "/arquitetura"].filter((r) => prontas.some((p) => p.rota === r)).length / 2,
  "Criar /engenharia e /arquitetura."
);
item(
  C,
  `Artigos com ${METAS.palavrasPorArtigo}+ palavras`,
  3,
  fracaoDe(paginasArtigo, (p) => p.palavras >= METAS.palavrasPorArtigo),
  "Aprofundar artigos curtos."
);
item(
  C,
  `Artigos com ${METAS.linksInternos}+ links internos`,
  3,
  fracaoDe(paginasArtigo, (p) => p.linksInternos >= METAS.linksInternos),
  "Linkar módulos e outros artigos."
);
item(
  C,
  `Páginas comparativas (meta: ${METAS.comparativos})`,
  3,
  prontas.filter((p) => p.rota.startsWith("/vs/")).length / METAS.comparativos,
  "Criar mais /vs/*."
);
item(
  C,
  `Ferramentas e modelos para baixar (meta: ${METAS.ferramentas})`,
  2,
  prontas.filter((p) => p.rota.startsWith("/ferramentas/")).length / METAS.ferramentas,
  "Criar /ferramentas/* (modelo de proposta, calculadora de honorários)."
);

// 4. Dados estruturados e IA (10)
const D = "Dados estruturados e IA";
item(
  D,
  "Organization com sameAs (perfis oficiais)",
  2,
  grafoHome.some((j) => j["@type"] === "Organization" && Array.isArray(j.sameAs) && j.sameAs.length) ? 1 : 0,
  "sameAs no JSON-LD do index.html."
);
item(
  D,
  "SoftwareApplication com preço (offers)",
  2,
  grafoHome.some((j) => j["@type"] === "SoftwareApplication" && j.offers) ? 1 : 0,
  "offers no JSON-LD do index.html."
);
item(
  D,
  "BlogPosting em todo artigo",
  2,
  paginasArtigo.length ? fracaoDe(paginasArtigo, (p) => tipos(p).includes("BlogPosting")) : 0,
  "JSON-LD BlogPosting no artigo."
);
item(
  D,
  "BreadcrumbList nos artigos",
  1,
  paginasArtigo.length ? fracaoDe(paginasArtigo, (p) => tipos(p).includes("BreadcrumbList")) : 0,
  "JSON-LD BreadcrumbList no artigo."
);
item(
  D,
  "FAQPage em páginas de produto ou artigo",
  1,
  prontas.some((p) => tipos(p).includes("FAQPage")) ? 1 : 0,
  "FAQPage nas páginas com perguntas."
);
{
  const cobre = urls.length ? fracaoDe(urls, (u) => llms.includes(`${BASE}${u.rota === "/" ? "/" : u.rota})`)) : 0;
  const coerente = /arquitetura/i.test(llms) && !/n[aã]o [eé] ferramenta de arquitetura/i.test(llms) ? 1 : 0;
  item(D, "llms.txt cobre o sitemap e fala de arquitetura", 2, (cobre + coerente) / 2, "Atualizar public/llms.txt.");
}

// 5. Autoridade e medição (15): checklist externa, mantida à mão
const A = "Autoridade e medição";
const ext = (chave) => externo[chave] ?? {};
item(
  A,
  "Google Search Console verificado",
  3,
  ext("searchConsole").feito ? 1 : 0,
  "Verificar o domínio por DNS no Search Console."
);
item(
  A,
  "Sitemap enviado ao Search Console",
  1,
  ext("sitemapEnviado").feito ? 1 : 0,
  "Enviar /sitemap.xml no Search Console."
);
item(A, "Bing Webmaster Tools", 1, ext("bing").feito ? 1 : 0, "Importar o site do Search Console no Bing.");
item(
  A,
  "Conversão (demonstração) medida por canal",
  1,
  ext("conversaoMedida").feito ? 1 : 0,
  "Evento de demonstração por origem no PostHog/GA4."
);
item(A, "Core Web Vitals aprovado", 1, ext("coreWebVitals").feito ? 1 : 0, "Conferir no PageSpeed/Search Console.");
item(
  A,
  "Perfis oficiais ligados ao site (LinkedIn, Instagram)",
  1,
  ext("perfisOficiais").feito ? 1 : 0,
  "Link do site nos perfis e perfis no sameAs."
);
item(
  A,
  "Diretórios de software (meta: 3)",
  2,
  (ext("diretorios").quantidade ?? 0) / 3,
  "Cadastrar em Capterra, GetApp, B2B Stack."
);
item(
  A,
  "Domínios que linkam o site (meta: 20)",
  3,
  (ext("dominiosComLink").quantidade ?? 0) / 20,
  "Parcerias, artigo convidado, associações."
);
item(
  A,
  "Avaliações públicas reais (meta: 10)",
  2,
  (ext("avaliacoes").quantidade ?? 0) / 10,
  "Pedir avaliação aos clientes ativos."
);

// ---------------------------------------------------------------- saída

const ORDEM = [T, O, C, D, A];
const porCategoria = ORDEM.map((cat) => {
  const lista = itens.filter((i) => i.categoria === cat);
  return {
    categoria: cat,
    pontos: Math.round(lista.reduce((s, i) => s + i.pontos, 0) * 10) / 10,
    max: lista.reduce((s, i) => s + i.max, 0),
    itens: lista,
  };
});
const total = Math.round(itens.reduce((s, i) => s + i.pontos, 0));
const maximo = itens.reduce((s, i) => s + i.max, 0);

if (maximo !== 100) {
  console.error(`[seo-nota] a régua soma ${maximo}, não 100. Ajuste os pesos.`);
  process.exit(1);
}

const proximos = itens
  .filter((i) => i.dica)
  .map((i) => ({ ...i, falta: Math.round((i.max - i.pontos) * 10) / 10 }))
  .sort((a, b) => b.falta - a.falta);

if (comoJson) {
  console.log(
    JSON.stringify({ total, categorias: porCategoria, paginas: prontas.length, artigos: paginasArtigo.length }, null, 2)
  );
  process.exit(0);
}

const linhas = [];
linhas.push(`# Nota de SEO: ${total}/100`, "");
linhas.push(
  `Páginas no sitemap: ${urls.length} · com HTML pronto: ${prontas.length} · artigos: ${paginasArtigo.length}`,
  ""
);
linhas.push("| Categoria | Pontos |", "|---|---|");
for (const c of porCategoria) linhas.push(`| ${c.categoria} | ${c.pontos} / ${c.max} |`);
linhas.push("");
for (const c of porCategoria) {
  linhas.push(`## ${c.categoria} (${c.pontos}/${c.max})`, "");
  for (const i of c.itens)
    linhas.push(`- ${i.pontos >= i.max ? "✅" : i.pontos > 0 ? "🟡" : "❌"} ${i.nome}: ${i.pontos}/${i.max}`);
  linhas.push("");
}
linhas.push("## Onde estão os próximos pontos", "");
for (const p of proximos.slice(0, 10)) linhas.push(`- +${p.falta} · ${p.nome}: ${p.dica}`);
console.log(linhas.join("\n"));
