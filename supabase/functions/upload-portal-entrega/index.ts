import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withSentry } from "../_shared/sentry.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateUser, getCorsHeaders, jsonResponse, safeErrorResponse, optionsResponse } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("upload-portal-entrega");

// Upload autenticado de arquivos ao bucket portal-entregas
// Valida magic bytes (signature) antes de enviar pro storage
// Paths: {empresa_id}/{projeto_id}/{entrega_id}/{filename}

const MAX_SIZE_BYTES = 50 * 1024 * 1024;

interface MagicSignature {
  mime: string;
  signatures: Array<{ offset: number; bytes: number[] }>;
}

const MAGIC: MagicSignature[] = [
  { mime: "application/pdf", signatures: [{ offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] }] },
  { mime: "image/png", signatures: [{ offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }] },
  { mime: "image/jpeg", signatures: [{ offset: 0, bytes: [0xff, 0xd8, 0xff] }] },
  { mime: "image/gif", signatures: [{ offset: 0, bytes: [0x47, 0x49, 0x46, 0x38] }] },
  {
    mime: "image/webp",
    signatures: [
      { offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] },
      { offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] },
    ],
  },
  {
    mime: "application/zip",
    signatures: [{ offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] }],
  },
  {
    mime: "application/x-zip-compressed",
    signatures: [{ offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] }],
  },
  // Office OpenXML (docx/xlsx/pptx) = ZIP
  {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    signatures: [{ offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] }],
  },
  {
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    signatures: [{ offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] }],
  },
  {
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    signatures: [{ offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] }],
  },
  // Office legacy (doc/xls/ppt) = OLE2
  {
    mime: "application/msword",
    signatures: [{ offset: 0, bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] }],
  },
  {
    mime: "application/vnd.ms-excel",
    signatures: [{ offset: 0, bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] }],
  },
  {
    mime: "application/vnd.ms-powerpoint",
    signatures: [{ offset: 0, bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] }],
  },
];

// text/plain e text/csv não têm magic bytes fixos — check heurístico
const TEXT_MIMES = new Set(["text/plain", "text/csv"]);

function validateMagicBytes(bytes: Uint8Array, declaredMime: string): boolean {
  if (TEXT_MIMES.has(declaredMime)) {
    // Heurística: só caracteres imprimíveis/whitespace nos primeiros 1024 bytes
    const sample = bytes.slice(0, 1024);
    for (const b of sample) {
      if (b === 0) return false;
      if (b < 0x09 || (b > 0x0d && b < 0x20)) return false;
    }
    return true;
  }

  const matches = MAGIC.filter((m) => m.mime === declaredMime);
  if (matches.length === 0) return false;

  return matches.some((m) =>
    m.signatures.every((sig) => {
      const slice = bytes.slice(sig.offset, sig.offset + sig.bytes.length);
      return sig.bytes.every((expected, i) => slice[i] === expected);
    })
  );
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/\.{2,}/g, ".")
    .slice(0, 120);
}

serve(
  withSentry("upload-portal-entrega", async (req) => {
    if (req.method === "OPTIONS") return optionsResponse(req);
    if (req.method !== "POST") return safeErrorResponse(405, "Method not allowed", req);

    const auth = await authenticateUser(req);
    if (auth.error) return auth.error;
    const { supabase: supabaseClient, user } = auth;

    try {
      const form = await req.formData();
      const file = form.get("file");
      const projeto_id = form.get("projeto_id");
      const entrega_id = form.get("entrega_id");

      if (!(file instanceof File)) return safeErrorResponse(400, "file obrigatório", req);
      if (typeof projeto_id !== "string" || typeof entrega_id !== "string") {
        return safeErrorResponse(400, "projeto_id e entrega_id obrigatórios", req);
      }

      if (file.size === 0) return safeErrorResponse(400, "arquivo vazio", req);
      if (file.size > MAX_SIZE_BYTES) return safeErrorResponse(413, "arquivo > 50 MB", req);

      const { data: profile, error: profileError } = await supabaseClient
        .from("profiles")
        .select("empresa_id, role")
        .eq("id", user.id)
        .single();

      if (profileError || !profile?.empresa_id) return safeErrorResponse(403, "Sem empresa", req);
      if (!["admin", "operacional"].includes(profile.role ?? "")) {
        return safeErrorResponse(403, "Sem permissão", req);
      }

      // Valida que o projeto pertence à empresa
      const { data: projeto, error: projError } = await supabaseClient
        .from("projetos")
        .select("id, empresa_id")
        .eq("id", projeto_id)
        .single();

      if (projError || projeto?.empresa_id !== profile.empresa_id) {
        return safeErrorResponse(403, "Projeto inválido", req);
      }

      const buf = new Uint8Array(await file.arrayBuffer());
      const declaredMime = file.type || "application/octet-stream";

      if (!validateMagicBytes(buf, declaredMime)) {
        log.warn("magic bytes mismatch", {
          declared_mime: declaredMime,
          user_id: user.id,
          empresa_id: profile.empresa_id,
          projeto_id,
          entrega_id,
        });
        return safeErrorResponse(400, "Tipo de arquivo não corresponde ao conteúdo", req);
      }

      const safeName = sanitizeFilename(file.name);
      const path = `${profile.empresa_id}/${projeto_id}/${entrega_id}/${Date.now()}_${safeName}`;

      const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

      const { error: upErr } = await admin.storage.from("portal-entregas").upload(path, buf, {
        contentType: declaredMime,
        upsert: false,
      });

      if (upErr) {
        log.error("upload failed", upErr, {
          empresa_id: profile.empresa_id,
          projeto_id,
          entrega_id,
          path,
        });
        return safeErrorResponse(500, "Falha ao salvar arquivo", req);
      }

      // Atualiza registro em portal_entregas
      const { error: updErr } = await supabaseClient
        .from("portal_entregas")
        .update({
          arquivo_path: path,
          arquivo_nome: safeName,
          arquivo_mime: declaredMime,
          arquivo_tamanho_bytes: file.size,
        })
        .eq("id", entrega_id)
        .eq("empresa_id", profile.empresa_id);

      if (updErr) {
        log.error("update failed", updErr, {
          empresa_id: profile.empresa_id,
          entrega_id,
          path,
        });
      }

      return jsonResponse({ success: true, path, size: file.size }, 200, req);
    } catch (error: unknown) {
      log.error("unexpected error", error, { user_id: user.id });
      return safeErrorResponse(400, "Invalid request", req);
    }
  })
);
