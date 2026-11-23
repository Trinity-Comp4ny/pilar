// Em qual empresa a edge function age. Por padrão, a do chamador. O ultra_admin (com MFA,
// conferido por is_ultra_admin() com o JWT dele) pode informar `empresa_id` para agir em
// outra empresa; a ação é registrada em admin_audit_logs ANTES de seguir e, se o registro
// falhar, a chamada é recusada (fail-closed).
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type EmpresaAlvo = { ok: true; empresaId: string } | { ok: false; status: number; error: string };

export async function resolverEmpresaAlvo(
  supabaseUsuario: SupabaseClient,
  profile: { empresa_id: string | null; role: string },
  empresaIdPedida: string | undefined,
  acao: string,
  alvo: { tipo: string; id?: string }
): Promise<EmpresaAlvo> {
  const propria = profile.empresa_id;
  const outraEmpresa = !!empresaIdPedida && empresaIdPedida !== propria;

  if (!outraEmpresa) {
    if (!propria) return { ok: false, status: 403, error: "Você precisa pertencer a uma empresa" };
    return { ok: true, empresaId: propria };
  }

  if (profile.role !== "ultra_admin") {
    return { ok: false, status: 403, error: "Apenas o ultra_admin pode agir em outra empresa" };
  }
  const { data: ehUltra, error: ultraError } = await supabaseUsuario.rpc("is_ultra_admin");
  if (ultraError || ehUltra !== true) {
    return { ok: false, status: 403, error: "Apenas o ultra_admin pode agir em outra empresa" };
  }

  const { error: auditError } = await supabaseUsuario.rpc("registrar_acesso_ultra_admin", {
    p_empresa_alvo: empresaIdPedida,
    p_action: acao,
    p_target_type: alvo.tipo,
    p_target_id: alvo.id ?? null,
  });
  if (auditError) return { ok: false, status: 503, error: "Serviço indisponível" };

  return { ok: true, empresaId: empresaIdPedida as string };
}
