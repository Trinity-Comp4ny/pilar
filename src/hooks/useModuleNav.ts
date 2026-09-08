import { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";
import {
  EMPRESA_ITEMS,
  MODULE_ORDER,
  MODULES,
  readUltimoModulo,
  routeToModule,
  saveUltimoModulo,
  type ModuleId,
  type ModuleMenuItem,
} from "@/lib/modules";

export interface ModuleNavEntry {
  item: ModuleMenuItem;
  nav: { disabled: boolean; title: string };
}

export interface ModuleGroup {
  label: string | null;
  entries: ModuleNavEntry[];
}

/**
 * Extraído de `AppSidebar.tsx` (spec 097): a mesma lógica que monta a sidebar
 * desktop hoje agora serve também o `BottomNav`/`ModuleChipNav` mobile, sem
 * duplicar a regra de permissão (`withNav`, `hiddenWhenLockedForUser`) em dois
 * lugares.
 */
export function useModuleNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { getNavItemProps, isAdmin, role } = usePermissions();

  const currentPath = location.pathname;
  const currentView = new URLSearchParams(location.search).get("view");

  // Módulo ativo: inferido da rota; rota transversal (/inicio, /agentes...) mantém o último usado.
  const routeModule = routeToModule(currentPath);
  const activeModule: ModuleId = routeModule ?? readUltimoModulo();

  useEffect(() => {
    if (routeModule) saveUltimoModulo(routeModule);
  }, [routeModule]);

  const navFor = (item: ModuleMenuItem) =>
    item.feature ? getNavItemProps(item.feature) : { disabled: false, title: "" };

  const withNav = (items: ModuleMenuItem[]) =>
    items
      .filter((item) => !item.adminOnly || isAdmin)
      .map((item) => ({ item, nav: navFor(item) }))
      // Feature delegável (financeiro/equipe/metas) bloqueada: "user" nunca
      // recebe concessão, então ficaria cinza pra sempre — melhor nem mostrar.
      // Coordenador continua vendo cinza até o admin conceder.
      .filter(({ item, nav }) => !(item.hiddenWhenLockedForUser && nav.disabled && role === "user"));

  const moduleItems = useMemo(
    () => withNav(MODULES[activeModule].items),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeModule, getNavItemProps, isAdmin, role]
  );

  // Agrupa itens consecutivos pelo rótulo `group`, preservando a ordem. Itens sem
  // grupo (Projetos, Obras) caem num bloco único sem cabeçalho.
  const moduleGroups = useMemo<ModuleGroup[]>(() => {
    const groups: ModuleGroup[] = [];
    for (const entry of moduleItems) {
      const label = entry.item.group ?? null;
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.entries.push(entry);
      else groups.push({ label, entries: [entry] });
    }
    return groups;
  }, [moduleItems]);

  const empresaItems = useMemo(
    () => withNav(EMPRESA_ITEMS).filter(({ nav }) => !nav.disabled),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getNavItemProps, isAdmin, role]
  );

  // Módulo some do switcher desktop se nenhuma feature dele está liberada; Obras
  // (em breve) fica sempre. O BottomNav mobile NÃO usa isto (ADR 0040): lá os 3
  // pilares ficam sempre fixos, e quem barra o acesso é o FeatureRoute da rota.
  const visibleModules = useMemo(
    () =>
      MODULE_ORDER.filter((id) => {
        const m = MODULES[id];
        if (m.emBreve) return true;
        return withNav(m.items).some(({ nav }) => !nav.disabled);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getNavItemProps, isAdmin, role]
  );

  const selectModule = (id: ModuleId, onAfterNavigate?: () => void) => {
    saveUltimoModulo(id);
    navigate(MODULES[id].homeRoute);
    onAfterNavigate?.();
  };

  return {
    currentPath,
    currentView,
    routeModule,
    activeModule,
    moduleGroups,
    empresaItems,
    visibleModules,
    selectModule,
  };
}
