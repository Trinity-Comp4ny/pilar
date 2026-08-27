import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Cookie } from "lucide-react";
import { applyCookieConsent } from "../analytics";
import { getCookieConsent, hasCookieDecision, CONSENT_REVIEW_REQUESTED_EVENT } from "../cookieConsent";

/**
 * Alternador on/off pra uma categoria de cookie. Essencial não usa isso (é
 * sempre ligado, sem escolha); só "Análise" tem estado pra alternar.
 */
function Alternador({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
        checked ? "bg-brand" : "bg-ink/15"
      }`}
    >
      <span
        className="inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform"
        style={{ transform: checked ? "translateX(18px)" : "translateX(3px)" }}
      />
    </button>
  );
}

/**
 * Banner de cookies com três saídas: aceitar tudo, recusar o não essencial, e
 * personalizar (expande o próprio banner em vez de abrir outro componente).
 *
 * O link "Preferências de cookies" do rodapé reabre isso já expandido, com o
 * alternador refletindo a escolha salva: editar a decisão tem que ser tão
 * fácil quanto dar a decisão pela primeira vez.
 */
export function CookieConsentBanner() {
  const [visible, setVisible] = useState(() => !hasCookieDecision());
  const [expandido, setExpandido] = useState(false);
  const [analytics, setAnalytics] = useState(() => getCookieConsent()?.analytics ?? false);

  useEffect(() => {
    const onReviewRequested = () => {
      setAnalytics(getCookieConsent()?.analytics ?? false);
      setExpandido(true);
      setVisible(true);
    };
    window.addEventListener(CONSENT_REVIEW_REQUESTED_EVENT, onReviewRequested);
    return () => window.removeEventListener(CONSENT_REVIEW_REQUESTED_EVENT, onReviewRequested);
  }, []);

  if (!visible) return null;

  const decidir = (aceitouAnalytics: boolean) => {
    applyCookieConsent(aceitouAnalytics);
    setVisible(false);
    setExpandido(false);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-paper-border bg-frame p-4 shadow-[0_-4px_24px_-4px_rgba(0,0,0,0.1)] sm:p-5">
      <div className="mx-auto flex max-w-4xl flex-col gap-4">
        <div className="flex items-start gap-3">
          <Cookie className="mt-0.5 h-5 w-5 shrink-0 text-ink-soft" strokeWidth={1.5} />
          <p className="text-sm leading-relaxed font-light text-ink-soft">
            Usamos cookies essenciais para o site funcionar e, com sua permissão, cookies de análise para entender o uso
            da página. Veja a{" "}
            <Link to="/privacidade" className="text-ink underline underline-offset-2">
              política de privacidade
            </Link>
            .
          </p>
        </div>

        <div className="flex flex-col gap-4 border-t border-paper-border pt-4 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
          {expandido ? (
            <div className="flex flex-wrap items-center gap-x-7 gap-y-3">
              <span className="flex items-center gap-2.5">
                <span className="text-sm font-medium text-ink">Essenciais</span>
                <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">Sempre ativo</span>
              </span>
              <span className="flex items-center gap-2.5">
                <span className="text-sm font-medium text-ink">Análise</span>
                <Alternador checked={analytics} onChange={setAnalytics} label="Cookies de análise" />
              </span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setExpandido(true)}
              className="self-start text-sm font-medium text-ink-soft underline decoration-ink/20 underline-offset-2 transition-colors hover:text-ink lg:self-auto"
            >
              Personalizar
            </button>
          )}

          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={() => decidir(false)}
              className="rounded-full border border-ink/15 px-4 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-paper-alt"
            >
              Recusar não essenciais
            </button>
            {expandido ? (
              <button
                type="button"
                onClick={() => decidir(analytics)}
                className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-brand/80"
              >
                Salvar preferências
              </button>
            ) : (
              <button
                type="button"
                onClick={() => decidir(true)}
                className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-brand/80"
              >
                Aceitar todos
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
