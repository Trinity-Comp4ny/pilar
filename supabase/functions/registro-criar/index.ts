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
import { EXT_FOTO, MAX_FOTO_BYTES } from "../_shared/registro-midia-entrada.ts";
import { BUCKET_AUDIO, organizarRegistroReal } from "../_shared/registro-organizar-real.ts";
import { lerEntrada, tipoDoRegistro } from "./entrada.ts";

const log = createLogger("registro-criar");

const UM_DIA_MS = 24 * 60 * 60 * 1000;

// SPEC 135 (BEZ-55): o escritório grava um registro pela aba Diário da obra. Mesmo desenho do
// campo-registro-criar (guarda e responde 202; a IA organiza depois), mas a autorização é o JWT
// do usuário: a linha entra pelo cliente DELE, então a RLS de obra_registro decide se a obra é
// da empresa dele. O Storage só aceita escrita do service role, por isso os arquivos sobem por aqui.
serve(
  withSentry("registro-criar", async (req) => {
    if (req.method === "OPTIONS") return optionsResponse(req);
    if (req.method !== "POST") return safeErrorResponse(405, "Method not allowed", req);

    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const subidos: Array<{ bucket: string; path: string }> = [];
    const limpar = async () => {
      for (const b of new Set(subidos.map((s) => s.bucket))) {
        await admin.storage.from(b).remove(subidos.filter((s) => s.bucket === b).map((s) => s.path));
      }
    };

    try {
      const entrada = lerEntrada(await lerJson(req));
      if (!entrada.ok) return safeErrorResponse(400, entrada.error, req);
      const e = entrada.data;

      // Mesma janela do campo: de 30 dias atrás até 1 dia à frente (fuso do aparelho).
      const dataMs = new Date(`${e.data}T00:00:00Z`).getTime();
      if (Number.isNaN(dataMs) || dataMs > Date.now() + UM_DIA_MS || dataMs < Date.now() - 31 * UM_DIA_MS) {
        return safeErrorResponse(400, "data inválida", req);
      }

      const auth = req.headers.get("Authorization");
      if (!auth) return safeErrorResponse(401, "Não autenticado", req);
      const comoUsuario = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
        global: { headers: { Authorization: auth } },
      });
      const { data: u, error: uErr } = await comoUsuario.auth.getUser();
      if (uErr || !u.user) return safeErrorResponse(401, "Não autenticado", req);

      // A RLS só devolve a obra da empresa do usuário; "não existe" e "é de outra empresa" dão a mesma resposta.
      const { data: obra } = await comoUsuario.from("obras").select("id, empresa_id").eq("id", e.obra_id).maybeSingle();
      if (!obra) return safeErrorResponse(404, "Obra não encontrada", req);
      const { data: perfil } = await comoUsuario
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", u.user.id)
        .maybeSingle();
      const autorNome =
        [perfil?.first_name, perfil?.last_name].filter(Boolean).join(" ").trim() || u.user.email || "Escritório";

      const limite = await limitarOuResponder(admin, req, {
        bucket: "registro_criar",
        key: `user:${u.user.id}`,
        max: 120,
        windowSeconds: 3600,
      });
      if (limite) return limite;

      let audioPath: string | null = null;
      if (e.audio) {
        const dec = decodificarBase64(e.audio.base64, MAX_AUDIO_BYTES, "Áudio");
        if (!dec.ok) return safeErrorResponse(dec.status, dec.erro, req);
        audioPath = `${obra.empresa_id}/${obra.id}/${e.client_id}.${EXT_AUDIO[e.audio.mime_type]}`;
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
        const path = `${obra.empresa_id}/${obra.id}/registros/${e.client_id}/${i}.${EXT_FOTO[f.content_type]}`;
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

      const soFoto = !e.audio && !e.texto;
      const { data: reg, error: regErr } = await comoUsuario
        .from("obra_registro")
        .insert({
          empresa_id: obra.empresa_id,
          obra_id: obra.id,
          client_id: e.client_id,
          autor_user_id: u.user.id,
          autor_nome: autorNome,
          data_registro: e.data,
          tipo: tipoDoRegistro(e),
          texto_bruto: e.texto ?? null,
          audio_path: audioPath,
          audio_duracao_s: e.audio?.duracao_s ?? null,
          fotos: fotoPaths,
          status: soFoto ? "pronto" : "enviado",
        })
        .select("id")
        .single();

      if (regErr || !reg) {
        // 23505: o mesmo client_id já virou registro (reenvio). O primeiro envio manda.
        if (regErr?.code === "23505") {
          const { data: existente } = await comoUsuario
            .from("obra_registro")
            .select("id")
            .eq("obra_id", obra.id)
            .eq("client_id", e.client_id)
            .maybeSingle();
          if (existente) return jsonResponse({ success: true, registro_id: existente.id, existente: true }, 200, req);
        }
        log.error("insert do registro falhou", regErr, { client_id: e.client_id });
        await limpar();
        return safeErrorResponse(400, "Falha ao registrar", req);
      }

      if (!soFoto) {
        emSegundoPlano(organizarRegistroReal(admin, reg.id), (err) =>
          log.error("organização do registro falhou", err, { registro_id: reg.id })
        );
      }
      return jsonResponse({ success: true, registro_id: reg.id, existente: false }, 202, req);
    } catch (error: unknown) {
      log.error("erro inesperado", error, {});
      await limpar();
      return safeErrorResponse(400, "Invalid request", req);
    }
  })
);
