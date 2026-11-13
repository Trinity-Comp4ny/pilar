#!/usr/bin/env node
// Bundle size budget check.
//
// Roda após `vite build`. Falha se algum chunk passar do limite (gzipped).
// Tunar limites em BUDGETS abaixo. Variável BUDGET_OVERRIDE=relaxed
// permite passagem temporária com warning (use só em emergência).

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const DIST = join(process.cwd(), "dist", "assets");

// Chunks que só fazem sentido em telas específicas: nunca no carregamento inicial.
const PROIBIDOS_NO_INICIAL = [/^vendor-pdf-/, /^vendor-charts-/, /^vendor-maps-/, /^vendor-docx-/];

// Limites em bytes (gzipped). Tune conforme app cresce.
const BUDGETS = {
  // Entry chunk (index-*.js), bootstrap inicial. Manter enxuto.
  // 270 kB (era 268, antes 266, antes 264, antes 250): o cap de 268 voltou a
  // "encostar" no PR das specs 099/093 (auth self-service + timeline do
  // projeto) — estourou por 274457B vs 274432B (268*1024), 25 bytes, mesma
  // deriva de hash de nome de chunk já documentada nas rodadas anteriores.
  // Total JS segue folgado (~1.9/3 MB); o first-load extra é imperceptível.
  // Reavaliar se voltar a encostar.
  //
  // 2026-10-09: 230 kB. O Replay do Sentry passou a vir da CDN depois do boot e a
  // entrada caiu de ~270 para ~221 kB; a catraca acompanha.
  //
  // 2026-10-13: 155 kB. O PostHog passou a vir por import dinâmico só com
  // consentimento (src/lib/analytics.ts) e a entrada caiu de ~230 para ~142 kB.
  //
  // 2026-10-13 (2): 125 kB. A troca de senha do portal passou a ser lazy (levava
  // react-hook-form e todos os schemas para o boot) e o env.ts deixou o zod; a
  // entrada caiu de ~143 para ~113 kB.
  //
  // 2026-11-11: 127 kB (era 125). staging media 123,3 kB; o bloco de profissionalização (PR #794)
  // pôs no boot só o que aparece antes de qualquer clique: o ponto de Novidades no menu e a
  // contagem no aviso de versão nova (lib/novidades, sem zod), a escuta da tecla "?" e os ícones
  // das seções novas do Ultra admin, ~2,7 kB gzip. Faixa de avisos, modal "O que mudou", agente
  // da ajuda, NPS, comunicado, novo aceite e registro do navegador ficaram lazy.
  //
  // 2026-11-12: 128 kB (era 127). staging já estava a 0,2 kB do teto (126,8 kB); a auditoria de
  // espaço (PR #822) soma ~0,3 kB gzip ao boot: o painel flutuante da sidebar em tela estreita
  // (abre por cima, fecha com clique fora/Esc) e o slot de toolbar das páginas. O bloco das
  // faixas do topo (FaixasDoTopo) ficou lazy, o que recuperou 0,14 kB.
  // 2026-11-12: 129 kB (era 128). O convite de instalar o app (PR #834) soma ~0,5 kB gzip ao
  // chunk de entrada (128,5): captura do `beforeinstallprompt` e ManifestDoApp, que rodam no boot.
  // 2026-11-13: 130 kB (era 129). Parar de reportar duas vezes cada falha do Supabase (PR #851)
  // põe no boot o detector `jaReportadoPelaRede` e o fingerprint por consulta, ~0,2 kB gzip; a
  // entrada de staging já estava colada no teto (129,0 kB). Corta ~70% do volume de erro do Sentry.
  entry: 130 * 1024,
  // Tudo que o navegador baixa antes da primeira tela: a entrada mais os chunks que o
  // index.html pré-carrega (modulepreload) e o CSS. O limite só da entrada não via o
  // vendor-pdf e o vendor-charts sendo pré-carregados em toda página (~860 kB brutos),
  // porque eram outros arquivos. Medido em 2026-10-09: ~416 kB depois da correção.
  // 2026-10-13: ~338 kB com o PostHog fora do boot; limite desce para 350 kB.
  // 2026-10-13 (2): ~309 kB sem zod e react-hook-form na entrada; limite desce para 325 kB.
  // 2026-10-19: 327 kB (era 325). A casca mobile (SPEC 134: barra flutuante, painel de baixo
  // com alça, botão flutuante) somou ~1,3 kB gzip ao boot (323,9 para 325,2 kB). O MoreSheet
  // já saiu do boot (lazy). Reavaliar se voltar a encostar.
  // 2026-10-29: 328 kB (era 327). O Logo passou a desenhar o nome em curva (PilarWordmark, ~1,7 kB de
  // caminho SVG, ~0,6 kB gzip) em vez de texto na fonte da página (BEZ-385). O Logo está em toda tela.
  // 2026-11-07: 329 kB (era 328). staging já media 328,0 kB; o onboarding da SPEC 149 não pôs
  // nenhum módulo no boot (telas e cartões são lazy), mas os chunks novos aumentam a tabela de
  // preload da entrada em ~0,1 kB. Reavaliar se voltar a encostar.
  // 2026-11-09: 330 kB (era 329). staging media 328,1 kB; a rodada de minor/patch do Dependabot
  // (PR #755: supabase-js 2.118, Radix 1.x→1.y, lucide-react) somou ~0,9 kB gzip ao boot e
  // encostou em 329,0. Nenhum módulo novo no boot, só versão nova das mesmas libs.
  // 2026-11-11: 331 kB (era 330). staging já media 330,0 kB, colado no teto. A faixa de reaceite
  // dos Termos (só admin vê) entra lazy e não põe módulo no boot; o import dinâmico e a entrada na
  // tabela de preload somam ~0,2 kB (330,2 kB).
  // 2026-11-11: 334 kB (era 331). O PR #794 soma ~2,8 kB gzip ao boot (ver o comentário da
  // entrada acima). Reavaliar se voltar a encostar.
  // 2026-11-11: 335 kB (era 334). O vidro líquido da barra mobile (PR #812: src/styles/vidro.css e
  // a lente da aba ativa no BottomNav) soma ~0,9 kB gzip ao boot e estourou por 0,1 kB (334,1).
  // A barra está em toda tela mobile, então não tem como ser lazy.
  // 2026-11-12: 336 kB (era 335). staging media 334,9 kB; os ajustes do celular (PR #828) somam
  // ~0,4 kB gzip ao boot (335,3): o menu "⋯" de ações do PageHeader, o painel de baixo que ocupa a
  // largura toda e o tamanho dos seletores compactos. Estão em toda tela; o quadro mobile e o menu
  // seguem lazy.
  // 2026-11-12: 337 kB (era 336). O convite de instalar o app (PR #834) soma ~0,6 kB gzip ao boot
  // (336,6): a captura do `beforeinstallprompt` precisa rodar no main.tsx, antes do React, e o
  // ManifestDoApp troca o manifest por público. O cartão e o painel de passos seguem fora do boot.
  // 2026-11-13: 338 kB (era 337). O atalho Novidades no trilho da sidebar (PR #846) soma ~0,1 kB
  // gzip ao boot (337,1): o item só aparece com release não vista, mas o código está no shell.
  initialLoad: 338 * 1024,
  // Qualquer chunk individual (vendor-*, página lazy)
  perChunk: 600 * 1024,
  // Soma de todos JS gzipped — proxy pra peso total app
  totalJs: 3 * 1024 * 1024,
  // Soma CSS gzipped
  totalCss: 200 * 1024,
};

