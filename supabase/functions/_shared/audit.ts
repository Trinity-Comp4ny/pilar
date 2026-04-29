import { type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_STRING_LEN = 320;
const MAX_METADATA_BYTES = 8 * 1024;

export interface AuditParams {
  actorId: string;
  actorEmail: string;
  actorRole: "ultra_admin" | "admin";
  action: string;
  category: "user" | "empresa" | "member" | "billing" | "impersonation";
  targetType?: string;
  targetId?: string;
  targetName?: string;
  empresaId?: string | null;
  metadata?: Record<string, unknown>;
  req?: Request;
}

function truncate(value: string | null | undefined, max = MAX_STRING_LEN): string | null {
  if (value == null) return null;
  return value.length > max ? value.slice(0, max) : value;
}

function sanitizeMetadata(value: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!value || typeof value !== "object") return {};
  try {
    const serialized = JSON.stringify(value);
    if (serialized.length > MAX_METADATA_BYTES) {
      return { _truncated: true, _size_bytes: serialized.length };
    }
    return JSON.parse(serialized);
  } catch {
    return { _invalid_metadata: true };
  }
}

export async function logAction(svc: SupabaseClient, params: AuditParams): Promise<void> {
  const ipAddress = params.req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  const actorEmail = params.actorEmail?.trim() ?? "";
  if (!actorEmail || !EMAIL_REGEX.test(actorEmail) || actorEmail.length > MAX_STRING_LEN) {
    console.error("[audit] Rejected invalid actor_email:", actorEmail.slice(0, 64));
    return;
  }

  const { error } = await svc.from("admin_audit_logs").insert({
    actor_id: params.actorId,
    actor_email: actorEmail.toLowerCase(),
    actor_role: params.actorRole,
    action: truncate(params.action, 128),
    category: params.category,
    target_type: truncate(params.targetType) ?? null,
    target_id: params.targetId ?? null,
    target_name: truncate(params.targetName) ?? null,
    empresa_id: params.empresaId ?? null,
    metadata: sanitizeMetadata(params.metadata),
    ip_address: ipAddress,
  });

  if (error) {
    console.error("[audit] Failed to log action:", error.message);
  }
}
