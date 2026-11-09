import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withSentry } from "../_shared/sentry.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { jsonResponse, optionsResponse, safeErrorResponse } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logger.ts";
import { limitarOuResponder } from "../_shared/db-rate-limit.ts";
import { lerJson } from "../_shared/schemas.ts";
import { decodificarBase64 } from "../_shared/midia-base64.ts";
import { emSegundoPlano } from "../_shared/segundo-plano.ts";
import { EXT_AUDIO, MAX_AUDIO_BYTES } from "../_shared/registro-esquema.ts";
import { BUCKET_AUDIO, organizarRegistroReal } from "../_shared/registro-organizar-real.ts";
import { EXT_FOTO, lerEntrada, MAX_FOTO_BYTES } from "./entrada.ts";

const log = createLogger("campo-registro-criar");

// SPEC 135: o campo grava um registro e fecha o app. Esta função só guarda (áudio no bucket
// privado, fotos, linha no banco) e responde 202 na hora; a IA organiza depois, em segundo
// plano. A conta de campo NÃO é usuário do Supabase: a autorização é o token no corpo.
serve(
  withSentry("campo-registro-criar", async (req) => {
    if (req.method === "OPTIONS") return optionsResponse(req);
    if (req.method !== "POST") return safeErrorResponse(405, "Method not allowed", req);

    const subidos: Array<{ bucket: string; path: string }> = [];
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const limpar = async () => {
      for (const b of new Set(subidos.map((s) => s.bucket))) {
        await admin.storage.from(b).remove(subidos.filter((s) => s.bucket === b).map((s) => s.path));
      }
    };

    try {
      const entrada = lerEntrada(await lerJson(req));
      if (!entrada.ok) return safeErrorResponse(400, entrada.error, req);
      const e = entrada.data;

      const { data: sess, error: sessErr } = await admin.rpc("campo_verify_session", { p_token: e.token });
      const s = sess as { ok?: boolean; obra_id?: string; empresa_id?: string; must_change_senha?: boolean } | null;
      if (sessErr || !s?.ok || s.must_change_senha) return safeErrorResponse(401, "Sessão inválida", req);

      // Registro curto, várias vezes ao dia: 120/h por obra barra loop sem atrapalhar a equipe.
      const limite = await limitarOuResponder(admin, req, {
        bucket: "campo_registro_criar",
        key: `obra:${s.obra_id}`,
        max: 120,
        windowSeconds: 3600,
      });
      if (limite) return limite;

      if (e.aceite_audio) {
        const { data: ac } = await admin.rpc("campo_aceitar_audio", { p_token: e.token });
        if (!(ac as { ok?: boolean } | null)?.ok) return safeErrorResponse(401, "Sessão inválida", req);
      }

      let audioPath: string | null = null;
      if (e.audio) {
        const dec = decodificarBase64(e.audio.base64, MAX_AUDIO_BYTES, "Áudio");
        if (!dec.ok) return safeErrorResponse(dec.status, dec.erro, req);
        audioPath = `${s.empresa_id}/${s.obra_id}/${e.client_id}.${EXT_AUDIO[e.audio.mime_type]}`;
        // upsert: o reenvio da fila offline sobrescreve o mesmo caminho, sem sobra.
        const { error: upErr } = await admin.storage
          .from(BUCKET_AUDIO)
          .upload(audioPath, dec.bytes, { contentType: e.audio.mime_type, upsert: true });
        if (upErr) {
          log.error("upload do áudio falhou", upErr, { client_id: e.client_id });
          return safeErrorResponse(400, "Falha ao guardar o áudio", req);
        }
        subidos.push({ bucket: BUCKET_AUDIO, path: audioPath });
      }

      const fotoPaths: string[] = [];
      for (const [i, f] of e.fotos.entries()) {
        const dec = decodificarBase64(f.image_base64, MAX_FOTO_BYTES, "Foto");
        if (!dec.ok) {
          await limpar();
          return safeErrorResponse(dec.status, dec.erro, req);
        }
        const path = `${s.empresa_id}/${s.obra_id}/registros/${e.client_id}/${i}.${EXT_FOTO[f.content_type]}`;
        const { error: upErr } = await admin.storage
          .from("obra-campo")
          .upload(path, dec.bytes, { contentType: f.content_type, upsert: true });
        if (upErr) {
          log.error("upload da foto falhou", upErr, { client_id: e.client_id });
          await limpar();
          return safeErrorResponse(400, "Falha ao guardar a foto", req);
        }
        subidos.push({ bucket: "obra-campo", path });
        fotoPaths.push(path);
      }

      const { data: reg, error: regErr } = await admin.rpc("_campo_criar_registro", {
        p_token: e.token,
        p_client_id: e.client_id,
        p_data: e.data,
        p_texto: e.texto ?? null,
        p_audio_path: audioPath,
        p_audio_duracao_s: e.audio?.duracao_s ?? null,
        p_fotos: fotoPaths,
      });
      const r = reg as { ok?: boolean; erro?: string; registro_id?: string; existente?: boolean } | null;
      if (regErr || !r?.ok || !r.registro_id) {
        await limpar();
        // 'aceite_audio' é o servidor recusando áudio sem o aviso aceito: o aparelho mostra o aviso.
        const status = r?.erro === "aceite_audio" ? 403 : 400;
        return safeErrorResponse(status, r?.erro ?? "Falha ao registrar", req);
      }

      // Registro já existia (reenvio da fila): o primeiro envio manda, nada novo a organizar.
      if (r.existente) return jsonResponse({ success: true, registro_id: r.registro_id, existente: true }, 200, req);

      // Só foto não tem o que organizar; texto ou áudio vão para a IA em segundo plano.
      if (e.audio || e.texto) {
        emSegundoPlano(organizarRegistroReal(admin, r.registro_id), (err) =>
          log.error("organização do registro falhou", err, { registro_id: r.registro_id })
        );
      }
      return jsonResponse({ success: true, registro_id: r.registro_id, existente: false }, 202, req);
    } catch (error: unknown) {
      log.error("erro inesperado", error, {});
      await limpar();
      return safeErrorResponse(400, "Invalid request", req);
    }
  })
);
