import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart,
  Calendar,
  CalendarDays,
  FileText,
  Home,
  MapPin,
  ShieldCheck,
  Zap,
  Users,
  User,
  UserCircle,
  Building2,
  LogOut,
  ChevronDown,
  Wallet,
  UserPlus,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { useSidebar, SidebarTrigger } from "@/components/ui/sidebar";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import type { Feature } from "@/lib/permissions";
import { ImpersonationPicker } from "@/components/ImpersonationPicker";

type MenuItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  feature: Feature;
  badge?: "novo";
  adminOnly?: boolean;
};

type MenuGroup = {
  label: string;
  items: MenuItem[];
};

const menu: MenuGroup[] = [
  {
    label: "Visão",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: Home, feature: "dashboard" },
      { title: "Relatórios", url: "/relatorios", icon: BarChart, feature: "relatorios" },
    ],
  },
  {
    label: "Comercial",
    items: [
      { title: "Leads", url: "/leads", icon: UserPlus, feature: "leads" },
      { title: "Documentos", url: "/documentos", icon: FileText, feature: "propostas" },
      { title: "Clientes", url: "/clientes", icon: Building2, feature: "clientes" },
      { title: "Fornecedores", url: "/fornecedores", icon: Truck, feature: "financeiro" },
    ],
  },
  {
    label: "Operação",
    items: [
      { title: "Projetos", url: "/projetos", icon: Calendar, feature: "projetos" },
      { title: "Calendário", url: "/calendario", icon: CalendarDays, feature: "projetos" },
      { title: "Mapa", url: "/mapa", icon: MapPin, feature: "mapa" },
    ],
  },
  {
    label: "Financeiro",
    items: [{ title: "Financeiro", url: "/financeiro", icon: Wallet, feature: "financeiro" }],
  },
  {
    label: "Equipe",
    items: [{ title: "Equipe", url: "/equipe", icon: Users, feature: "pessoas", adminOnly: true }],
  },
];

export function AppSidebar() {
  const { state, isMobile, openMobile, setOpenMobile } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const { getNavItemProps, isAdmin, isUltraAdmin } = usePermissions();
  const currentPath = location.pathname;
  const [sidebarWidth, setSidebarWidth] = useState(state === "collapsed" ? "64px" : "240px");
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const USER_ROUTES = ["/profile", "/company", "/admin", "/ultra-admin", "/billing"];
  const isUserRouteActive = USER_ROUTES.some((r) => currentPath.startsWith(r));

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
    navigate("/profile");
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

  const visibleGroups = useMemo(
    () =>
      menu
        .map((group) => ({
          ...group,
          items: group.items
            .filter((item) => !item.adminOnly || isAdmin)
            .map((item) => ({ item, nav: getNavItemProps(item.feature) })),
        }))
        .filter((group) => group.items.some(({ nav }) => !nav.disabled)),
    [getNavItemProps, isAdmin]
  );

  const renderItem = (item: MenuItem, navProps: { disabled: boolean; title: string }) => {
    const isActive = currentPath === item.url;
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
        end={item.url === "/dashboard"}
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
              <span className="text-[10px] font-medium tracking-wide uppercase px-1.5 py-0.5 rounded-full bg-brand/10 text-brand">
                Novo
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
      <div className="flex items-center justify-between h-16 px-4 border-b border-black/5 group">
        {!collapsed ? (
          <>
            <div className="flex items-center gap-3">
              <img src="/pilar-logo.svg" alt="Pilar" className="h-7 w-7" />
              <span className="text-base font-normal tracking-tight">
                Pilar<sup className="text-[8px] font-normal text-ink-disabled ml-0.5 relative -top-2">®</sup>
              </span>
            </div>
            <SidebarTrigger className="text-black/70 hover:text-brand hover:bg-brand/5 transition-colors rounded-full h-8 w-8" />
          </>
        ) : (
          <div className="flex items-center justify-center w-full relative group">
            <div className="group-hover:opacity-0 transition-opacity">
              <img src="/pilar-logo.svg" alt="Pilar" className="h-8 w-8" />
            </div>
            <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity">
              <SidebarTrigger className="text-black/70 hover:text-brand hover:bg-brand/5 transition-colors rounded-full h-8 w-8" />
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 overflow-y-auto">
        {visibleGroups.map((group, groupIdx) => (
          <div key={group.label} className={cn(groupIdx > 0 && (collapsed ? "mt-3" : "mt-5"))}>
            {!collapsed && (
              <div className="px-3 mb-1.5 text-[10px] font-medium tracking-[0.08em] uppercase text-black/40">
                {group.label}
              </div>
            )}
            <div className="space-y-1">{group.items.map(({ item, nav }) => renderItem(item, nav))}</div>
          </div>
        ))}
      </nav>

      {/* User Menu */}
      <div className="border-t border-black/5 p-3">
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
          <DropdownMenuContent align="end" side="top" className="min-w-[220px]">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <span className="text-sm font-medium leading-none">{userName}</span>
                {userEmail && <span className="text-xs leading-none text-muted-foreground">{userEmail}</span>}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleProfile}>
              <User size={14} className="mr-2" />
              Perfil
            </DropdownMenuItem>
            {isAdmin && !isUltraAdmin && (
              <DropdownMenuItem onClick={handleAdmin}>
                <ShieldCheck size={14} className="mr-2" />
                Portal Admin
              </DropdownMenuItem>
            )}
            {isUltraAdmin && (
              <DropdownMenuItem onClick={handleUltraAdmin}>
                <Zap size={14} className="mr-2" />
                Portal Ultra
              </DropdownMenuItem>
            )}
            <ImpersonationPicker />
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
              <LogOut size={14} className="mr-2" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
