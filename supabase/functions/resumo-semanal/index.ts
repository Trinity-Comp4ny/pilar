// resumo-semanal — resumo semanal do Início, escrito por IA sobre fatos calculados em código
// (SPEC 121, ADR 0058).
//
// Fluxo: o front pede o resumo da semana. A função lê os fatos pela RPC
// get_resumo_semanal_fatos COM O JWT de quem pediu (RLS dele; o escopo `empresa` ou `pessoa`
// sai do banco, por can_view_financeiro()). Se a semana já tem resumo, devolve sem chamar o
// modelo. Se não, o modelo redige, o código confere os números contra os fatos e a função
// grava em resumos_semanais (service role: authenticated não escreve nessa tabela).
//
// O cabeçalho do Início nunca fica vazio: sem tokens, com falha do provedor ou com texto que
// não bate com os fatos, a resposta é o resumo automático (`origem: "automatico"`), montado
// dos mesmos fatos e não gravado.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { captureException, withSentry, setSentryUser } from "../_shared/sentry.ts";
import { getCorsHeaders, jsonResponse, optionsResponse } from "../_shared/cors.ts";
import { limitarOuResponder } from "../_shared/db-rate-limit.ts";
import { lerJson, validar, z } from "../_shared/schemas.ts";
import {
  callGeminiStructured,
  createAdminClient,
  createAuthClient,
  debitarTokens,
  mensagemBloqueioTokens,
  modeloEmUso,
  respostaDeErroIa,
  verificarTokens,
} from "../_shared/ai-client.ts";
import { corpoErroIa, ehFalhaNossa, ErroIa } from "../_shared/ai-erros.ts";
import { createLogger } from "../_shared/logger.ts";
import {
  type Conteudo,
  conteudoSchema,
  type Fatos,
  fatosSchema,
  problemasDoConteudo,
  resumoAutomatico,
  systemPrompt,
  userMessage,
} from "./resumo.ts";

const log = createLogger("resumo-semanal");

const TIPO_IA = "resumo_semanal";
const MAX_TOKENS_DE_SAIDA = 1024;
/** Tentativas de o modelo acertar os números antes de cair no resumo automático. */
const TENTATIVAS_DE_CONFERENCIA = 2;

// Sem parâmetros: o resumo é um por semana e escopo, sem botão de atualizar (custo previsível).
const entradaSchema = z.object({});

interface ResultadoModelo {
  conteudo: Conteudo;
  tokensEntrada: number;
  tokensSaida: number;
  chamadas: number;
}

/** Pede o texto ao modelo e só aceita o que passa na conferência contra os fatos. */
async function redigir(fatos: Fatos, empresaId: string, referenciaId: string): Promise<ResultadoModelo> {
  let tokensEntrada = 0;
  let tokensSaida = 0;
  let chamadas = 0;
  let rejeicao = "";

  for (let tentativa = 1; tentativa <= TENTATIVAS_DE_CONFERENCIA; tentativa++) {
    const base = userMessage(fatos);
    const resposta = await callGeminiStructured(
      {
        systemPrompt: systemPrompt(fatos.escopo),
        userMessage: rejeicao
          ? `${base}\n\n[Tentativa ${tentativa}] A resposta anterior foi rejeitada: ${rejeicao}.`
          : base,
        empresaId,
        tipo: TIPO_IA,
        referenciaId,
        referenciaTipo: "resumo_semanal",
      },
      conteudoSchema,
      // Teto baixo: a saída é uma frase e três etiquetas, e no gemini-2.5 o raciocínio sai do
      // mesmo limite (1/4 dele). Sem o teto, o raciocínio gastava ~1.000 tokens por resumo.
      { maxRetries: 1, maxOutputTokens: MAX_TOKENS_DE_SAIDA }
    );
    tokensEntrada += resposta.tokensEntrada;
    tokensSaida += resposta.tokensSaida;
    chamadas += resposta.attempts;

    const problemas = problemasDoConteudo(resposta.data, fatos);
    if (problemas.length === 0) return { conteudo: resposta.data, tokensEntrada, tokensSaida, chamadas };
    rejeicao = problemas.join("; ");
    log.warn("resumo rejeitado pela conferência", { tentativa, problemas });
  }

  // Esgotou: quem chama cai no resumo automático. Os tokens gastos ainda são debitados.
  throw Object.assign(new ErroIa("saida_invalida", `resumo não passou na conferência: ${rejeicao}`), {
    tokensEntrada,
    tokensSaida,
    chamadas,
  });
}

