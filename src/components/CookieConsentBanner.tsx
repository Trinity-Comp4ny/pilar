import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";
import { applyCookieConsent } from "@/lib/analytics";
import { hasCookieDecision, CONSENT_REVIEW_REQUESTED_EVENT } from "@/lib/cookieConsent";

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(() => !hasCookieDecision());

  useEffect(() => {
    const onReviewRequested = () => setVisible(true);
    window.addEventListener(CONSENT_REVIEW_REQUESTED_EVENT, onReviewRequested);
    return () => window.removeEventListener(CONSENT_REVIEW_REQUESTED_EVENT, onReviewRequested);
  }, []);

  if (!visible) return null;

  const decide = (accepted: boolean) => {
    applyCookieConsent(accepted);
    setVisible(false);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border-default bg-surface-card p-4 shadow-elegant sm:p-5">
      <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Cookie className="mt-0.5 h-5 w-5 shrink-0 text-ink-soft" strokeWidth={1.5} />
          <p className="text-sm text-ink-soft leading-relaxed">
            Usamos cookies essenciais para o funcionamento do Pilar e, com sua permissão, cookies de análise para
            entender o uso do produto. Veja a{" "}
            <Link to="/privacidade" className="text-ink underline underline-offset-2">
              política de privacidade
            </Link>
            .
          </p>
        </div>
        <div className="flex shrink-0 gap-2 sm:ml-4">
          <Button variant="outline" size="sm" onClick={() => decide(false)}>
            Recusar não essenciais
          </Button>
          <Button variant="brand" size="sm" onClick={() => decide(true)}>
            Aceitar todos
          </Button>
        </div>
      </div>
    </div>
  );
}
