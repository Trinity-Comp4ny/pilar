#!/usr/bin/env node
/**
 * Gera docs/architecture/EDGE_FUNCTIONS.md: o catálogo das Edge Functions.
 *
 * Junta o que é escrito à mão (supabase/functions/CATALOGO.json: domínio, o que faz,
 * quem chama de fora) com o que se lê do repo (chamadas no app, crons nas migrations,
 * verify_jwt do config.toml, secrets lidos com Deno.env.get, se tem teste). Função
 * sem chamador conhecido aparece marcada: é candidata a remoção.
 *
 *   node scripts/edge-functions-catalog.mjs          # regrava o catálogo
 *
 * `scripts/edge-functions-catalog.test.ts` reprova se o arquivo commitado não for o
 * que este script gera, ou se uma função nova não estiver no CATALOGO.json.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const DOMINIOS = {
  ia: "IA",
  billing: "Assinatura do Pilar (Asaas da plataforma)",
  "cobranca-cliente": "Cobrança do cliente da empresa (Asaas da empresa)",
  portal: "Portal do cliente",
  campo: "Pilar Campo",
  acesso: "Membros e acesso",
  auth: "Autenticação",
  comunicacao: "E-mail",
  jobs: "Jobs agendados (pg_cron)",
  plataforma: "Plataforma (ultra admin)",
  utilitario: "Utilitários",
};

function arquivos(dir, filtro) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === "dist") continue;
      out.push(...arquivos(p, filtro));
    } else if (filtro(e.name)) out.push(p);
  }
  return out;
}

function lerFuncoes(raiz) {
  const dirFn = join(raiz, "supabase/functions");
  const nomes = readdirSync(dirFn, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
    .map((d) => d.name)
    .sort();

  const config = readFileSync(join(raiz, "supabase/config.toml"), "utf8");
  const semJwt = new Set([...config.matchAll(/\[functions\.([\w-]+)\][^[]*?verify_jwt\s*=\s*false/g)].map((m) => m[1]));

  const codigoApp = [join(raiz, "src"), join(raiz, "apps/marketing/src")]
    .flatMap((d) => arquivos(d, (n) => /\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n)))
    .map((f) => readFileSync(f, "utf8"))
    .join("\n");
  const migrations = arquivos(join(raiz, "supabase/migrations"), (n) => n.endsWith(".sql"))
    .map((f) => readFileSync(f, "utf8"))
    .join("\n");

  return nomes.map((nome) => {
    const dir = join(dirFn, nome);
    const fontes = arquivos(dir, (n) => n.endsWith(".ts"));
    const codigo = fontes
      .filter((f) => !f.endsWith(".test.ts"))
      .map((f) => readFileSync(f, "utf8"))
      .join("\n");
    const secrets = [...new Set([...codigo.matchAll(/Deno\.env\.get\(\s*["']([A-Z0-9_]+)["']/g)].map((m) => m[1]))].sort();
    return {
      nome,
      app: codigoApp.includes(`"${nome}"`) || codigoApp.includes(`functions/v1/${nome}`),
      cron: migrations.includes(`functions/v1/${nome}`),
      jwt: !semJwt.has(nome),
      secrets,
      teste: fontes.some((f) => f.endsWith(".test.ts")),
    };
  });
}

export function gerarCatalogo(raiz) {
  const manifesto = JSON.parse(readFileSync(join(raiz, "supabase/functions/CATALOGO.json"), "utf8"));
  const funcoes = lerFuncoes(raiz);
  const linhas = [
    "# Catálogo das Edge Functions",
    "",
    "<!-- Gerado por scripts/edge-functions-catalog.mjs a partir de supabase/functions/CATALOGO.json.",
    "     Não editar à mão: edite o CATALOGO.json e rode `node scripts/edge-functions-catalog.mjs`. -->",
    "",
    `${funcoes.length} funções. **Chamada por**: app (chamada no código do front), cron (pg_cron nas`,
    "migrations) ou origem externa declarada no manifesto. **Login**: `verify_jwt` do `config.toml`",
    "(JWT aceita a chave anon; \"própria\" = a função faz a autorização). **Secrets**: lidos direto",
    "na pasta da função (o que vem de `_shared`, como a chave do Gemini, não aparece).",
    "**Sem chamador conhecido**: nenhuma das origens",
    "acima; candidata a remoção, lembrando que apagar o código não despublica a função no Supabase.",
    "",
  ];
  const semChamador = [];
  for (const [dominio, titulo] of Object.entries(DOMINIOS)) {
    const doDominio = funcoes.filter((f) => manifesto[f.nome]?.dominio === dominio);
    if (doDominio.length === 0) continue;
    linhas.push(`## ${titulo}`, "", "| Função | O que faz | Chamada por | Login | Secrets | Teste |", "| --- | --- | --- | --- | --- | --- |");
    for (const f of doDominio) {
      const m = manifesto[f.nome];
      const origens = [f.app && "app", f.cron && "cron", m.chamada_externa].filter(Boolean);
      if (origens.length === 0) semChamador.push(f.nome);
      const chamada = origens.length ? origens.join(", ") : "**sem chamador conhecido**";
      const secrets = f.secrets.length ? f.secrets.map((s) => `\`${s}\``).join(" ") : "";
      linhas.push(
        `| \`${f.nome}\` | ${m.descricao} | ${chamada} | ${f.jwt ? "JWT" : "própria"} | ${secrets} | ${f.teste ? "sim" : "não"} |`
      );
    }
    linhas.push("");
  }
  if (semChamador.length) {
    linhas.push("## Sem chamador conhecido", "", ...semChamador.map((n) => `- \`${n}\``), "");
  }
  return linhas.join("\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const raiz = process.cwd();
  writeFileSync(join(raiz, "docs/architecture/EDGE_FUNCTIONS.md"), gerarCatalogo(raiz));
  console.log("docs/architecture/EDGE_FUNCTIONS.md atualizado.");
}
