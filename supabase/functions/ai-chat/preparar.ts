// Prepara os dados da consulta (SPEC 147): investigação com ferramentas e, se ela falhar ou
// estiver desligada (AI_CHAT_FERRAMENTAS=0), os coletores agregados de sempre.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callGeminiStructured } from "../_shared/ai-client.ts";
import { captureException } from "../_shared/sentry.ts";
import { coletarDados } from "./coleta.ts";
import { comContexto } from "./contexto.ts";
import { FERRAMENTA_POR_NOME, FERRAMENTAS } from "./ferramentas.ts";
import {
  instrucaoDeResposta,
  investigar,
  type Observacao,
  PassoSchema,
  promptPlanejador,
  mensagemPlanejador,
} from "./investigar.ts";
import { logAction } from "./resposta.ts";
import { type Agente, FEATURE_KEY } from "./schemas.ts";

export type ConsultaPreparada = {
  userMessage: string;
  /** Tokens e chamadas gastos no planejamento, somados ao roteamento no débito. */
  uso: { tokensEntrada: number; tokensSaida: number; chamadas: number };
  ferramentas: string[];
};

const ferramentasLigadas = () => Deno.env.get("AI_CHAT_FERRAMENTAS") !== "0";

function resumoDoResultado(obs: Observacao): Record<string, unknown> {
  if (obs.erro) return { erro: obs.erro };
  const r = obs.resultado as { total?: unknown; mostrando?: unknown } | null;
  return { total: r?.total ?? null, mostrando: r?.mostrando ?? null };
}

export async function prepararConsulta(o: {
  db: SupabaseClient;
  empresaId: string;
  agente: Agente;
  historico: string;
  message: string;
  focoProjeto: string;
  sessionId: string;
  runId?: string;
}): Promise<ConsultaPreparada> {
  if (ferramentasLigadas()) {
    try {
      const inv = await investigar({
        ferramentas: FERRAMENTA_POR_NOME,
        ctx: { db: o.db, empresaId: o.empresaId },
        planejar: (observacoes, passo) =>
          callGeminiStructured(
            {
              systemPrompt: promptPlanejador(FERRAMENTAS),
              userMessage: mensagemPlanejador({
                historico: o.historico,
                message: o.message,
                focoProjeto: o.focoProjeto,
                observacoes,
                passo,
              }),
              empresaId: o.empresaId,
              tipo: FEATURE_KEY,
              conversationId: o.sessionId,
            },
            PassoSchema,
            { semRaciocinio: true, maxRetries: 1 }
          ),
        aoObservar: (obs) => logAction(o.db, o.runId, `ferramenta_${obs.ferramenta}`, obs.args, resumoDoResultado(obs)),
      });
      // Se toda consulta falhou, melhor cair nos coletores do que responder sem dado nenhum.
      const algumDado = inv.observacoes.some((obs) => !obs.erro);
      if (inv.observacoes.length === 0 || algumDado) {
        return {
          userMessage: comContexto(o.historico, o.message, instrucaoDeResposta(inv.observacoes, o.focoProjeto)),
          uso: inv.uso,
          ferramentas: inv.observacoes.filter((obs) => !obs.erro).map((obs) => obs.ferramenta),
        };
      }
    } catch (e) {
      await captureException(e, { fn: "ai-chat", tags: { etapa: "investigar", empresa_id: o.empresaId } });
    }
  }

  const dados = await coletarDados(o.agente, o.db, o.empresaId);
  await logAction(o.db, o.runId, `consultar_${o.agente}`, { fonte: o.agente }, { chaves: Object.keys(dados) });
  return {
    userMessage: comContexto(
      o.historico,
      o.message,
      `Responda à mensagem atual do usuário usando SOMENTE os dados abaixo.\n\nDados disponíveis (JSON):\n${JSON.stringify(dados)}${o.focoProjeto}`
    ),
    uso: { tokensEntrada: 0, tokensSaida: 0, chamadas: 0 },
    ferramentas: [],
  };
}
