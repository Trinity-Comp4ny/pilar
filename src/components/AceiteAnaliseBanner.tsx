import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { CONSENT_CHANGED_EVENT, getCookieConsent } from "@/lib/cookieConsent";
import { fetchLatestConsent, setAnalyticsConsent } from "@/lib/cookieConsentSync";

/**
 * Pedido único de consentimento de análise de uso (PostHog), dentro do app.
 *
 * O app não tinha onde perguntar: só a landing (banner) e Configurações → Privacidade. Quem entrava
 * direto no app nunca decidia, e o analytics é fail-closed (ADR 0022/0032), então quase ninguém era
 * medido. Aparece só para quem está logado e ainda não decidiu, nem neste navegador (cookie) nem na
 * conta (`cookie_consents`). Aceitar ou recusar grava na conta e a faixa não volta.
 */
const ROTAS_SEM_FAIXA = ["/profile-setup", "/cadastro", "/login", "/mfa"];

export function AceiteAnaliseBanner() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [decididoNoNavegador, setDecididoNoNavegador] = useState(() => getCookieConsent() !== null);

  useEffect(() => {
    const aoMudar = () => setDecididoNoNavegador(getCookieConsent() !== null);
    window.addEventListener(CONSENT_CHANGED_EVENT, aoMudar);
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, aoMudar);
  }, []);

  // Decisão já gravada na conta (outro aparelho) vence: o sync do login a aplica e a faixa não abre.
  const conta = useQuery({
    queryKey: ["consentimento-analytics", user?.id],
    enabled: !!user && !decididoNoNavegador,
    staleTime: Infinity,
    queryFn: () => fetchLatestConsent(user!.id),
  });

  const decidir = useMutation({
    mutationFn: (aceito: boolean) => setAnalyticsConsent(user!.id, aceito),
    onSuccess: (_d, aceito) => {
      toast.success(aceito ? "Obrigado. Isso nos ajuda a melhorar a Pilar." : "Combinado, não vamos medir seu uso.");
      setDecididoNoNavegador(true);
    },
    onError: () => toast.error("Não foi possível salvar a preferência. Tente de novo."),
  });

  if (!user || decididoNoNavegador) return null;
  if (ROTAS_SEM_FAIXA.some((r) => pathname.startsWith(r))) return null;
  // Carregando ou erro de rede: não pergunta (evita perguntar de novo a quem já decidiu em outro aparelho).
  if (conta.isLoading || conta.isError || conta.data !== null) return null;

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 bg-fill-info px-4 py-2.5 text-sm text-fill-info-foreground"
    >
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 shrink-0" strokeWidth={2} />
        <span>
          <span className="font-medium">Podemos medir como você usa a Pilar?</span>{" "}
          Telas visitadas, cliques e gravação da tela com todo texto e campo escondidos. Nunca nomes, valores ou documentos.
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <a href="/privacidade" target="_blank" rel="noopener noreferrer" className="text-xs font-medium underline underline-offset-2">
          Saiba mais
        </a>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs text-fill-info-foreground hover:bg-fill-info-foreground/10 hover:text-fill-info-foreground"
          disabled={decidir.isPending}
          onClick={() => decidir.mutate(false)}
        >
          Recusar
        </Button>
        <Button size="sm" variant="brand" className="h-7 px-3 text-xs" loading={decidir.isPending} onClick={() => decidir.mutate(true)}>
          Aceitar
        </Button>
      </div>
    </div>
  );
}
