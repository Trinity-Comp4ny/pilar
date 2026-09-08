import { useEffect, useRef } from "react";
import { NavLink } from "react-router-dom";
import { useModuleNav, type ModuleGroup } from "@/hooks/useModuleNav";
import { cn } from "@/lib/utils";

/**
 * Faixa de chips horizontal com as telas do módulo ativo (spec 097 / ADR 0040):
 * a versão mobile da sidebar desktop, montada por `PageLayout` para todas as
 * páginas de uma vez (evita tocar em ~14 páginas individualmente). Reaproveita
 * `useModuleNav` — o mesmo hook que já decide os itens/grupos da sidebar.
 *
 * Se auto-oculta em duas situações: acima do breakpoint mobile (a sidebar
 * desktop já mostra os mesmos itens em lista) e em rotas transversais sem
 * módulo (`/inicio`, `/agentes`, `/admin`), onde não existe faixa de chips.
 */
export function ModuleChipNav() {
  const { routeModule, currentPath, currentView, moduleGroups } = useModuleNav();
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLAnchorElement>(null);

  // O chip ativo pode nascer fora da área visível do scroll horizontal (ex.:
  // entrando direto numa rota no fim do grupo) — sem isso, ele aparece cortado
  // na borda em vez de centralizado (achado da auditoria mobile).
  // `scrollIntoView` teria sido mais simples, mas ele sobe a árvore de
  // ancestrais scrolláveis (inclusive um com `overflow: hidden`, que ainda
  // aceita scroll programático mesmo sem esconder barra) e rola qualquer um
  // deles — foi assim que uma tela inteira apareceu deslocada horizontalmente
  // sem nenhum scroll real do usuário (achado da auditoria mobile). Calcular
  // e aplicar o `scrollLeft` direto no container certo evita esse vazamento.
  useEffect(() => {
    const container = containerRef.current;
    const active = activeRef.current;
    if (!container || !active) return;
    const containerRect = container.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    const activeCenter = activeRect.left - containerRect.left + container.scrollLeft + activeRect.width / 2;
    container.scrollLeft = activeCenter - container.clientWidth / 2;
  }, [currentPath, currentView]);

  if (!routeModule) return null;

  return (
    <div
      ref={containerRef}
      className="flex gap-1.5 overflow-x-auto px-4 pb-2 pt-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden md:hidden"
    >
      {moduleGroups.map((group, i) => (
        <ModuleChipGroup
          key={group.label ?? `grupo-${i}`}
          group={group}
          showSeparatorBefore={i > 0}
          currentPath={currentPath}
          currentView={currentView}
          activeRef={activeRef}
        />
      ))}
    </div>
  );
}

function ModuleChipGroup({
  group,
  showSeparatorBefore,
  currentPath,
  currentView,
  activeRef,
}: {
  group: ModuleGroup;
  showSeparatorBefore: boolean;
  currentPath: string;
  currentView: string | null;
  activeRef: React.RefObject<HTMLAnchorElement>;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {showSeparatorBefore && <span className="mx-0.5 h-4 w-px shrink-0 bg-border" aria-hidden />}
      {group.entries.map(({ item, nav }) => {
        const [itemPath, itemQuery] = item.url.split("?");
        const itemView = itemQuery ? new URLSearchParams(itemQuery).get("view") : null;
        const isActive = currentPath === itemPath && currentView === itemView;

        if (nav.disabled) {
          return (
            <span
              key={item.title}
              title={nav.title || item.title}
              aria-disabled
              className="shrink-0 cursor-not-allowed rounded-full px-3 py-1.5 text-sm text-muted-foreground opacity-40"
            >
              {item.title}
            </span>
          );
        }

        return (
          <NavLink
            key={item.title}
            ref={isActive ? activeRef : undefined}
            to={item.url}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              isActive ? "bg-brand text-ink" : "bg-muted text-muted-foreground hover:text-ink"
            )}
          >
            {item.title}
          </NavLink>
        );
      })}
    </div>
  );
}
