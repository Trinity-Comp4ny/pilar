#!/usr/bin/env node
// Auditoria de segurança do banco: somente leitura, com ratchet de dívida.
//
// Motivo: até 2026-08-19 a auditoria de segurança do Pilar era disparada por
// evento (refactor grande, dúvida externa sobre o schema). Uma varredura ao vivo
// nessa data levou minutos e achou duas coisas que revisão PR a PR nunca pega,
// porque não são bug de feature, são propriedade do ambiente:
//
//   1. a api_key do Asaas em texto puro em PRODUÇÃO. A migration 021 tenta
//      cifrar com pgsodium e tem fallback silencioso quando a extensão não
//      existe. pgsodium está instalado em staging e NÃO em produção, então o
//      fallback degradou exatamente no ambiente que importa.
//   2. drift de extensão entre os ambientes (pg_graphql e pgsodium só em
//      staging), o que faz staging ter MAIS superfície que produção e deixa de
//      validá-la.
//
// Uso:
//   node scripts/audit-security.mjs staging
//   node scripts/audit-security.mjs prod
//   node scripts/audit-security.mjs prod --snapshot    # regrava a baseline
//
// Env (mesma convenção do scripts/supabase-target.sh, ADR 0007):
//   SUPABASE_DB_URL_STAGING / SUPABASE_DB_URL_PROD     URI do Session Pooler
//
// Produção NÃO exige ALLOW_PROD_DB_PUSH: tudo aqui é SELECT em catálogo do
// Postgres. Nenhuma query lê dado de cliente, nenhuma escreve.
//
// Contrato de saída:
//   exit 0  nada piorou desde a baseline
//   exit 1  invariante violado, dívida cresceu, ou drift entre ambientes
//
// Quando um número MELHORA, o script pede --snapshot pra travar o ganho. Mesmo
// padrão do TYPECHECK_DEBT.txt: a dívida só desce, nunca sobe sem justificativa.

import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

const BASELINE_PATH = join(process.cwd(), "scripts", "audit-security-baseline.json");

// Funções SECURITY DEFINER que PRECISAM ser executáveis por anon, com o motivo.
//
// ATENÇÃO: manter em sincronia com a allowlist de supabase/tests/anon_function_grants.sql.
// Aquele teste roda no CI contra um banco novo construído a partir das migrations;
// este script roda contra o banco REAL de staging e produção. Os dois checam a mesma
// regra em superfícies diferentes, e é a diferença entre eles que pega drift (algo
// aplicado à mão, ou migration que não chegou num ambiente).
const ANON_ESPERADO = new Set([
  // Helpers de RLS. Parece brecha e não é: TODAS as ~180 policies do schema são
  // `TO PUBLIC`, e expressão de policy é avaliada com o privilégio de quem
  // consulta. Sem EXECUTE aqui, consulta anônima em qualquer tabela troca "zero
  // linha" (correto) por "permission denied for function" (erro 500 no
  // PostgREST). O grant é load-bearing dado o desenho atual das policies; o fix
  // de verdade é migrar as policies para `TO authenticated`, que aí torna o
  // grant desnecessário e ainda resolve os 22 auth_rls_initplan de graça.
  "get_user_empresa_id",
  "get_user_empresa_id_text",
  "get_user_role",
  "has_role",
  "is_company_admin",
  "is_ultra_admin",
  "my_empresa_id",
  "can_view_financeiro",
  "can_view_folha",
  "user_has_feature",
  "is_feature_flag_enabled",
  "current_effective_role",
  "current_impersonation",
  "current_pessoa_id",
  "is_impersonating",
  // Portal do cliente: auth paralela ao Supabase Auth (RPC + token em
  // sessionStorage). É o sistema que já teve o bug de hash vs plaintext.
  "portal_login",
  "portal_verify_session",
  "portal_verify_session_readonly",
  "portal_change_password",
  "portal_aprovar_entrega",
  "portal_listar_entregas",
  "portal_solicitar_revisao_entrega",
  "get_cliente_obras",
  "get_cliente_obra_detail",
  "get_cliente_projetos",
  "get_cliente_projeto_detail",
  // Pilar Campo: credencial própria do app de campo (spec 042).
  "campo_login",
  "campo_verify_session",
  "campo_trocar_senha",
  "campo_salvar_rdo",
  "campo_criar_tarefa",
  "campo_listar_rdos",
  "campo_listar_tarefas",
  "campo_registrar_medicao",
  "campo_registrar_tarefa_rdo",
  // Roda ANTES do signInWithPassword, por definição sem sessão.
  "guard_login_attempt",
]);

