import { Home, Menu as MenuIcon } from "lucide-react";
import { NavLink } from "react-router-dom";
import { lazy, Suspense, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { MODULES, type ModuleId } from "@/lib/modules";
import { useModuleNav } from "@/hooks/useModuleNav";
import { useBarraVisivel } from "@/hooks/useBarraVisivel";
import { usePendenciasAgentes } from "@/hooks/useEscopos";

// O Menu só abre ao toque: o painel (com conta, notificações e feedback) fica fora do carregamento inicial.
const carregarMoreSheet = () => import("@/components/MoreSheet");
const MoreSheet = lazy(() => carregarMoreSheet().then((m) => ({ default: m.MoreSheet })));

/** Ordem dos pilares na barra (SPEC 134): Início, Projetos, Obra, Gestão, Menu. */
const PILAR_ORDER: ModuleId[] = ["projetos", "obras", "gestao"];

const ITEM_CLASS =
  "relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-[26px] outline-hidden transition-[background-color,color,transform] duration-300 ease-out active:scale-95 focus-visible:ring-2 focus-visible:ring-ring";

/** Item ativo: fundo verde da marca com ícone e texto pretos; inativo: cinza. */
const itemTone = (active: boolean) => (active ? "bg-brand text-ink" : "bg-transparent text-muted-foreground");

function BottomNavItem({ active, label, children }: { active: boolean; label: string; children: ReactNode }) {
  return (
    <>
      <span className="relative flex h-6 items-center justify-center">{children}</span>
      <span className={cn("text-[10.5px] font-semibold leading-none tracking-tight", active && "text-ink")}>
        {label}
      </span>
    </>
  );
}

/**
 * Navegação mobile (< 768px, SPEC 134 sobre a spec 097 / ADR 0040): pílula flutuante
 * solta das bordas, com blur. Cinco itens, sempre nesta ordem: Início, Projetos, Obra,
 * Gestão, Menu. Os 3 pilares mantêm slot fixo mesmo sem feature liberada para a empresa
 * (decisão do ADR 0040): quem barra o acesso é o `FeatureRoute` da rota, não este
 * componente. Agentes mora no Menu, com o contador de pendências no ícone dele.
 * Some ao rolar para baixo e com o teclado aberto (`useBarraVisivel`).
 */
export function BottomNav() {
  const { routeModule, selectModule } = useModuleNav();
  const { data: pendenciasAgentes } = usePendenciasAgentes();
  const numPendenciasAgentes = pendenciasAgentes?.length ?? 0;
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuMontado, setMenuMontado] = useState(false);
  const visivel = useBarraVisivel();

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
        <nav
          aria-label="Navegação principal"
          data-visivel={visivel}
          className={cn(
            "pointer-events-auto mx-auto flex h-16 max-w-md gap-0.5 rounded-[32px] border border-ink/10 bg-background/90 p-1.5 shadow-[0_12px_32px_-10px_rgba(26,26,26,0.35)] backdrop-blur-xl transition-transform duration-300 ease-out motion-reduce:transition-none",
            visivel ? "translate-y-0" : "translate-y-[calc(100%+1.5rem)]"
          )}
        >
          <NavLink to="/inicio" className={({ isActive }) => cn(ITEM_CLASS, itemTone(isActive))}>
            {({ isActive }) => (
              <BottomNavItem active={isActive} label="Início">
                <Home size={21} strokeWidth={isActive ? 2.1 : 1.8} />
              </BottomNavItem>
            )}
          </NavLink>

          {PILAR_ORDER.map((id) => {
            const mod = MODULES[id];
            const Icon = mod.icon;
            const active = routeModule === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => selectModule(id)}
                className={cn(ITEM_CLASS, itemTone(active))}
                aria-label={mod.label}
                aria-current={active ? "page" : undefined}
              >
                <BottomNavItem active={active} label={mod.label}>
                  <Icon size={21} strokeWidth={active ? 2.1 : 1.8} />
                </BottomNavItem>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => {
              setMenuMontado(true);
              setMenuOpen(true);
            }}
            onPointerDown={() => void carregarMoreSheet()}
            className={cn(ITEM_CLASS, itemTone(menuOpen))}
            aria-label={numPendenciasAgentes > 0 ? `Menu, ${numPendenciasAgentes} pendências de agentes` : "Menu"}
            aria-haspopup="dialog"
          >
            <BottomNavItem active={menuOpen} label="Menu">
              <MenuIcon size={21} strokeWidth={menuOpen ? 2.1 : 1.8} />
              {numPendenciasAgentes > 0 && (
                <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold leading-none text-white">
                  {numPendenciasAgentes}
                </span>
              )}
            </BottomNavItem>
          </button>
        </nav>
      </div>

      {menuMontado && (
        <Suspense fallback={null}>
          <MoreSheet open={menuOpen} onOpenChange={setMenuOpen} />
        </Suspense>
      )}
    </>
  );
}
