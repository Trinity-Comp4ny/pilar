import { useNavigate } from "react-router-dom";
import { ArrowRight, Building2, FolderKanban, HardHat, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboardingProgress } from "@/hooks/useOnboardingProgress";
import { useOnboardingState } from "@/hooks/useOnboardingState";
import { analytics } from "@/lib/analytics";
import { OBJETIVOS, ehObjetivo, type Objetivo } from "@/lib/perfilEscritorio";
import { cn } from "@/lib/utils";

const ICONE: Record<Objetivo, typeof Building2> = {
  gestao: Building2,
  projetos: FolderKanban,
  obras: HardHat,
};

/**
 * Boas-vindas do Início (SPEC 149). Quem acabou de entrar vê os três pilares
 * do Pilar lado a lado, com o que escolheu em "Por onde começar" em destaque, e
 * cada cartão leva direto ao primeiro passo pendente daquele pilar. Some quando
 * a pessoa fecha, dispensa o checklist ou conclui os primeiros passos.
 */
export function CartaoBoasVindas() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { state, dispensarBoasVindas } = useOnboardingState();
  const { sections, loading, hasEmpresa } = useOnboardingProgress();

  if (!hasEmpresa || loading || state.boas_vindas_dispensada || state.dismissed || state.completed_at) return null;

  const escolhido = ehObjetivo(profile?.empresas?.objetivo_inicial) ? profile?.empresas?.objetivo_inicial : null;
  const nome = profile?.first_name?.trim();
  const empresa = profile?.empresas?.nome?.trim();
  const pilares = sections.filter((s): s is typeof s & { pilar: Objetivo } => ehObjetivo(s.pilar));
  if (pilares.length === 0) return null;

  const abrir = (pilar: Objetivo, rota: string) => {
    analytics.track("onboarding_boas_vindas_acao", { pilar, escolhido: pilar === escolhido });
    navigate(rota);
  };

  return (
    <section
      aria-label="Boas-vindas"
      className="relative rounded-3xl border border-border/60 bg-white p-5 shadow-card md:p-6"
    >
      <button
        type="button"
        onClick={() => void dispensarBoasVindas()}
        className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand/60"
        aria-label="Fechar boas-vindas"
      >
        <X size={16} />
      </button>

      <div className="max-w-2xl space-y-1 pr-8">
        <h2 className="text-lg font-semibold text-ink">
          {nome ? `Boas-vindas ao Pilar, ${nome}.` : "Boas-vindas ao Pilar."}
        </h2>
        <p className="text-sm text-ink-soft">
          {empresa ? `O ${empresa} tem` : "Seu escritório tem"} gestão, projetos e obras no mesmo lugar. Escolha um
          pilar para dar o primeiro passo; o checklist no canto da tela acompanha o resto.
        </p>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {pilares.map((sec) => {
          const info = OBJETIVOS.find((o) => o.value === sec.pilar);
          const proximo = sec.steps.find((s) => !s.done && !s.opcional) ?? sec.steps.find((s) => !s.done) ?? null;
          const Icone = ICONE[sec.pilar];
          const destaque = sec.pilar === escolhido;
          return (
            <button
              key={sec.pilar}
              type="button"
              onClick={() => abrir(sec.pilar, proximo?.rota ?? sec.steps[0]?.rota ?? "/inicio")}
              className={cn(
                "flex flex-col gap-2 rounded-2xl border p-4 text-left transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand/60",
                destaque ? "border-ink bg-paper-alt" : "border-border/60 hover:border-black/20"
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <Icone size={16} aria-hidden="true" />
                  {info?.label}
                </span>
                {destaque ? (
                  <span className="rounded-full bg-ink px-2 py-0.5 text-[11px] font-medium text-background">
                    Sua escolha
                  </span>
                ) : (
                  <span className="text-xs tabular-nums text-ink-muted">
                    {sec.done}/{sec.total}
                  </span>
                )}
              </span>
              <span className="text-sm text-ink-soft">{info?.descricao}</span>
              <span className="mt-auto flex items-center gap-1 pt-1 text-sm font-medium text-ink">
                {proximo ? proximo.titulo : "Tudo feito aqui"}
                <ArrowRight size={14} aria-hidden="true" />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
