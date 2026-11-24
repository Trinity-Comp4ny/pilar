// Gera firebase.app.json e apps/marketing/firebase.marketing.json a partir dos vercel.json.
// Uso (na raiz): node scripts/gerar-firebase-config.mjs .
// Existe para CSP e headers irem idênticos nos dois hosts durante a migração Vercel -> Firebase
// (docs/operations/MIGRACAO_VERCEL_FIREBASE.md). Não editar os firebase.*.json à mão.
import { readFileSync, writeFileSync } from "node:fs";
const root = process.argv[2];
const conv = (src) => {
  // glob do Vercel (regex path-to-regexp) -> glob do Firebase
  if (src === "/(.*)") return "**";
  const m = src.match(/^\/\(\.\*\\\.\(\?:(.+)\)\)$/);
  if (m) return `**/*.@(${m[1]})`;
  const a = src.match(/^\/assets\/\(\.\*\)$/); if (a) return "/assets/**";
  const f = src.match(/^\/fonts\/\(\.\*\)$/); if (f) return "/fonts/**";
  const i = src.match(/^\/\(index\|spa\)\.html$/); if (i) return "/@(index|spa).html";
  return src;
};
if (!root) {
  console.error("Uso: node scripts/gerar-firebase-config.mjs <raiz-do-repo>");
  process.exit(2);
}
// Primeiro calcula as duas configurações. Se uma entrada estiver inválida,
// nenhuma saída existente deve ser modificada parcialmente.
const gerados = [];
for (const [dir, out] of [[".", "firebase.app.json"], ["apps/marketing", "firebase.marketing.json"]]) {
  const v = JSON.parse(readFileSync(`${root}/${dir}/vercel.json`, "utf8"));
  let headers = v.headers.map((h) => ({ source: conv(h.source), headers: h.headers }));
  // Firebase cacheia HTML por 1h por padrão (a Vercel revalida). Sem isto, aba aberta após deploy pede chunk antigo e quebra.
  const base = headers.find((h) => h.source === "**");
  base.headers = [{ key: "Cache-Control", value: "no-cache" }, ...base.headers];
  headers = [base, ...headers.filter((h) => h !== base)];
  const redirects = (v.redirects ?? []).map((r) => {
    const rota = r.source.match(/^\/:rota\((.+)\)$/);
    if (rota) return { regex: `^/(${rota[1]})$`, destination: r.destination.replace(":rota", ":1"), type: 307 };
    return { source: r.source, destination: r.destination, type: 307 };
  });
  // A landing é pré-renderizada. Sem rewrite genérico, o Hosting devolve 404
  // para rotas e arquivos inexistentes. O app ainda depende do fallback da SPA.
  const rewrites = dir === "." ? v.rewrites.filter((r) => r.source === "/(.*)").map((r) => ({ source: "**", destination: r.destination })) : [];
  const cfg = { hosting: { public: "dist", cleanUrls: false, trailingSlash: false, ...(redirects.length ? { redirects } : {}), ...(rewrites.length ? { rewrites } : {}), headers } };
  gerados.push({ path: `${root}/${dir}/${out}`, data: JSON.stringify(cfg, null, 2) + "\n" });
}
for (const item of gerados) writeFileSync(item.path, item.data);
