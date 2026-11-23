import { appendFileSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const ORIGEM_APP = "https://app.pilarsoft.com.br";
const ORIGEM_MARKETING = "https://www.pilarsoft.com.br";

export function obterUrlPreview(deploy, site, canal) {
  const url = URL.parse(deploy.result?.[site]?.url ?? "");
  if (
    !url ||
    deploy.status !== "success" ||
    url.protocol !== "https:" ||
    !url.hostname.startsWith(`${site}--${canal}-`) ||
    !url.hostname.endsWith(".web.app") ||
    url.username ||
    url.password ||
    url.port ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error("O Firebase não retornou a URL HTTPS do site e canal esperados.");
  }
  return url.origin;
}

function exigir(condicao, rota, mensagem) {
  if (!condicao) throw new Error(`${rota}: ${mensagem}`);
}

function temDiretiva(resposta, diretiva) {
  return resposta.headers
    .get("cache-control")
    ?.split(",")
    .some((valor) => valor.trim() === diretiva);
}

async function buscar(origem, rota, tipo, requisitar, headers) {
  const resposta = await requisitar(new URL(rota, origem), {
    redirect: "manual",
    signal: AbortSignal.timeout(10_000),
    headers,
  });
  exigir(resposta.status === 200, rota, `HTTP ${resposta.status}, esperado 200`);
  exigir(tipo.test(resposta.headers.get("content-type") ?? ""), rota, "Content-Type inesperado");
  return resposta;
}

async function verificarPagina(origem, rota, requisitar, headers) {
  const resposta = await buscar(origem, rota, /text\/html/i, requisitar, headers);
  exigir(temDiretiva(resposta, "no-cache") || temDiretiva(resposta, "no-store"), rota, "HTML deveria revalidar");
  exigir(resposta.headers.has("content-security-policy"), rota, "CSP ausente");
  exigir(resposta.headers.has("strict-transport-security"), rota, "HSTS ausente");
  return resposta.text();
}

export async function verificarHosting({ origem, alvo, release }, requisitar = fetch) {
  const rota = alvo === "app" ? "/login" : "/engenharia";
  const html = await verificarPagina(origem, rota, requisitar);

  // Busca o entrypoint real listado no HTML publicado, sem seguir redirects nem
  // usar URLs de terceiros. Um fallback do Hosting devolvendo HTML aqui é erro.
  const asset = html.match(/<script\b[^>]*\ssrc=["'](\/assets\/[\w.-]+\.js)["']/i)?.[1];
  exigir(asset, rota, "bundle JavaScript ausente do HTML");
  const bundle = await buscar(origem, asset, /(?:application|text)\/(?:x-)?javascript/i, requisitar);
  exigir(temDiretiva(bundle, "immutable"), asset, "cache imutável ausente");
  await bundle.body?.cancel();

  if (alvo === "app") {
    await verificarPagina(origem, "/inicio", requisitar);
    const versao = await buscar(origem, "/version.json", /application\/json/i, requisitar);
    exigir(temDiretiva(versao, "no-store"), "/version.json", "cache deveria ser no-store");
    exigir(release && (await versao.json()).release === release, "/version.json", "release diferente do build");
    return;
  }

  exigir(/<h1[\s>]/i.test(html), rota, "conteúdo pré-renderizado ausente");
  // A CDN pode ter entradas distintas para as codificações na URL canônica.
  await Promise.all(
    ["br", "gzip", "identity"].map(async (encoding) => {
      const home = await verificarPagina(origem, "/", requisitar, { "Accept-Encoding": encoding });
      exigir(/<h1[\s>]/i.test(home), `/ (${encoding})`, "home sem conteúdo pré-renderizado");
      exigir(
        home.includes(`<link rel="canonical" href="${ORIGEM_MARKETING}/"`),
        `/ (${encoding})`,
        "canonical da home ausente"
      );
    })
  );
  const sitemap = await buscar(origem, "/sitemap.xml", /(?:application|text)\/xml/i, requisitar);
  exigir(
    (await sitemap.text()).includes(`<loc>${ORIGEM_MARKETING}/engenharia</loc>`),
    "/sitemap.xml",
    "rota de engenharia ausente"
  );
  await Promise.all(
    ["/__hosting-smoke-missing__", "/blog/__hosting-smoke-missing__", "/assets/__hosting-smoke-missing__.js"].map(
      async (rotaInexistente) => {
        const resposta = await requisitar(new URL(rotaInexistente, origem), {
          redirect: "manual",
          signal: AbortSignal.timeout(10_000),
        });
        exigir(resposta.status === 404, rotaInexistente, `HTTP ${resposta.status}, esperado 404`);
        const pagina = await resposta.text();
        exigir(pagina.includes('content="noindex, follow"'), rotaInexistente, "404 sem noindex");
      }
    )
  );
  const checkout = "/checkout?plano=pro&utm_source=hosting-smoke";
  const redirecionamento = await requisitar(new URL(checkout, origem), {
    redirect: "manual",
    signal: AbortSignal.timeout(10_000),
  });
  await redirecionamento.body?.cancel();
  exigir(redirecionamento.status === 307, "/checkout", "esperado redirecionamento 307");
  exigir(
    redirecionamento.headers.get("location") === `${ORIGEM_APP}${checkout}`,
    "/checkout",
    "destino ou parâmetros incorretos"
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [arquivo, alvo, canal] = process.argv.slice(2);
  if (!["app", "marketing"].includes(alvo) || !canal) throw new Error("Informe o alvo e o canal do Hosting.");
  const site = process.env.SITE_ID;
  const live = arquivo === "--live";
  const publico = arquivo === "--public";
  if (!publico && (!site || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(site))) {
    throw new Error("SITE_ID do Firebase inválido.");
  }
  if (live && !["live", "staging"].includes(canal))
    throw new Error("O smoke do site fixo exige o canal live ou staging.");
  if (publico && canal !== "live") throw new Error("O smoke dos domínios públicos exige o canal live.");
  const origem = publico
    ? alvo === "app"
      ? ORIGEM_APP
      : ORIGEM_MARKETING
    : live
      ? `https://${site}.web.app`
      : obterUrlPreview(JSON.parse(readFileSync(arquivo, "utf8")), site, canal);
  await verificarHosting({ origem, alvo, release: process.env.SENTRY_RELEASE });
  const resumo = `Firebase ${publico ? "domínio público" : canal} (${alvo}) validado: ${origem}`;
  console.log(resumo);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `url=${origem}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${resumo}\n`);
}
