import { Home, Menu as MenuIcon, Sparkles } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { MODULES, type ModuleId } from "@/lib/modules";
import { useModuleNav } from "@/hooks/useModuleNav";
import { usePendenciasAgentes } from "@/hooks/useEscopos";
import { MoreSheet } from "@/components/MoreSheet";

const PILAR_ORDER: ModuleId[] = ["gestao", "projetos", "obras"];

/** Ícone com pill de fundo (verde quando ativo, a única cor de destaque —
 * nunca como cor de texto, regra do design system: "verde só como fundo").
 * A transição de cor/escala em todos os estados é o que dá vida à troca de
 * aba, sem precisar de lib de animação nova. */
function BottomNavPill({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <span
      className={cn(
        "flex items-center justify-center rounded-full px-3.5 py-1 transition-all duration-300 ease-out",
        active ? "bg-brand text-ink" : "bg-transparent text-muted-foreground"
      )}
    >
      {children}
    </span>
  );
}

function BottomNavLabel({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <span
      className={cn(
        "text-[10px] font-semibold tracking-tight transition-colors duration-300",
        active ? "text-ink" : "text-muted-foreground"
      )}
    >
      {children}
    </span>
  );
}

const ITEM_CLASS =
  "flex flex-1 flex-col items-center justify-center gap-1 py-1.5 outline-none transition-transform duration-150 active:scale-90 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2";

/**
 * Navegação mobile (< 768px, spec 097 / ADR 0040): substitui o drawer da
 * sidebar. Barra fixa de 6 itens, sempre nesta ordem: Início, Agentes, Gestão,
 * Projetos, Obra, Menu. Os 3 pilares mantêm slot fixo mesmo sem feature
 * liberada para a empresa (decisão do ADR 0040) — quem barra o acesso é o
 * `FeatureRoute` da rota, não este componente.
 */
export function BottomNav() {
  const { routeModule, selectModule } = useModuleNav();
  const { data: pendenciasAgentes } = usePendenciasAgentes();
  const numPendenciasAgentes = pendenciasAgentes?.length ?? 0;
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-50 flex rounded-t-2xl border-t bg-background pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_20px_-4px_rgba(0,0,0,0.08)] md:hidden"
      >
        <NavLink to="/inicio" className={ITEM_CLASS}>
          {({ isActive }) => (
            <>
              <BottomNavPill active={isActive}>
                <Home size={20} strokeWidth={isActive ? 2 : 1.75} />
              </BottomNavPill>
              <BottomNavLabel active={isActive}>Início</BottomNavLabel>
            </>
          )}
        </NavLink>

        <NavLink to="/agentes" className={ITEM_CLASS}>
          {({ isActive }) => (
            <>
              <span className="relative">
                <BottomNavPill active={isActive}>
                  <Sparkles size={20} strokeWidth={isActive ? 2 : 1.75} />
                </BottomNavPill>
                {numPendenciasAgentes > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 animate-pulse items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold leading-none text-white">
                    {numPendenciasAgentes}
                  </span>
                )}
              </span>
              <BottomNavLabel active={isActive}>Agentes</BottomNavLabel>
            </>
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
              className={ITEM_CLASS}
              aria-label={mod.label}
              aria-current={active ? "page" : undefined}
            >
              <BottomNavPill active={active}>
                <Icon size={20} strokeWidth={active ? 2 : 1.75} />
              </BottomNavPill>
              <BottomNavLabel active={active}>{mod.label}</BottomNavLabel>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className={ITEM_CLASS}
          aria-label="Menu"
          aria-haspopup="dialog"
        >
          <BottomNavPill active={menuOpen}>
            <MenuIcon size={20} strokeWidth={menuOpen ? 2 : 1.75} />
          </BottomNavPill>
          <BottomNavLabel active={menuOpen}>Menu</BottomNavLabel>
        </button>
      </nav>

      <MoreSheet open={menuOpen} onOpenChange={setMenuOpen} />
    </>
  );
}