function fmt(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

async function main() {
  let entries;
  try {
    entries = await readdir(DIST, { withFileTypes: true });
  } catch {
    console.error(`[budget] dist/assets não encontrado. Rode 'npm run build' antes.`);
    process.exit(1);
  }

  const chunks = [];
  // O tipo vem do próprio readdir: sem stat() antes do readFile() no mesmo caminho
  // (CodeQL js/file-system-race).
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const name = entry.name;
    const full = join(DIST, name);
    const ext = name.endsWith(".js") ? "js" : name.endsWith(".css") ? "css" : null;
    if (!ext) continue;
    const raw = await readFile(full);
    const gz = gzipSync(raw).length;
    chunks.push({ name, ext, raw: raw.length, gz });
  }

  chunks.sort((a, b) => b.gz - a.gz);

  console.log("\n📦 Bundle sizes (gzipped)\n");
  for (const c of chunks) {
    console.log(`  ${c.gz.toString().padStart(8)} B  ${c.name}`);
  }

  const violations = [];
  const totalJs = chunks.filter((c) => c.ext === "js").reduce((a, c) => a + c.gz, 0);
  const totalCss = chunks.filter((c) => c.ext === "css").reduce((a, c) => a + c.gz, 0);

  // A entrada é o <script src> do index.html. Pelo nome não dá: toda página lazy que
  // vem de um `index.tsx` também vira `index-*.js`, e a de Propostas (132 kB, com o
  // mammoth dentro) passava calada medida contra o limite da entrada.
  const html = await readFile(join(DIST, "..", "index.html"), "utf8");
  const entrada = html.match(/<script[^>]*\ssrc="\/assets\/([^"]+\.js)"/)?.[1];
  if (!entrada) {
    console.error("[budget] não achei o <script src> da entrada no dist/index.html.");
    process.exit(1);
  }

  for (const c of chunks) {
    if (c.ext !== "js") continue;
    const isEntry = c.name === entrada;
    const limit = isEntry ? BUDGETS.entry : BUDGETS.perChunk;
    if (c.gz > limit) {
      violations.push(`${c.name} = ${fmt(c.gz)} > limite ${fmt(limit)} (${isEntry ? "entry" : "chunk"})`);
    }
  }

  if (totalJs > BUDGETS.totalJs) {
    violations.push(`Total JS = ${fmt(totalJs)} > limite ${fmt(BUDGETS.totalJs)}`);
  }
  if (totalCss > BUDGETS.totalCss) {
    violations.push(`Total CSS = ${fmt(totalCss)} > limite ${fmt(BUDGETS.totalCss)}`);
  }

  // Carregamento inicial: o que o index.html manda baixar antes da primeira tela.
  const iniciais = [...html.matchAll(/(?:src|href)="\/assets\/([^"]+\.(?:js|css))"/g)].map((m) => m[1]);
  const porNome = new Map(chunks.map((c) => [c.name, c]));
  const initialLoad = iniciais.reduce((a, n) => a + (porNome.get(n)?.gz ?? 0), 0);
  if (initialLoad > BUDGETS.initialLoad) {
    violations.push(`Carregamento inicial = ${fmt(initialLoad)} > limite ${fmt(BUDGETS.initialLoad)}`);
  }
  for (const n of iniciais) {
    if (PROIBIDOS_NO_INICIAL.some((re) => re.test(n))) {
      violations.push(`${n} entrou no carregamento inicial (só deveria carregar na tela que usa)`);
    }
  }

  console.log(`\n  Inicial   : ${fmt(initialLoad)} / ${fmt(BUDGETS.initialLoad)} (${iniciais.length} arquivos)`);
  console.log(`  Total JS  : ${fmt(totalJs)} / ${fmt(BUDGETS.totalJs)}`);
  console.log(`  Total CSS : ${fmt(totalCss)} / ${fmt(BUDGETS.totalCss)}\n`);

  if (violations.length === 0) {
    console.log("✅ Bundle dentro do budget.\n");
    return;
  }

  if (process.env.BUDGET_OVERRIDE === "relaxed") {
    console.warn("⚠️  Violações detectadas mas BUDGET_OVERRIDE=relaxed:");
    for (const v of violations) console.warn(`   - ${v}`);
    console.warn("");
    return;
  }

  console.error("❌ Bundle excede budget:");
  for (const v of violations) console.error(`   - ${v}`);
  console.error(
    "\nOpções: code-split mais, lazy-import deps pesadas, ou ajustar BUDGETS em scripts/check-bundle-size.mjs.\n"
  );
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
