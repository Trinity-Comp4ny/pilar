import { supabase } from "@/integrations/supabase/client";

/**
 * Meta-estado do onboarding guiado, persistido em `profiles.onboarding_state`.
 * NÃO guarda progresso dos passos (isso é derivado de contagem). Só o que o
 * usuário decidiu: dispensou o painel, concluiu, e quais tours de página já viu.
 */
export interface OnboardingState {
  dismissed: boolean;
  completed_at: string | null;
  tours_seen: string[];
}

export const EMPTY_ONBOARDING_STATE: OnboardingState = {
  dismissed: false,
  completed_at: null,
  tours_seen: [],
};

/** Valida o JSON vindo do banco na fronteira; nunca confia no shape cru. */
export function parseOnboardingState(raw: unknown): OnboardingState {
  if (!raw || typeof raw !== "object") return { ...EMPTY_ONBOARDING_STATE };
  const o = raw as Record<string, unknown>;
  return {
    dismissed: o.dismissed === true,
    completed_at: typeof o.completed_at === "string" ? o.completed_at : null,
    tours_seen: Array.isArray(o.tours_seen)
      ? o.tours_seen.filter((x): x is string => typeof x === "string")
      : [],
  };
}

// A RPC set_onboarding_state entra no types.ts só quando o gen:types (staging)
// rodar no deploy. Até lá, cast localizado no CLIENTE (não no método: destacar
// supabase.rpc numa const perde o `this` e quebra em runtime).
type OnboardingRpcClient = {
  rpc: (
    fn: "set_onboarding_state",
    args: { patch: Partial<OnboardingState> },
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

/** Faz merge raso server-side do patch em profiles.onboarding_state. */
export async function persistOnboardingState(patch: Partial<OnboardingState>): Promise<void> {
  const client = supabase as unknown as OnboardingRpcClient;
  const { error } = await client.rpc("set_onboarding_state", { patch });
  if (error) throw new Error(error.message);
}