// View que roda como dona (sem security_invoker) e por isso NÃO herda o RLS de
// quem chama. Só entra aqui depois de alguém ler a definição e confirmar que
// filtra tenant explicitamente. Motivo obrigatório.
const VIEW_SEM_INVOKER_REVISADA = new Map([
  [
    "pessoas_safe",
    "roda como dona de propósito, pra mascarar coluna por papel (CPF, salário, PIX, conta) " +
      "via can_view_folha(); compensa com WHERE empresa_id = get_user_empresa_id() " +
      "AND user_has_feature('pessoas','viewer'). Revisado em 2026-08-19.",
  ],
]);

const CHECKS = {
  // ── Invariante: já está em zero, tem que continuar ────────────────────────
  tabelas_sem_rls: {
    invariante: true,
    meta: 0,
    descricao: "tabela no schema public sem RLS (ADR 0001)",
    sql: `SELECT c.relname
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public'
            AND c.relkind IN ('r', 'p')
            AND NOT c.relrowsecurity
          ORDER BY 1;`,
  },

  // ── Dívida com ratchet: só pode descer ───────────────────────────────────

  // O que importa de verdade. Função que retorna `trigger` o Postgres recusa
  // chamar fora de contexto de trigger, então não é caminho de exploração; esta
  // query exclui essas e sobra a superfície REAL chamável por quem não
  // autenticou, descontada a allowlist revisada. Hoje dá zero nos dois
  // ambientes, e o histórico mostra que esse vetor reabriu sozinho 3 vezes
  // (alguém cria uma RPC e esquece de revogar), então é invariante, não ratchet.
  anon_chamavel: {
    invariante: true,
    meta: 0,
    descricao: "função SECURITY DEFINER chamável por anon fora da allowlist",
    filtro: (nome) => !ANON_ESPERADO.has(nome),
    sql: `SELECT p.proname
          FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public'
            AND p.prosecdef
            AND p.prorettype <> 'trigger'::regtype
            AND has_function_privilege('anon', p.oid, 'EXECUTE')
          ORDER BY 1;`,
  },

  // Higiene, prioridade baixa: grant errado em função de trigger. Inerte
  // (Postgres recusa a chamada direta), mas suja o advisor e mascara achado real.
  anon_trigger_inerte: {
    descricao: "grant pra anon em função de trigger (inerte, só higiene)",
    sql: `SELECT p.proname
          FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public'
            AND p.prosecdef
            AND p.prorettype = 'trigger'::regtype
            AND has_function_privilege('anon', p.oid, 'EXECUTE')
          ORDER BY 1;`,
  },

  // RLS ligada com ZERO policy nega tudo hoje. Mas a proteção depende da
  // AUSÊNCIA de regra: no dia em que alguém adicionar uma policy permissiva por
  // um motivo legítimo, os grants abertos passam a valer de uma vez. Duas dessas
  // tabelas são o coração do controle de segurança (mfa_backup_codes,
  // rate_limit_attempts). Defesa em profundidade pede revogar o grant também.
  rls_sem_policy_com_grant: {
    meta: 0,
    descricao: "tabela com RLS, zero policy, mas grant de SELECT pra anon",
    sql: `SELECT c.relname
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public'
            AND c.relkind = 'r'
            AND c.relrowsecurity
            AND NOT EXISTS (SELECT 1 FROM pg_policy pol WHERE pol.polrelid = c.oid)
            AND has_table_privilege('anon', c.oid, 'SELECT')
          ORDER BY 1;`,
  },

  view_sem_invoker_nao_revisada: {
    invariante: true,
    meta: 0,
    descricao: "view que roda como dona e ainda não foi revisada à mão",
    filtro: (nome) => !VIEW_SEM_INVOKER_REVISADA.has(nome),
    sql: `SELECT c.relname
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public'
            AND c.relkind = 'v'
            AND NOT COALESCE(
              (SELECT option_value::boolean
               FROM pg_options_to_table(c.reloptions)
               WHERE option_name = 'security_invoker'),
              false)
          ORDER BY 1;`,
  },

  authenticated_chamavel: {
    descricao: "função SECURITY DEFINER chamável por authenticated",
    sql: `SELECT p.proname
          FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public'
            AND p.prosecdef
            AND p.prorettype <> 'trigger'::regtype
            AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
          ORDER BY 1;`,
  },

  search_path_mutavel: {
    meta: 0,
    descricao: "função SECURITY DEFINER sem search_path fixo (shadowing de schema)",
    sql: `SELECT p.proname
          FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public'
            AND p.prosecdef
            AND (p.proconfig IS NULL
                 OR NOT EXISTS (
                   SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%'
                 ))
          ORDER BY 1;`,
  },

  // auth.uid() direto na policy roda POR LINHA. Envolver em (select auth.uid())
  // faz o planner avaliar uma vez por query. É o erro de performance de RLS mais
  // comum no Supabase e só aparece quando a tabela cresce.
  policy_auth_por_linha: {
    descricao: "policy chamando auth.uid()/auth.jwt() sem subselect (avalia por linha)",
    sql: `SELECT (c.relname || '.' || pol.polname)
          FROM pg_policy pol
          JOIN pg_class c ON c.oid = pol.polrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public'
            AND (
              pg_get_expr(pol.polqual, pol.polrelid) ~ 'auth\\.(uid|jwt)\\(\\)'
              OR pg_get_expr(pol.polwithcheck, pol.polrelid) ~ 'auth\\.(uid|jwt)\\(\\)'
            )
            AND COALESCE(pg_get_expr(pol.polqual, pol.polrelid), '') !~ '\\(\\s*SELECT\\s+auth\\.'
          ORDER BY 1;`,
  },

  fk_sem_indice: {
    descricao: "chave estrangeira sem índice (delete e join lentos)",
    sql: `SELECT (rel.relname || '.' || con.conname)
          FROM pg_constraint con
          JOIN pg_class rel ON rel.oid = con.conrelid
          JOIN pg_namespace n ON n.oid = rel.relnamespace
          WHERE n.nspname = 'public'
            AND con.contype = 'f'
            AND NOT EXISTS (
              SELECT 1 FROM pg_index i
              WHERE i.indrelid = con.conrelid
                AND (con.conkey::smallint[]) <@ (i.indkey::smallint[])
            )
          ORDER BY 1;`,
  },

  // ── Drift: comparado item a item entre ambientes, não contra número ───────
  extensoes: {
    drift: true,
    descricao: "extensões instaladas (staging e prod deveriam ser idênticos)",
    sql: `SELECT (extname || '@' || extversion) FROM pg_extension ORDER BY 1;`,
  },
};

