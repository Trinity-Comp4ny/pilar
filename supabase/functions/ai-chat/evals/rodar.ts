/**
 * Evals do ai-chat contra o modelo de verdade.
 *
 *   GEMINI_API_KEY=... deno run --allow-env --allow-net --allow-write \
 *     supabase/functions/ai-chat/evals/rodar.ts [--saida resultado.json] [--filtro texto]
 *
 * Mesmo caminho da produção: ORQUESTRADOR_PROMPT + IntentSchema para a intenção e, nas
 * ações, o prompt e o schema de ENTIDADE_CFG para a extração, via callGeminiStructured
 * (com os retries de lá). Nada é gravado no banco.
 *
 * Sai com erro se a acurácia de intenção ou de campos ficar abaixo de LIMITES. Custo: duas
 * chamadas por caso de ação, uma nos demais (gemini-2.5-flash, centavos por rodada).
 */
import { callGeminiStructured, GEMINI_MODEL } from "../../_shared/ai-client.ts";
import { comContexto, SEM_HISTORICO } from "../contexto.ts";
import { ENTIDADE_CFG } from "../entidades.ts";
import { ORQUESTRADOR_PROMPT } from "../prompts.ts";
import { FEATURE_KEY, IntentSchema } from "../schemas.ts";
import { errosDeCampos, errosDeIntencao, LIMITES, resumir, type ResultadoCaso } from "./avaliar.ts";
import { type Caso, CASOS } from "./casos.ts";

const EMPRESA_EVAL = "00000000-0000-0000-0000-00000000e7a1";

// Relatório no stdout (é a saída do script, não log de depuração).
const encoder = new TextEncoder();
function linha(texto = ""): void {
  Deno.stdout.writeSync(encoder.encode(`${texto}\n`));
}

function arg(nome: string): string | undefined {
  const i = Deno.args.indexOf(nome);
  return i >= 0 ? Deno.args[i + 1] : undefined;
}

async function rodarCaso(caso: Caso): Promise<ResultadoCaso> {
  const inicio = Date.now();
  const historico = caso.historico ?? SEM_HISTORICO;
  let tokens = 0;
  try {
    const rota = await callGeminiStructured(
      {
        systemPrompt: ORQUESTRADOR_PROMPT,
        userMessage: comContexto(historico, caso.mensagem, "Classifique a intenção real do usuário (agente + modo)."),
        empresaId: EMPRESA_EVAL,
        tipo: `${FEATURE_KEY}_eval`,
      },
      IntentSchema
    );
    tokens += rota.tokensEntrada + rota.tokensSaida;
    const erros = errosDeIntencao(caso.esperado, rota.data);
    const intencaoOk = erros.length === 0;

    let camposOk: boolean | null = null;
    const cfg = caso.campos && rota.data.entidade ? ENTIDADE_CFG[rota.data.entidade] : undefined;
    if (caso.campos && cfg && rota.data.entidade === caso.esperado.entidade) {
      const extr = await callGeminiStructured(
        {
          systemPrompt: cfg.prompt,
          userMessage: comContexto(historico, caso.mensagem, cfg.instrucao),
          empresaId: EMPRESA_EVAL,
          tipo: `${FEATURE_KEY}_eval`,
        },
        cfg.schema
      );
      tokens += extr.tokensEntrada + extr.tokensSaida;
      const campos = (extr.data[cfg.entityKey] ?? {}) as Record<string, unknown>;
      const errosCampos = errosDeCampos(caso.campos, campos);
      camposOk = errosCampos.length === 0;
      erros.push(...errosCampos);
    } else if (caso.campos) {
      // Errou a entidade: a extração nem roda em produção. Conta como campo errado.
      camposOk = false;
    }

    return { id: caso.id, intencaoOk, camposOk, erros, latenciaMs: Date.now() - inicio, tokens };
  } catch (e) {
    return {
      id: caso.id,
      intencaoOk: false,
      camposOk: caso.campos ? false : null,
      erros: [`falha na chamada: ${e instanceof Error ? e.message.slice(0, 200) : String(e)}`],
      latenciaMs: Date.now() - inicio,
      tokens,
    };
  }
}

if (import.meta.main) {
  if (!Deno.env.get("GEMINI_API_KEY")) {
    console.error("Defina GEMINI_API_KEY para rodar os evals.");
    Deno.exit(2);
  }
  const filtro = arg("--filtro");
  const casos = filtro ? CASOS.filter((c) => c.id.includes(filtro)) : CASOS;

  // Três por vez: rápido sem esbarrar no limite de requisições do modelo.
  const resultados: ResultadoCaso[] = [];
  for (let i = 0; i < casos.length; i += 3) {
    resultados.push(...(await Promise.all(casos.slice(i, i + 3).map(rodarCaso))));
  }

  for (const r of resultados) {
    const ok = r.intencaoOk && r.camposOk !== false;
    linha(`${ok ? "ok  " : "FAIL"} ${r.id.padEnd(34)} ${String(r.latenciaMs).padStart(6)} ms`);
    for (const e of r.erros) linha(`       ${e}`);
  }

  const s = resumir(resultados);
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  linha();
  linha(`Modelo:     ${GEMINI_MODEL}`);
  linha(`Casos:      ${s.casos}`);
  linha(`Intenção:   ${pct(s.intencao)} (limite ${pct(LIMITES.intencao)})`);
  linha(`Campos:     ${pct(s.campos)} (limite ${pct(LIMITES.campos)})`);
  linha(`Latência:   p95 ${s.latenciaP95Ms} ms`);
  linha(`Tokens:     ${s.tokens}`);
  linha(s.aprovado ? "APROVADO" : "REPROVADO");

  const saida = arg("--saida");
  if (saida) {
    await Deno.writeTextFile(
      saida,
      JSON.stringify({ modelo: GEMINI_MODEL, gerado_em: new Date().toISOString(), resumo: s, resultados }, null, 2)
    );
  }
  Deno.exit(s.aprovado ? 0 : 1);
}
