import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Cookie } from "lucide-react";
import { applyCookieConsent } from "../analytics";
import { hasCookieDecision, CONSENT_REVIEW_REQUESTED_EVENT } from "../cookieConsent";

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
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white p-4 shadow-[0_-4px_24px_-4px_rgba(0,0,0,0.1)] sm:p-5">
      <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Cookie className="mt-0.5 h-5 w-5 shrink-0 text-ink-soft" strokeWidth={1.5} />
          <p className="text-sm text-ink-soft leading-relaxed font-light">
            Usamos cookies essenciais para o site funcionar e, com sua permissão, cookies de análise para entender o uso
            da página. Veja a{" "}
            <Link to="/privacidade" className="text-ink underline underline-offset-2">
              política de privacidade
            </Link>
            .
          </p>
        </div>
        <div className="flex shrink-0 gap-2 sm:ml-4">
          <button
            type="button"
            onClick={() => decide(false)}
            className="px-4 py-2 rounded-full font-medium text-sm border border-ink/15 text-ink-soft hover:bg-slate-50 transition-colors"
          >
            Recusar não essenciais
          </button>
          <button
            type="button"
            onClick={() => decide(true)}
            className="px-4 py-2 rounded-full font-medium text-sm bg-brand text-ink hover:bg-brand/80 transition-colors"
          >
            Aceitar todos
          </button>
        </div>
      </div>
    </div>
  );
}