serve(
  withSentry("resumo-semanal", async (req: Request) => {
    if (req.method === "OPTIONS") return optionsResponse(req);
    if (req.method !== "POST") return jsonResponse({ error: "Método não permitido" }, 405, req);

    try {
      const authClient = createAuthClient(req);
      const admin = createAdminClient();

      const {
        data: { user },
        error: userError,
      } = await authClient.auth.getUser();
      if (userError || !user) return jsonResponse({ error: "Não autenticado" }, 401, req);

      const { data: profile } = await authClient.from("profiles").select("empresa_id").eq("id", user.id).single();
      if (!profile?.empresa_id) return jsonResponse({ error: "Perfil não encontrado" }, 403, req);
      const empresaId = profile.empresa_id as string;
      setSentryUser({ id: user.id, empresa_id: empresaId });

      const entrada = validar(entradaSchema, await lerJson(req));
      if (!entrada.ok) return jsonResponse({ error: entrada.error }, 400, req);

      const limite = await limitarOuResponder(admin, req, {
        bucket: "resumo_semanal",
        key: `uid:${user.id}`,
        max: 12,
        windowSeconds: 3600,
      });
      if (limite) return limite;

      // 1) Fatos, sob o RLS de quem pediu. O escopo vem daqui, não do corpo da requisição.
      const { data: fatosBrutos, error: fatosErr } = await authClient.rpc("get_resumo_semanal_fatos");
      if (fatosErr) {
        log.error("falha ao ler os fatos da semana", fatosErr, { empresa_id: empresaId });
        return jsonResponse(
          { error: "Não foi possível montar os dados do resumo. Tente de novo em instantes." },
          502,
          req
        );
      }
      const fatosLidos = fatosSchema.safeParse(fatosBrutos);
      if (!fatosLidos.success) {
        log.error("fatos fora do formato esperado", fatosLidos.error, { empresa_id: empresaId });
        return jsonResponse(
          { error: "Não foi possível montar os dados do resumo. Tente de novo em instantes." },
          502,
          req
        );
      }
      const fatos = fatosLidos.data;
      const donoId = fatos.escopo === "pessoa" ? user.id : null;
      const semana = fatos.semana_inicio.slice(0, 10);

      // 2) Já existe resumo desta semana neste escopo?
      const buscarExistente = async () => {
        let consulta = admin
          .from("resumos_semanais")
          .select("conteudo, updated_at")
          .eq("empresa_id", empresaId)
          .eq("escopo", fatos.escopo)
          .eq("semana_inicio", semana);
        consulta = donoId ? consulta.eq("user_id", donoId) : consulta.is("user_id", null);
        const { data } = await consulta.maybeSingle();
        return data as { conteudo: Conteudo; updated_at: string } | null;
      };

      const existente = await buscarExistente();
      const resposta = (conteudo: Conteudo, extra: Record<string, unknown> = {}) =>
        jsonResponse({ escopo: fatos.escopo, resumo: conteudo, origem: "ia", ...extra }, 200, req);

      if (existente) return resposta(existente.conteudo, { gerado_em: existente.updated_at });

      const automatico = (motivo: string) =>
        jsonResponse({ escopo: fatos.escopo, resumo: resumoAutomatico(fatos), origem: "automatico", motivo }, 200, req);

      // 3) Módulo de IA (Agentes) ligado para esta pessoa e empresa; senão, só o automático.
      const { data: temIa } = await authClient.rpc("user_has_feature", { p_feature: "ai_chat" });
      if (temIa !== true) {
        return automatico(
          "Os agentes de IA não estão ativos na sua empresa. Este é um resumo automático dos mesmos dados."
        );
      }

      // 4) Gate de tokens: bloqueia antes de gastar no provedor.
      const gate = await verificarTokens(admin, empresaId, user.id);
      if (!gate.ok && gate.motivo) return automatico(mensagemBloqueioTokens(gate.motivo));

      // 5) Redação e conferência.
      const referenciaId = donoId ?? empresaId;
      let gerado: ResultadoModelo;
      try {
        gerado = await redigir(fatos, empresaId, referenciaId);
      } catch (e) {
        const gastos = e as { tokensEntrada?: number; tokensSaida?: number; chamadas?: number };
        if (gastos.tokensEntrada || gastos.tokensSaida) {
          await debitarTokens(admin, {
            empresaId,
            userId: user.id,
            agentKey: TIPO_IA,
            model: modeloEmUso(TIPO_IA),
            tokensInput: gastos.tokensEntrada ?? 0,
            tokensOutput: gastos.tokensSaida ?? 0,
            idempotencyKey: `${TIPO_IA}:${empresaId}:${fatos.escopo}:${donoId ?? "empresa"}:${semana}:rejeitado`,
            calls: gastos.chamadas,
          });
        }
        // Falha de IA tipada (provedor fora, tempo, saída inválida) e conferência falha caem
        // no mesmo lugar: o resumo automático, com o motivo em linguagem de usuário.
        const corpo = corpoErroIa(e);
        log.warn("resumo caiu no automático", { tipo: corpo.tipo, empresa_id: empresaId });
        if (ehFalhaNossa(corpo.tipo)) {
          await captureException(e, { fn: "resumo-semanal", tags: { tipo_erro_ia: corpo.tipo } });
        }
        return automatico("Não foi possível gerar o texto com IA agora. Este é um resumo automático dos mesmos dados.");
      }

      // 6) Debita o que o modelo gastou, ANTES de gravar: o custo existe mesmo que o resumo
      // perca a corrida para outra pessoa abrindo a mesma semana.
      await debitarTokens(admin, {
        empresaId,
        userId: user.id,
        agentKey: TIPO_IA,
        model: modeloEmUso(TIPO_IA),
        tokensInput: gerado.tokensEntrada,
        tokensOutput: gerado.tokensSaida,
        idempotencyKey: `${TIPO_IA}:${empresaId}:${fatos.escopo}:${donoId ?? "empresa"}:${semana}`,
        calls: gerado.chamadas,
      });

      // 7) Grava. Duas pessoas abrindo juntas: a unique garante uma linha só, e a segunda lê a primeira.
      const agora = new Date().toISOString();
      const { error: insErr } = await admin.from("resumos_semanais").insert({
        empresa_id: empresaId,
        escopo: fatos.escopo,
        user_id: donoId,
        semana_inicio: semana,
        conteudo: gerado.conteudo,
        fatos,
        modelo: modeloEmUso(TIPO_IA),
        tokens_entrada: gerado.tokensEntrada,
        tokens_saida: gerado.tokensSaida,
        updated_at: agora,
      });
      if (insErr?.code === "23505") {
        const outro = await buscarExistente();
        if (outro) return resposta(outro.conteudo, { gerado_em: outro.updated_at });
      }
      if (insErr) {
        log.error("falha ao gravar o resumo", insErr, { empresa_id: empresaId });
        return jsonResponse({ error: "Não foi possível salvar o resumo. Tente de novo em instantes." }, 500, req);
      }

      return resposta(gerado.conteudo, { gerado_em: agora });
    } catch (e) {
      return await respostaDeErroIa(e, getCorsHeaders(req), "resumo-semanal");
    }
  })
);
