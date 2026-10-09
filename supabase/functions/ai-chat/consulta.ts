import { callGeminiStructured, streamGeminiText } from "../_shared/ai-client.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logAction, recordAndSaldo, respostaPrompt, respostaPromptStream, sseEvent, sseHeaders } from "./resposta.ts";
import { Agente, FEATURE_KEY, RespostaSchema } from "./schemas.ts";

export type ChatMeta = {
  agente: string;
  agente_label: string;
  motivo: string;
  model: string;
};

// Fluxo de consulta em STREAMING: emite o texto token-a-token via SSE e, ao fim, um
// evento "final" com o saldo. Se o stream falhar ANTES de emitir qualquer token, cai
// no buffered (callGeminiStructured) e entrega a resposta de uma vez. Falha depois de
// já ter emitido tokens vira um evento "error" (o client mostra o que houve).
export function streamConsulta(o: {
  db: SupabaseClient;
  admin: SupabaseClient;
  req: Request;
  sessionId: string;
  empresaId: string;
  agente: Agente;
  meta: ChatMeta;
  userMessage: string;
  userId: string;
  runId?: string;
  rotaTok: { in: number; out: number; calls: number };
}): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: string, data: unknown) => controller.enqueue(encoder.encode(sseEvent(event, data)));
      let full = "";
      let tokIn = o.rotaTok.in;
      let tokOut = o.rotaTok.out;
      let chamadas = o.rotaTok.calls;

      try {
        try {
          const gen = streamGeminiText(respostaPromptStream(o.agente), o.userMessage, {
            conversationId: o.sessionId,
            empresaId: o.empresaId,
            tipo: FEATURE_KEY, // mesmo modelo configurado para o chat (AI_MODELO_AI_CHAT)
          });
          let r = await gen.next();
          while (!r.done) {
            full += r.value;
            emit("token", { text: r.value });
            r = await gen.next();
          }
          tokIn += r.value.tokensEntrada;
          tokOut += r.value.tokensSaida;
          chamadas += 1;
        } catch (streamErr) {
          // Já emitiu tokens → não dá pra refazer limpo: propaga para virar "error".
          if (full !== "") throw streamErr;
          // Nada emitido ainda: fallback buffered no próprio servidor.
          const resp = await callGeminiStructured(
            {
              systemPrompt: respostaPrompt(o.agente),
              userMessage: o.userMessage,
              empresaId: o.empresaId,
              tipo: FEATURE_KEY,
              conversationId: o.sessionId,
            },
            RespostaSchema
          );
          full = resp.data.resposta;
          tokIn += resp.tokensEntrada;
          tokOut += resp.tokensSaida;
          chamadas += resp.attempts;
          emit("token", { text: full });
        }

        const resposta = full.trim() || "Não consegui gerar uma resposta agora.";

        await o.db.from("chat_messages").insert({
          session_id: o.sessionId,
          role: "assistant",
          content: resposta,
          meta: o.meta,
          tokens_input: tokIn,
          tokens_output: tokOut,
        });

        const saldo = await recordAndSaldo(o.admin, o.empresaId, o.userId, o.runId, tokIn, tokOut, chamadas);

        await logAction(o.db, o.runId, "gerar_resposta", undefined, { chars: resposta.length });
        if (o.runId) {
          await o.db
            .from("agent_runs")
            .update({ status: "executed", result: { resposta_len: resposta.length } })
            .eq("id", o.runId);
        }

        emit("final", {
          sessionId: o.sessionId,
          tipo: "resposta",
          resposta,
          agentes: [o.meta],
          saldo,
        });
      } catch (e) {
        console.error("[ai-chat stream]", e);
        emit("error", { error: "Erro ao gerar a resposta" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: sseHeaders(o.req) });
}