function parseArgs() {
  const [ambiente, ...flags] = process.argv.slice(2);
  if (!["staging", "prod"].includes(ambiente)) {
    console.error("uso: node scripts/audit-security.mjs staging|prod [--snapshot]");
    process.exit(1);
  }
  return { ambiente, snapshot: flags.includes("--snapshot") };
}

function dbUrl(ambiente) {
  const chave = ambiente === "prod" ? "SUPABASE_DB_URL_PROD" : "SUPABASE_DB_URL_STAGING";
  const url = process.env[chave];
  if (!url) {
    console.error(`erro: falta ${chave} no ambiente.`);
    process.exit(1);
  }
  return url;
}

async function consultar(url, sql) {
  const { stdout } = await run("psql", [url, "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", sql], {
    maxBuffer: 16 * 1024 * 1024,
  });
  return stdout
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

async function carregarBaseline() {
  try {
    return JSON.parse(await readFile(BASELINE_PATH, "utf8"));
  } catch {
    return null;
  }
}

function imprimirItens(itens, limite = 15) {
  for (const item of itens.slice(0, limite)) console.log(`        ${item}`);
  if (itens.length > limite) console.log(`        ... e mais ${itens.length - limite}`);
}

// O check de drift acima compara cada ambiente contra a própria baseline, o que
// pega "alguém instalou algo novo". Não pega o problema mais grave, que é os dois
// ambientes divergirem entre si: aí staging deixa de validar produção, e nenhum
// dos dois acusa nada olhando só pra si mesmo. Roda a partir da baseline
// commitada, sem consultar banco.
// Nome@versão -> nome, pra separar "extensão ausente num ambiente" (invariante,
// staging não valida um caminho que prod tem ou vice-versa) de "mesma extensão,
// versão diferente" (higiene, não segurança — vira aviso, não bloqueio, porque
// o painel do Supabase às vezes não oferece update de versão pro usuário).
const nomeExtensao = (entry) => entry.split("@")[0];

function relatarDriftEntreAmbientes(baseline) {
  const prod = new Set(baseline.prod?.extensoes ?? []);
  const staging = new Set(baseline.staging?.extensoes ?? []);
  if (prod.size === 0 || staging.size === 0) return [];

  const nomesProd = new Set([...prod].map(nomeExtensao));
  const nomesStaging = new Set([...staging].map(nomeExtensao));

  const soProd = [...prod].filter((e) => !staging.has(e) && !nomesStaging.has(nomeExtensao(e)));
  const soStaging = [...staging].filter((e) => !prod.has(e) && !nomesProd.has(nomeExtensao(e)));
  const versaoDivergente = [...prod]
    .filter((e) => !staging.has(e) && nomesStaging.has(nomeExtensao(e)))
    .map((e) => {
      const versaoStaging = [...staging].find((s) => nomeExtensao(s) === nomeExtensao(e));
      return `${nomeExtensao(e)}: prod ${e.split("@")[1]} / staging ${versaoStaging.split("@")[1]}`;
    });

  if (versaoDivergente.length) {
    console.log("  ⚠ extensões com versão divergente entre prod e staging (não bloqueia):");
    imprimirItens(versaoDivergente);
  }

  if (soProd.length === 0 && soStaging.length === 0) {
    console.log("  ✓ extensões: prod e staging com o mesmo conjunto (versão à parte)");
    return [];
  }

  console.log("  ✗ extensões: prod e staging divergem");
  if (soProd.length) console.log(`      só em prod:    ${soProd.join(", ")}`);
  if (soStaging.length) console.log(`      só em staging: ${soStaging.join(", ")}`);
  return [`extensoes: prod e staging divergem (${soProd.length} / ${soStaging.length})`];
}

async function main() {
  const { ambiente, snapshot } = parseArgs();
  const url = dbUrl(ambiente);

  console.log(`\n🔎 Auditoria de segurança do banco: ${ambiente}\n`);

  const resultado = {};
  for (const [nome, check] of Object.entries(CHECKS)) {
    const bruto = await consultar(url, check.sql);
    resultado[nome] = check.filtro ? bruto.filter(check.filtro) : bruto;
  }

  if (snapshot) {
    const baseline = (await carregarBaseline()) ?? {};
    baseline[ambiente] = {
      verificado_em: new Date().toISOString().slice(0, 10),
      ...Object.fromEntries(
        Object.entries(resultado).map(([nome, itens]) => [
          nome,
          CHECKS[nome].drift ? itens : itens.length,
        ]),
      ),
    };
    await writeFile(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`);
    console.log(`✅ Baseline de ${ambiente} regravada em scripts/audit-security-baseline.json`);
    console.log("   Revise o diff antes de commitar: número que sobe precisa de justificativa.\n");
    return;
  }

  const baseline = await carregarBaseline();
  if (!baseline?.[ambiente]) {
    console.error(`erro: sem baseline pra ${ambiente}. Rode com --snapshot uma vez e commite.\n`);
    process.exit(1);
  }

  const base = baseline[ambiente];
  const violacoes = [];
  const melhorias = [];

  for (const [nome, check] of Object.entries(CHECKS)) {
    const itens = resultado[nome];

    if (check.drift) {
      const esperado = new Set(base[nome] ?? []);
      const atual = new Set(itens);
      const sobrando = itens.filter((i) => !esperado.has(i));
      const faltando = [...esperado].filter((i) => !atual.has(i));
      if (sobrando.length === 0 && faltando.length === 0) {
        console.log(`  ✓ ${check.descricao}: sem drift (${itens.length})`);
        continue;
      }
      console.log(`  ✗ ${check.descricao}: drift`);
      if (sobrando.length) console.log(`      a mais: ${sobrando.join(", ")}`);
      if (faltando.length) console.log(`      a menos: ${faltando.join(", ")}`);
      violacoes.push(`${nome}: drift (+${sobrando.length} / -${faltando.length})`);
      continue;
    }

    const limite = base[nome] ?? 0;
    const atual = itens.length;
    const alvo = check.meta === 0 ? " (meta: 0)" : "";

    if (check.invariante && atual > 0) {
      console.log(`  ✗ ${check.descricao}: ${atual}, invariante exige 0`);
      imprimirItens(itens);
      violacoes.push(`${nome}: ${atual}, invariante exige 0`);
      continue;
    }

    if (atual > limite) {
      console.log(`  ✗ ${check.descricao}: ${atual}, baseline era ${limite}`);
      imprimirItens(itens);
      violacoes.push(`${nome}: ${atual} > baseline ${limite}`);
      continue;
    }

    if (atual < limite) {
      console.log(`  ✓ ${check.descricao}: ${atual}, baseline era ${limite}, melhorou${alvo}`);
      melhorias.push(`${nome}: ${limite} → ${atual}`);
      continue;
    }

    console.log(`  ✓ ${check.descricao}: ${atual}${alvo}`);
  }

  console.log("\n  Comparação entre ambientes (a partir da baseline commitada):");
  violacoes.push(...relatarDriftEntreAmbientes(baseline));

  console.log("");

  if (violacoes.length > 0) {
    console.error("❌ Auditoria reprovou:");
    for (const v of violacoes) console.error(`   - ${v}`);
    console.error(
      "\nInvariante violado é bug, corrija antes de mergear.\n" +
        "Dívida que cresceu precisa de justificativa e baseline nova (--snapshot).\n" +
        "Drift entre ambientes significa que staging parou de validar produção.\n",
    );
    process.exit(1);
  }

  if (melhorias.length > 0) {
    console.log("🎉 Dívida diminuiu:");
    for (const m of melhorias) console.log(`   - ${m}`);
    console.log("\nRode com --snapshot e commite pra travar o ganho.\n");
    return;
  }

  console.log("✅ Nada piorou desde a última baseline.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
