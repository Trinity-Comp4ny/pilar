// SPEC 135: as dependências reais do organizador de registros (banco, Storage e Gemini).
// A lógica fica em registro-organizar.ts; aqui só a fiação, que o teste de unidade não toca.

import { encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callGeminiStructured, debitarTokens, verificarTokens } from "./ai-client.ts";
import { modeloEmUso } from "./llm.ts";
import { type Deps, organizarRegistro, type Resultado } from "./registro-organizar.ts";
import {
  extracaoSchema,
  MIME_AUDIO,
  mensagemExtracao,
  PROMPT_EXTRACAO,
  PROMPT_TRANSCRICAO,
  transcricaoSchema,
} from "./registro-esquema.ts";

export const BUCKET_AUDIO = "obra-registro-audio";
const AGENT_KEY = "registro-voz";
const TIPO_TRANSCRICAO = "registro-transcricao";
const TIPO_EXTRACAO = "registro-extracao";

const MIME_POR_EXT: Record<string, string> = {
  webm: "audio/webm",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  aac: "audio/aac",
};

function mimeDoAudio(path: string, tipoDoBlob: string): string {
  const doBlob = tipoDoBlob.split(";")[0].trim();
  if ((MIME_AUDIO as readonly string[]).includes(doBlob)) return doBlob;
  return MIME_POR_EXT[path.split(".").pop() ?? ""] ?? "audio/webm";
}

export function depsReais(admin: SupabaseClient): Deps {
  return {
    async iniciar(id) {
      const { data, error } = await admin.rpc("_registro_iniciar_organizacao", { p_id: id });
      if (error) throw new Error(`_registro_iniciar_organizacao falhou: ${error.message}`);
      const r = data as {
        id: string | null;
        empresa_id: string;
        texto_bruto: string | null;
        audio_path: string | null;
      } | null;
      if (!r?.id) return null;
      return { id: r.id, empresaId: r.empresa_id, textoBruto: r.texto_bruto, audioPath: r.audio_path };
    },

    async baixarAudio(path) {
      const { data, error } = await admin.storage.from(BUCKET_AUDIO).download(path);
      if (error || !data) return null;
      return { base64: encode(await data.arrayBuffer()), mime: mimeDoAudio(path, data.type) };
    },

    async transcrever({ empresaId, audio }) {
      // Só ouvir: sem raciocínio estendido, sem segunda tentativa de schema além de uma.
      const r = await callGeminiStructured(
        {
          systemPrompt: PROMPT_TRANSCRICAO,
          userMessage: "Transcreva este áudio.",
          empresaId,
          tipo: TIPO_TRANSCRICAO,
          files: [{ mimeType: audio.mime, dataBase64: audio.base64 }],
        },
        transcricaoSchema,
        { maxRetries: 1, maxOutputTokens: 4096, semRaciocinio: true }
      );
      return { transcricao: r.data.transcricao, tokensEntrada: r.tokensEntrada, tokensSaida: r.tokensSaida };
    },

    async extrair({ empresaId, texto }) {
      const r = await callGeminiStructured(
        { systemPrompt: PROMPT_EXTRACAO, userMessage: mensagemExtracao(texto), empresaId, tipo: TIPO_EXTRACAO },
        extracaoSchema,
        { maxRetries: 1, maxOutputTokens: 2048, semRaciocinio: true }
      );
      return { data: r.data, tokensEntrada: r.tokensEntrada, tokensSaida: r.tokensSaida };
    },

    async gravar(g) {
      const { error } = await admin.rpc("_registro_gravar_organizacao", {
        p_id: g.id,
        p_status: g.status,
        p_texto_bruto: g.textoBruto,
        p_texto_organizado: g.textoOrganizado,
        p_extraido: g.extraido,
        p_erro: g.erro,
      });
      if (error) throw new Error(`_registro_gravar_organizacao falhou: ${error.message}`);
    },

    async tokensDisponiveis(empresaId) {
      const gate = await verificarTokens(admin, empresaId, null);
      return { ok: gate.ok };
    },

    async debitar({ empresaId, registroId, uso }) {
      await debitarTokens(admin, {
        empresaId,
        userId: null,
        agentKey: AGENT_KEY,
        model: modeloEmUso(TIPO_TRANSCRICAO),
        tokensInput: uso.tokensEntrada,
        tokensOutput: uso.tokensSaida,
        idempotencyKey: `registro:${registroId}:${crypto.randomUUID()}`,
        calls: uso.chamadas,
      });
    },
  };
}

export function organizarRegistroReal(admin: SupabaseClient, registroId: string): Promise<Resultado> {
  return organizarRegistro(depsReais(admin), registroId);
}
