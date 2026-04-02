import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart,
  Calendar,
  Home,
  Users,
  User,
  UserCircle,
  Building2,
  LogOut,
  ChevronDown,
  Wallet,
  UserPlus,
} from "lucide-react";
import {
  useSidebar,
  SidebarTrigger,
} from "@/components/ui/sidebar";
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
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const items = [
  { title: "Dashboard", url: "/dashboard", icon: Home },
  { title: "Projetos", url: "/projetos", icon: Calendar },
  { title: "Financeiro", url: "/financeiro", icon: Wallet },
  { title: "Clientes", url: "/clientes", icon: Building2 },
  { title: "Leads", url: "/leads", icon: UserPlus },
  { title: "Pessoas", url: "/pessoas", icon: Users },
  { title: "Relatórios", url: "/relatorios", icon: BarChart },
];

export function AppSidebar() {
  const { state, isMobile, openMobile, setOpenMobile } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const [sidebarWidth, setSidebarWidth] = useState(state === "collapsed" ? "64px" : "240px");
  const [userName, setUserName] = useState("Usuário");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  useEffect(() => {
    setSidebarWidth(state === "collapsed" ? "64px" : "240px");
  }, [state]);

  useEffect(() => {
    let active = true;

    const loadUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;

      if (!user) {
        const storedName = localStorage.getItem("pilar-user-name");
        if (storedName) setUserName(storedName);
        return;
      }

      setUserEmail(user.email ?? null);

      const { data: profile } = await supabase
        .from("profiles")
        .select("nome")
        .eq("id", user.id)
        .single();

      if (!active) return;

      const resolvedName =
        profile?.nome ||
        (user.user_metadata as { nome?: string } | null | undefined)?.nome ||
        localStorage.getItem("pilar-user-name") ||
        user.email ||
        "Usuário";

      setUserName(resolvedName);
      if (resolvedName && resolvedName !== "Usuário") {
        localStorage.setItem("pilar-user-name", resolvedName);
      }
    };

    loadUserData();

    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      loadUserData();
    });

    return () => {
      active = false;
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('pilar-auth');
    localStorage.removeItem('pilar-user-name');
    navigate("/login");
  };

  const handleProfile = () => {
    navigate("/profile");
  };

  const handleCompany = () => {
    navigate("/company");
  };

  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const sidebarInner = (
    <div className="flex flex-col h-full">
      {/* Logo Header com Toggle Button */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-black/5 group">
        {state !== "collapsed" ? (
          <>
            <div className="flex items-center gap-3">
              <img src="/pilar-logo.svg" alt="Pilar" className="h-7 w-7" />
              <span className="text-base font-normal tracking-tight">Pilar</span>
            </div>
            <SidebarTrigger className="text-black/70 hover:text-accent-orange hover:bg-accent-orange/5 transition-colors rounded-full h-8 w-8" />
          </>
        ) : (
          <div className="flex items-center justify-center w-full relative group">
            <div className="group-hover:opacity-0 transition-opacity">
              <img src="/pilar-logo.svg" alt="Pilar" className="h-8 w-8" />
            </div>
            <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity">
              <SidebarTrigger className="text-black/70 hover:text-accent-orange hover:bg-accent-orange/5 transition-colors rounded-full h-8 w-8" />
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {items.map((item) => {
          const isActive = currentPath === item.url;
          const Icon = item.icon;

          return (
            <NavLink
              key={item.title}
              to={item.url}
              end={item.url === "/dashboard"}
              onClick={handleNavClick}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-full text-sm transition-all duration-200 group relative",
                state === "collapsed" && "justify-center",
                isActive
                  ? "bg-accent-orange/10 text-accent-orange font-medium"
                  : "text-black/70 hover:bg-accent-orange/5 hover:text-accent-orange"
              )}
              title={state === "collapsed" ? item.title : ""}
            >
              <Icon size={18} strokeWidth={1.5} className="w-[18px] h-[18px] flex-shrink-0" />
              {state !== "collapsed" && <span className="tracking-tight">{item.title}</span>}

              {/* Tooltip para sidebar minimizada */}
              {state === "collapsed" && (
                <span className="absolute left-full ml-3 bg-black text-white text-xs py-1.5 px-3 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50 shadow-lg">
                  {item.title}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* User Menu */}
      <div className="border-t border-black/5 p-3">
        <DropdownMenu open={isUserMenuOpen} onOpenChange={setIsUserMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "group w-full flex items-center gap-3 px-3 py-2 rounded-full text-sm transition-all duration-200 hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/10",
                state === "collapsed" && "justify-center"
              )}
              type="button"
              aria-label="Menu do usuário"
              title={state === "collapsed" ? userName : ""}
            >
              <UserCircle size={18} strokeWidth={1.5} className="text-black/70 w-[18px] h-[18px] flex-shrink-0" />
              {state !== "collapsed" && (
                <>
                  <span className="flex-1 text-left text-black/70 tracking-tight">{userName}</span>
                  <ChevronDown
                    size={14}
                    className={cn(
                      "text-black/50 transition-transform duration-200",
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
                {userEmail && (
                  <span className="text-xs leading-none text-muted-foreground">{userEmail}</span>
                )}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleProfile}>
              <User size={14} className="mr-2" />
              Perfil
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleCompany}>
              <Building2 size={14} className="mr-2" />
              Empresa
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600">
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
        <SheetContent
          side="left"
          className="p-0 w-[18rem] [&>button]:hidden"
        >
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
        width: sidebarWidth
      }}
    >
      {sidebarInner}
    </div>
  );
}