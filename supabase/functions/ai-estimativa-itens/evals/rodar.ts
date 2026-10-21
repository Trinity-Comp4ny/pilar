/**
 * Evals do ai-estimativa-itens contra o modelo de verdade (SPEC 138, ADR 0048).
 *
 *   GEMINI_API_KEY=... deno run --allow-env --allow-net --allow-read --allow-write \
 *     supabase/functions/ai-estimativa-itens/evals/rodar.ts [--saida resultado.json] [--filtro texto]
 *
 * Mesmo caminho da produção: catálogo dos parâmetros (aqui lidos das migrations), o prompt, o schema e
 * `callGeminiStructured` (com os retries de lá) e a conferência contra o catálogo. Nada é gravado no banco.
 * Roda a partir da raiz do repositório. Sai com erro se algum limite de `LIMITES` não for atingido.
 */
import { callGeminiStructured, modeloEmUso } from "../../_shared/ai-client.ts";
import { itensPermitidos } from "../catalogo.ts";
import { conferirSaida, SaidaSchema } from "../esquema.ts";
import { mensagemDoUsuario, promptDoSistema } from "../prompt.ts";
import { adicionaisDasMigrations } from "./adicionais-das-migrations.ts";
import { contaDeFalha, contarCaso, LIMITES, resumir, type ResultadoCaso } from "./avaliar.ts";
import { type Caso, CASOS } from "./casos.ts";

const TIPO = "estimativa-itens";
const EMPRESA_EVAL = "00000000-0000-0000-0000-00000000e7a2";

// Relatório no stdout (é a saída do script, não log de depuração).
const encoder = new TextEncoder();
function linha(texto = ""): void {
  Deno.stdout.writeSync(encoder.encode(`${texto}\n`));
}

function arg(nome: string): string | undefined {
  const i = Deno.args.indexOf(nome);
  return i >= 0 ? Deno.args[i + 1] : undefined;
}

async function rodarCaso(caso: Caso, systemPrompt: string, permitidos: Set<string>): Promise<ResultadoCaso> {
  const inicio = Date.now();
  try {
    const r = await callGeminiStructured(
      { systemPrompt, userMessage: mensagemDoUsuario(caso.descricao), empresaId: EMPRESA_EVAL, tipo: TIPO },
      SaidaSchema,
      { maxRetries: 1, maxOutputTokens: 2048 }
    );
    const obtido = conferirSaida(SaidaSchema.parse(r.data), permitidos);
    const conta = contarCaso(caso.esperado, obtido);
    return {
      id: caso.id,
      obtido,
      categoria: caso.categoria,
      falhou: false,
      latenciaMs: Date.now() - inicio,
      tokensEntrada: r.tokensEntrada,
      tokensSaida: r.tokensSaida,
      ...conta,
    };
  } catch (e) {
    const motivo = `falha na chamada: ${e instanceof Error ? e.message.slice(0, 200) : String(e)}`;
    return {
      id: caso.id,
      categoria: caso.categoria,
      falhou: true,
      latenciaMs: Date.now() - inicio,
      tokensEntrada: 0,
      tokensSaida: 0,
      ...contaDeFalha(caso.esperado, motivo),
    };
  }
}

if (import.meta.main) {
  const modelo = modeloEmUso(TIPO);
  const precisaGemini = !modelo.includes("/");
  if (precisaGemini ? !Deno.env.get("GEMINI_API_KEY") : !Deno.env.get("AI_GATEWAY_API_KEY")) {
    console.error(
      `Defina ${precisaGemini ? "GEMINI_API_KEY" : "AI_GATEWAY_API_KEY"} para rodar os evals com ${modelo}.`
    );
    Deno.exit(2);
  }
  const permitidos = itensPermitidos(await adicionaisDasMigrations());
  const systemPrompt = promptDoSistema(permitidos);
  const ids = new Set<string>(permitidos.map((i) => i.id));

  const filtro = arg("--filtro");
  const casos = filtro ? CASOS.filter((c) => c.id.includes(filtro) || c.categoria === filtro) : CASOS;

  // Três por vez: rápido sem esbarrar no limite de requisições do modelo.
  const resultados: ResultadoCaso[] = [];
  for (let i = 0; i < casos.length; i += 3) {
    resultados.push(...(await Promise.all(casos.slice(i, i + 3).map((c) => rodarCaso(c, systemPrompt, ids)))));
  }

  for (const r of resultados) {
    const ok = r.erros.length === 0;
    linha(`${ok ? "ok  " : "FAIL"} ${r.id.padEnd(40)} ${String(r.latenciaMs).padStart(6)} ms`);
    for (const e of r.erros) linha(`       ${e}`);
  }

  const s = resumir(resultados);
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  linha();
  linha(`Modelo:      ${modelo}`);
  linha(`Casos:       ${s.casos} (${s.falhas} com falha de chamada)`);
  linha(
    `Item (F1):   ${pct(s.item)} (limite ${pct(LIMITES.item)}); precisão ${pct(s.precisao)}, cobertura ${pct(s.cobertura)}, ${s.itensDemais} item(ns) a mais`
  );
  linha(`Quantidade:  ${pct(s.quantidade)} (limite ${pct(LIMITES.quantidade)})`);
  linha(`Campos:      ${pct(s.campos)} (limite ${pct(LIMITES.campos)})`);
  linha(`Fora:        ${pct(s.fora)} (limite ${pct(LIMITES.fora)})`);
  linha(`Perguntas:   ${pct(s.perguntas)} (limite ${pct(LIMITES.perguntas)})`);
  linha(`Latência:    p95 ${s.latenciaP95Ms} ms`);
  linha(`Tokens:      p95 ${s.tokensP95} por chamada (entrada ${s.tokensEntrada}, saída ${s.tokensSaida} na rodada)`);
  linha(s.aprovado ? "APROVADO" : "REPROVADO");

  const saida = arg("--saida");
  if (saida) {
    await Deno.writeTextFile(
      saida,
      JSON.stringify({ modelo, gerado_em: new Date().toISOString(), resumo: s, resultados }, null, 2)
    );
  }
  Deno.exit(s.aprovado ? 0 : 1);
}
