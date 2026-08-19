import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Home,
  ShieldCheck,
  Zap,
  UserCircle,
  LogOut,
  ChevronDown,
  Check,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  MessageSquare,
} from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSettingsModal } from "@/contexts/SettingsModalContext";
import { FeedbackDialog } from "@/components/FeedbackDialog";
import { usePermissions } from "@/hooks/usePermissions";
import { ImpersonationPicker } from "@/components/ImpersonationPicker";
import { NotificationInbox } from "@/components/NotificationInbox";
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

// Shell dos 3 pilares (spec 001-shell-3-pilares): o menu vem do mapa central de
// módulos. O switcher é apresentação; autorização continua em usePermissions.
type MenuItem = ModuleMenuItem;

export function AppSidebar() {
  const { state, isMobile, openMobile, setOpenMobile, toggleSidebar } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const { openSettings, isOpen: isSettingsOpen } = useSettingsModal();
  const { getNavItemProps, isAdmin, isUltraAdmin } = usePermissions();
  const currentPath = location.pathname;
  const [sidebarWidth, setSidebarWidth] = useState(state === "collapsed" ? "64px" : "240px");
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const USER_ROUTES = ["/admin", "/ultra-admin"];
  const isUserRouteActive = USER_ROUTES.some((r) => currentPath.startsWith(r)) || isSettingsOpen;

  const userName = profile
    ? [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() || user?.email || "Usuário"
    : (user?.user_metadata as { nome?: string } | null | undefined)?.nome || user?.email || "Usuário";

  const userEmail = user?.email ?? null;
  const collapsed = state === "collapsed";

  useEffect(() => {
    setSidebarWidth(collapsed ? "64px" : "240px");
  }, [collapsed]);

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const handleProfile = () => {
    openSettings("conta");
  };

  const handleAdmin = () => {
    navigate("/admin");
  };

  const handleUltraAdmin = () => {
    navigate("/ultra-admin");
  };

  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  // Módulo ativo: inferido da rota; rota transversal (/inicio, /agentes...) mantém o último usado.
  const routeModule = routeToModule(currentPath);
  const activeModule: ModuleId = routeModule ?? readUltimoModulo();

  useEffect(() => {
    if (routeModule) saveUltimoModulo(routeModule);
  }, [routeModule]);

  const navFor = (item: ModuleMenuItem) =>
    item.feature ? getNavItemProps(item.feature) : { disabled: false, title: "" };

  const withNav = (items: ModuleMenuItem[]) =>
    items.filter((item) => !item.adminOnly || isAdmin).map((item) => ({ item, nav: navFor(item) }));

  const moduleItems = useMemo(
    () => withNav(MODULES[activeModule].items),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeModule, getNavItemProps, isAdmin]
  );

  // Agrupa itens consecutivos pelo rótulo `group`, preservando a ordem. Itens sem
  // grupo (Projetos, Obras) caem num bloco único sem cabeçalho.
  const moduleGroups = useMemo(() => {
    const groups: { label: string | null; entries: typeof moduleItems }[] = [];
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
    [getNavItemProps, isAdmin]
  );

  // Módulo some do switcher se nenhuma feature dele está liberada; Obras (em breve) fica sempre.
  const visibleModules = useMemo(
    () =>
      MODULE_ORDER.filter((id) => {
        const m = MODULES[id];
        if (m.emBreve) return true;
        return withNav(m.items).some(({ nav }) => !nav.disabled);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getNavItemProps, isAdmin]
  );

  const selectModule = (id: ModuleId) => {
    saveUltimoModulo(id);
    navigate(MODULES[id].homeRoute);
    if (isMobile) setOpenMobile(false);
  };

  // View ativa da URL (?view=), usada para distinguir as lentes de /projetos na sidebar.
  const currentView = new URLSearchParams(location.search).get("view");

  const renderItem = (item: MenuItem, navProps: { disabled: boolean; title: string }) => {
    const [itemPath, itemQuery] = item.url.split("?");
    const itemView = itemQuery ? new URLSearchParams(itemQuery).get("view") : null;
    const isActive = currentPath === itemPath && currentView === itemView;
    const Icon = item.icon;

    if (navProps.disabled) {
      const tooltip = navProps.title || item.title;
      return (
        <span
          key={item.title}
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-full text-sm group relative cursor-not-allowed opacity-40",
            collapsed && "justify-center"
          )}
          title={tooltip}
          aria-disabled
        >
          <Icon size={18} strokeWidth={1.5} className="w-[18px] h-[18px] flex-shrink-0" />
          {!collapsed && <span className="tracking-tight">{item.title}</span>}
          {collapsed && (
            <span className="absolute left-full ml-3 bg-black text-white text-xs py-1.5 px-3 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50 shadow-lg">
              {tooltip}
            </span>
          )}
        </span>
      );
    }

    return (
      <NavLink
        key={item.title}
        to={item.url}
        end={false}
        onClick={handleNavClick}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-full text-sm transition-all duration-200 group relative",
          collapsed && "justify-center",
          isActive ? "bg-brand text-black/80 font-medium" : "text-black/70 hover:bg-brand/30"
        )}
        title={collapsed ? item.title : ""}
      >
        <Icon size={18} strokeWidth={1.5} className="w-[18px] h-[18px] flex-shrink-0" />
        {!collapsed && (
          <>
            <span className="tracking-tight flex-1">{item.title}</span>
            {item.badge === "novo" && (
              <span className="text-[10px] leading-none font-medium tracking-wide uppercase px-1.5 py-0.5 rounded-full bg-brand text-ink">
                Novo
              </span>
            )}
            {item.badge === "em breve" && (
              <span className="text-[10px] leading-none font-medium tracking-wide uppercase px-1.5 py-0.5 rounded-full bg-black/5 text-black/50">
                Em breve
              </span>
            )}
          </>
        )}

        {collapsed && (
          <>
            {item.badge === "novo" && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-brand" />}
            <span className="absolute left-full ml-3 bg-black text-white text-xs py-1.5 px-3 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50 shadow-lg">
              {item.title}
            </span>
          </>
        )}
      </NavLink>
    );
  };

  const sidebarInner = (
    <div className="flex flex-col h-full">
      {/* Logo Header com Toggle Button */}
      <div className="flex items-center justify-between h-16 px-4 group">
        {!collapsed ? (
          <>
            <div className="flex items-center gap-3">
              <img src="/pilar-logo.svg" alt="Pilar" className="h-7 w-7" />
              <span className="text-base font-normal tracking-tight">
                Pilar<sup className="text-[8px] font-normal text-ink-disabled ml-0.5 relative -top-2">®</sup>
              </span>
            </div>
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label="Recolher menu"
              className="flex items-center justify-center h-8 w-8 rounded-lg text-ink-soft hover:text-ink hover:bg-black/[0.04] active:scale-95 transition-all duration-200"
            >
              <PanelLeftClose size={18} strokeWidth={1.5} />
            </button>
          </>
        ) : (
          <div className="flex items-center justify-center w-full relative group">
            <div className="group-hover:opacity-0 transition-opacity">
              <img src="/pilar-logo.svg" alt="Pilar" className="h-8 w-8" />
            </div>
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label="Expandir menu"
              className="absolute flex items-center justify-center h-8 w-8 rounded-lg text-ink-soft hover:text-ink hover:bg-black/[0.04] active:scale-95 opacity-0 group-hover:opacity-100 transition-all duration-200"
            >
              <PanelLeftOpen size={18} strokeWidth={1.5} />
            </button>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {/* Switcher de módulo (apresentação; autorização é dos gates) */}
        <div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Trocar de módulo"
                className={cn(
                  "w-full flex items-center gap-2.5 rounded-full border border-black/10 bg-black/[0.03] px-3 py-2 text-sm font-medium text-ink hover:bg-black/[0.06] transition-colors",
                  collapsed && "justify-center px-0"
                )}
                title={collapsed ? MODULES[activeModule].label : ""}
              >
                {(() => {
                  const ActiveIcon = MODULES[activeModule].icon;
                  return <ActiveIcon size={16} strokeWidth={1.6} className="flex-shrink-0" />;
                })()}
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left tracking-tight">{MODULES[activeModule].label}</span>
                    <ChevronDown size={14} className="text-black/40" />
                  </>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[200px]">
              {visibleModules.map((id) => {
                const m = MODULES[id];
                const MIcon = m.icon;
                return (
                  <DropdownMenuItem key={id} onClick={() => selectModule(id)}>
                    <MIcon size={14} className="mr-2" />
                    <span className="flex-1">{m.label}</span>
                    {id === activeModule && <Check size={14} className="text-ink" />}
                    {m.emBreve && id !== activeModule && (
                      <span className="text-[9px] font-medium uppercase tracking-wide rounded-full bg-black/5 text-black/50 px-1.5 py-0.5">
                        em breve
                      </span>
                    )}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Transversais: Início + Agentes, abaixo do switcher */}
        <div className="mt-3 space-y-1">
          <NavLink
            to="/inicio"
            onClick={handleNavClick}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-full text-sm transition-all duration-200",
              collapsed && "justify-center",
              currentPath === "/inicio" ? "bg-brand text-black/80 font-medium" : "text-black/70 hover:bg-brand/30"
            )}
            title={collapsed ? "Início" : ""}
          >
            <Home size={18} strokeWidth={1.5} className="w-[18px] h-[18px] flex-shrink-0" />
            {!collapsed && <span className="tracking-tight">Início</span>}
          </NavLink>
          {empresaItems.map(({ item, nav }) => renderItem(item, nav))}
        </div>

        {/* Itens do módulo ativo, agrupados por seção (Comercial/Financeiro/Empresa) */}
        <div className="mt-3 space-y-3">
          {moduleGroups.map((group, i) => (
            <div key={group.label ?? `grupo-${i}`} className="space-y-1">
              {group.label && !collapsed && (
                <p className="px-3 pt-1 text-[10px] font-medium uppercase tracking-wider text-black/35">
                  {group.label}
                </p>
              )}
              {group.entries.map(({ item, nav }) => renderItem(item, nav))}
            </div>
          ))}
        </div>
      </nav>

      {/* User Menu + sino de notificações */}
      <div className="border-t border-black/5 p-3">
        <div className={cn("flex items-center gap-1", collapsed && "flex-col gap-2")}>
          <div className="min-w-0 flex-1">
            <DropdownMenu open={isUserMenuOpen} onOpenChange={setIsUserMenuOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "group w-full flex items-center gap-3 px-3 py-2 rounded-full text-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/10",
                    collapsed && "justify-center",
                    isUserRouteActive ? "bg-brand text-black/80 font-medium" : "hover:bg-brand/30"
                  )}
                  type="button"
                  aria-label="Menu do usuário"
                  title={collapsed ? userName : ""}
                >
                  <UserCircle size={18} strokeWidth={1.5} className="text-black/70 w-[18px] h-[18px] flex-shrink-0" />
                  {!collapsed && (
                    <>
                      <div className="flex-1 text-left min-w-0">
                        <p className="text-sm font-medium text-black/70 tracking-tight truncate leading-tight">
                          {userName}
                        </p>
                        {userEmail && <p className="text-xs text-black/40 truncate leading-tight">{userEmail}</p>}
                      </div>
                      <ChevronDown
                        size={14}
                        className={cn(
                          "text-black/50 transition-transform duration-200 flex-shrink-0",
                          isUserMenuOpen && "rotate-180"
                        )}
                      />
                    </>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top" sideOffset={8} alignOffset={8} className="min-w-[240px]">
                {/* Cabeçalho clicável: nome + email abrem as configurações; engrenagem à direita reforça a ação. */}
                <DropdownMenuItem onClick={handleProfile} className="cursor-pointer gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold leading-tight text-ink">{userName}</p>
                    {userEmail && <p className="truncate text-xs leading-tight text-muted-foreground">{userEmail}</p>}
                  </div>
                  <Settings size={16} className="flex-shrink-0 text-muted-foreground" />
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setFeedbackOpen(true)} className="justify-between">
                  Feedback
                  <MessageSquare size={16} className="text-muted-foreground" />
                </DropdownMenuItem>
                {isAdmin && !isUltraAdmin && (
                  <DropdownMenuItem onClick={handleAdmin} className="justify-between">
                    Portal Admin
                    <ShieldCheck size={16} className="text-muted-foreground" />
                  </DropdownMenuItem>
                )}
                {isUltraAdmin && (
                  <DropdownMenuItem onClick={handleUltraAdmin} className="justify-between">
                    Portal Ultra
                    <Zap size={16} className="text-muted-foreground" />
                  </DropdownMenuItem>
                )}
                <ImpersonationPicker />
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="justify-between text-destructive focus:text-destructive"
                >
                  Log out
                  <LogOut size={16} />
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
          </div>
          <NotificationInbox />
        </div>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile}>
        <SheetContent side="left" className="p-0 w-[18rem] [&>button]:hidden">
          <div className="h-full border-r border-black/5 bg-white">{sidebarInner}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <div
      className="h-screen border-r border-black/5 bg-white fixed left-0 top-0 z-50"
      style={{
        minWidth: sidebarWidth,
        width: sidebarWidth,
      }}
    >
      {sidebarInner}
    </div>
  );
}
