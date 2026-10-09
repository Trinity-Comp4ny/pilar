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
import { callGeminiStructured, modeloEmUso } from "../../_shared/ai-client.ts";
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
  let tokensEntrada = 0;
  let tokensSaida = 0;
  try {
    const rota = await callGeminiStructured(
      {
        systemPrompt: ORQUESTRADOR_PROMPT,
        userMessage: comContexto(historico, caso.mensagem, "Classifique a intenção real do usuário (agente + modo)."),
        empresaId: EMPRESA_EVAL,
        tipo: FEATURE_KEY,
      },
      IntentSchema
    );
    tokensEntrada += rota.tokensEntrada;
    tokensSaida += rota.tokensSaida;
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
          tipo: FEATURE_KEY,
        },
        cfg.schema
      );
      tokensEntrada += extr.tokensEntrada;
      tokensSaida += extr.tokensSaida;
      const campos = (extr.data[cfg.entityKey] ?? {}) as Record<string, unknown>;
      const errosCampos = errosDeCampos(caso.campos, campos);
      camposOk = errosCampos.length === 0;
      erros.push(...errosCampos);
    } else if (caso.campos) {
      // Errou a entidade: a extração nem roda em produção. Conta como campo errado.
      camposOk = false;
    }

    return {
      id: caso.id,
      intencaoOk,
      camposOk,
      erros,
      latenciaMs: Date.now() - inicio,
      tokens: tokensEntrada + tokensSaida,
      tokensEntrada,
      tokensSaida,
    };
  } catch (e) {
    return {
      id: caso.id,
      intencaoOk: false,
      camposOk: caso.campos ? false : null,
      erros: [`falha na chamada: ${e instanceof Error ? e.message.slice(0, 200) : String(e)}`],
      latenciaMs: Date.now() - inicio,
      tokens: tokensEntrada + tokensSaida,
      tokensEntrada,
      tokensSaida,
    };
  }
}

/**
 * Preço por token do modelo, pelo catálogo do AI Gateway (precisa de AI_GATEWAY_API_KEY).
 * Modelo do Gemini direto é procurado como "google/<modelo>". Sem chave ou sem o modelo
 * no catálogo, o custo não é estimado.
 */
async function precoPorToken(modelo: string): Promise<{ entrada: number; saida: number } | null> {
  const chave = Deno.env.get("AI_GATEWAY_API_KEY");
  if (!chave) return null;
  try {
    const res = await fetch("https://ai-gateway.vercel.sh/v1/models", {
      headers: { Authorization: `Bearer ${chave}` },
    });
    if (!res.ok) return null;
    const { data } = (await res.json()) as {
      data: Array<{ id: string; pricing?: { input?: string; output?: string } }>;
    };
    const id = modelo.includes("/") ? modelo : `google/${modelo}`;
    const m = data.find((x) => x.id === id);
    if (!m?.pricing?.input || !m.pricing.output) return null;
    return { entrada: Number(m.pricing.input), saida: Number(m.pricing.output) };
  } catch {
    return null;
  }
}

if (import.meta.main) {
  const modelo = modeloEmUso(FEATURE_KEY);
  const precisaGemini = !modelo.includes("/");
  if (precisaGemini ? !Deno.env.get("GEMINI_API_KEY") : !Deno.env.get("AI_GATEWAY_API_KEY")) {
    console.error(
      `Defina ${precisaGemini ? "GEMINI_API_KEY" : "AI_GATEWAY_API_KEY"} para rodar os evals com ${modelo}.`
    );
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
  linha(`Modelo:     ${modelo}`);
  linha(`Casos:      ${s.casos}`);
  linha(`Intenção:   ${pct(s.intencao)} (limite ${pct(LIMITES.intencao)})`);
  linha(`Campos:     ${pct(s.campos)} (limite ${pct(LIMITES.campos)})`);
  linha(`Latência:   p95 ${s.latenciaP95Ms} ms`);
  linha(`Tokens:     ${s.tokens} (entrada ${s.tokensEntrada}, saída ${s.tokensSaida})`);
  const preco = await precoPorToken(modelo);
  const custoRodada = preco ? s.tokensEntrada * preco.entrada + s.tokensSaida * preco.saida : null;
  if (custoRodada !== null) {
    linha(
      `Custo:      US$ ${custoRodada.toFixed(4)} na rodada, US$ ${((custoRodada / s.casos) * 1000).toFixed(2)} por mil mensagens`
    );
  }
  linha(s.aprovado ? "APROVADO" : "REPROVADO");

  const saida = arg("--saida");
  if (saida) {
    await Deno.writeTextFile(
      saida,
      JSON.stringify(
        { modelo, custo_rodada_usd: custoRodada, gerado_em: new Date().toISOString(), resumo: s, resultados },
        null,
        2
      )
    );
  }
  Deno.exit(s.aprovado ? 0 : 1);
}
