import { Home, Menu as MenuIcon, Sparkles } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { MODULES, type ModuleId } from "@/lib/modules";
import { useModuleNav } from "@/hooks/useModuleNav";
import { usePendenciasAgentes } from "@/hooks/useEscopos";
import { MoreSheet } from "@/components/MoreSheet";

const PILAR_ORDER: ModuleId[] = ["gestao", "projetos", "obras"];

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

  const itemClass = (active: boolean) =>
    cn(
      "relative flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-muted-foreground",
      active && "text-ink"
    );

  return (
    <>
      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-50 flex border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <NavLink to="/inicio" className={({ isActive }) => itemClass(isActive)}>
          <Home size={20} strokeWidth={1.75} />
          <span className="text-[10px] font-medium tracking-tight">Início</span>
        </NavLink>

        <NavLink to="/agentes" className={({ isActive }) => itemClass(isActive)}>
          <span className="relative">
            <Sparkles size={20} strokeWidth={1.75} />
            {numPendenciasAgentes > 0 && (
              <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[9px] font-semibold leading-none text-ink">
                {numPendenciasAgentes}
              </span>
            )}
          </span>
          <span className="text-[10px] font-medium tracking-tight">Agentes</span>
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
              className={itemClass(active)}
              aria-label={mod.label}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={20} strokeWidth={1.75} />
              <span className="text-[10px] font-medium tracking-tight">{mod.label}</span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className={itemClass(menuOpen)}
          aria-label="Menu"
          aria-haspopup="dialog"
        >
          <MenuIcon size={20} strokeWidth={1.75} />
          <span className="text-[10px] font-medium tracking-tight">Menu</span>
        </button>
      </nav>

      <MoreSheet open={menuOpen} onOpenChange={setMenuOpen} />
    </>
  );
}
