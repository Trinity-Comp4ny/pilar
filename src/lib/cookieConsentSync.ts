/**
 * Reconciliação entre o cookie de consentimento (navegador) e a preferência da
 * conta (tabela `cookie_consents`). Ver SPEC 059 / ADR 0032.
 *
 * Regra: para usuário autenticado, o banco vence e o cookie é só cache. Quem
 * chega com decisão tomada na landing e ainda não tem registro na conta tem
 * essa decisão promovida a registro inicial (`carryover`).
 *
 * Vive fora de cookieConsent.ts para não criar ciclo de import: analytics.ts
 * importa cookieConsent.ts, e este módulo importa os dois.
 */

import { supabase } from "@/integrations/supabase/client";
import { applyCookieConsent } from "./analytics";
import { getCookieConsent } from "./cookieConsent";

type ConsentSource = "carryover" | "settings";

async function fetchLatestConsent(userId: string): Promise<boolean | null> {
  const { data, error } = await supabase
    .from("cookie_consents")
    .select("analytics")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data.analytics;
}

async function insertConsent(userId: string, analytics: boolean, source: ConsentSource): Promise<void> {
  await supabase.from("cookie_consents").insert({ user_id: userId, analytics, source });
}

/**
 * Chamado quando a sessão é estabelecida. Nunca liga o PostHog por conta
 * própria: só aplica uma decisão que já existe (no banco ou no cookie). Se
 * falhar, o gate fail-closed do analytics.ts continua valendo.
 */
export async function syncConsentForUser(userId: string): Promise<void> {
  try {
    const stored = await fetchLatestConsent(userId);

    if (stored !== null) {
      applyCookieConsent(stored);
      return;
    }

    const local = getCookieConsent();
    if (!local) return;

    await insertConsent(userId, local.analytics, "carryover");
  } catch {
    /* rede/RLS fora do ar não pode virar rastreamento silencioso nem quebrar o login */
  }
}

/** Toggle de Configurações → Privacidade: aplica na hora e registra na conta. */
export async function setAnalyticsConsent(userId: string, analytics: boolean): Promise<void> {
  applyCookieConsent(analytics);
  await insertConsent(userId, analytics, "settings");
}
