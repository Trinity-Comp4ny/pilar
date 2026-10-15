import { NavLink, useNavigate } from "react-router-dom";
import {
  Home,
  ShieldCheck,
  Zap,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  MessageSquare,
  Eye,
  EyeOff,
} from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { Logo } from "@/components/Logo";
import { AvatarStack } from "@/components/AvatarStack";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSettingsModal } from "@/contexts/SettingsModalContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useValoresOcultos } from "@/contexts/ValoresOcultosContext";
import { ImpersonationPicker } from "@/components/ImpersonationPicker";
import { NotificationInbox } from "@/components/NotificationInbox";
import { FeedbackDialog } from "@/components/FeedbackDialog";
import { usePendenciasAgentes } from "@/hooks/useEscopos";
import { useModuleNav } from "@/hooks/useModuleNav";
import { MODULES, type ModuleId, type ModuleMenuItem } from "@/lib/modules";
import { PANEL_WIDTH, RAIL_WIDTH } from "@/lib/shellLayout";
import { ULTRA_ADMIN_BASE, ULTRA_SECOES, isUltraAdminPath, ultraSecaoAtiva } from "@/lib/ultraAdminNav";
import { useFeedbackNovosCount } from "@/hooks/useFeedbackNovosCount";

// Shell dos 3 pilares (spec 001-shell-3-pilares): o menu vem do mapa central de
// módulos. Desktop em duas colunas: trilho fixo à esquerda (Início, módulos,
// Agentes, sino e conta), sempre visível, e painel com os itens do módulo ativo,
// recolhível (⌘B). O trilho é apresentação; autorização continua em usePermissions.
// Em mobile (< 768px), esta sidebar não renderiza mais nada: a navegação vira
// `<BottomNav />` + `<ModuleChipNav />` (spec 097 / ADR 0040), montados direto no
// shell (`Layout.tsx`/`PageLayout.tsx`). `useModuleNav` é o hook compartilhado
// entre a sidebar desktop e os dois componentes mobile.
type MenuItem = ModuleMenuItem;

export function AppSidebar() {
  const { state, isMobile, toggleSidebar, setOpen } = useSidebar();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const { openSettings, isOpen: isSettingsOpen } = useSettingsModal();
  // Contador de pendências de agente no item "Agentes" (spec 084) — sem isso, o trabalho
  // dos agentes proativos (ex. guardião de margem) fica invisível pra quem não abre /agentes.
  const { data: pendenciasAgentes } = usePendenciasAgentes();
  const numPendenciasAgentes = pendenciasAgentes?.length ?? 0;
  const { ocultos: valoresOcultos, toggle: toggleValoresOcultos } = useValoresOcultos();
  const {
    currentPath,
    currentView,
    routeModule,
    activeModule,
    moduleGroups,
    empresaItems,
    visibleModules,
    selectModule,
  } = useModuleNav();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const isUserRouteActive = currentPath.startsWith("/admin") || isSettingsOpen;

  const userName = profile
    ? [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() || user?.email || "Usuário"
    : (user?.user_metadata as { nome?: string } | null | undefined)?.nome || user?.email || "Usuário";

  const userEmail = user?.email ?? null;
  const collapsed = state === "collapsed";
  const { isAdmin, isUltraAdmin } = usePermissions();
  // Portal ultra admin (SPEC 117): item próprio no trilho e, dentro dele, o
  // painel troca os itens do módulo pelas seções do portal.
  const onUltra = isUltraAdmin && isUltraAdminPath(currentPath);
  const ultraAtiva = onUltra ? ultraSecaoAtiva(currentPath) : null;
  const { data: feedbackNovos = 0 } = useFeedbackNovosCount(isUltraAdmin);

  // Trocar de módulo pelo trilho abre o painel: quem clica quer ver os itens dele.
  const handleSelectModule = (id: ModuleId) => {
    if (collapsed) setOpen(true);
    selectModule(id);
  };

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

  const renderItem = (item: MenuItem, navProps: { disabled: boolean; title: string }) => {
    const [itemPath, itemQuery] = item.url.split("?");
    const itemView = itemQuery ? new URLSearchParams(itemQuery).get("view") : null;
    const isActive = currentPath === itemPath && currentView === itemView;
    const Icon = item.icon;

    if (navProps.disabled) {
      return (
        <span
          key={item.title}
          className="flex items-center gap-3 px-3 py-2 rounded-full text-sm cursor-not-allowed opacity-40"
          title={navProps.title || item.title}
          aria-disabled
        >
          <Icon size={18} strokeWidth={1.5} className="w-[18px] h-[18px] shrink-0" />
          <span className="tracking-tight">{item.title}</span>
        </span>
      );
    }

    return (
      <NavLink
        key={item.title}
        to={item.url}
        end={false}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-full text-sm transition-all duration-200",
          isActive ? "bg-brand text-black/80 font-medium" : "text-black/70 hover:bg-brand/30"
        )}
      >
        <Icon size={18} strokeWidth={1.5} className="w-[18px] h-[18px] shrink-0" />
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
      </NavLink>
    );
  };

  const railItemClass = (active: boolean) =>
    cn(
      "group flex w-14 flex-col items-center gap-1 rounded-xl py-1 text-[10.5px] leading-none tracking-tight transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-black/10",
      active ? "font-medium text-ink" : "text-black/60 hover:text-ink"
    );
  const railIconClass = (active: boolean) =>
    cn(
      "relative flex h-8 w-10 items-center justify-center rounded-full transition-colors",
      active ? "bg-brand text-black/80" : "group-hover:bg-brand/30"
    );

  const rail = (
    <div
      className="flex h-full flex-col items-center border-r border-black/5 bg-muted/50 pt-3 pb-3"
      style={{ width: RAIL_WIDTH }}
    >
      {/* Com o painel recolhido, o botão de expandir mora no topo do trilho */}
      {collapsed && (
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label="Expandir menu"
          title="Expandir menu"
          className="mb-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-soft transition-all duration-200 hover:bg-black/4 hover:text-ink active:scale-95"
        >
          <PanelLeftOpen size={18} strokeWidth={1.5} />
        </button>
      )}

      <nav
        aria-label="Módulos"
        className="flex w-full flex-1 flex-col items-center gap-2 overflow-y-auto scrollbar-none"
      >
        <NavLink
          to="/inicio"
          className={railItemClass(currentPath === "/inicio")}
          aria-current={currentPath === "/inicio" ? "page" : undefined}
        >
          <span className={railIconClass(currentPath === "/inicio")}>
            <Home size={18} strokeWidth={1.5} />
          </span>
          Início
        </NavLink>

        <div className="my-1 h-px w-8 bg-black/8" aria-hidden />

        {visibleModules.map((id) => {
          const m = MODULES[id];
          const MIcon = m.icon;
          const isActive = routeModule === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => handleSelectModule(id)}
              className={railItemClass(isActive)}
              aria-current={isActive ? "page" : undefined}
              title={m.emBreve ? `${m.label} (em breve)` : undefined}
            >
              <span className={railIconClass(isActive)}>
                <MIcon size={18} strokeWidth={1.5} />
              </span>
              {m.label}
            </button>
          );
        })}

        {empresaItems.length > 0 && <div className="my-1 h-px w-8 bg-black/8" aria-hidden />}

        {/* Transversais (Agentes): contador de pendências como ponto no ícone (spec 084) */}
        {empresaItems.map(({ item }) => {
          const Icon = item.icon;
          const isActive = currentPath.startsWith(item.url);
          const pendencias = item.url === "/agentes" ? numPendenciasAgentes : 0;
          return (
            <NavLink
              key={item.title}
              to={item.url}
              className={railItemClass(isActive)}
              aria-current={isActive ? "page" : undefined}
              aria-label={pendencias > 0 ? `${item.title}, ${pendencias} pendências` : undefined}
            >
              <span className={railIconClass(isActive)}>
                <Icon size={18} strokeWidth={1.5} />
                {pendencias > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-brand px-1 text-center text-[10px] font-semibold leading-4 text-ink ring-2 ring-white">
                    {pendencias}
                  </span>
                )}
              </span>
              {item.title}
            </NavLink>
          );
        })}

        {isUltraAdmin && (
          <>
            <div className="my-1 h-px w-8 bg-black/8" aria-hidden />
            <NavLink
              to={ULTRA_ADMIN_BASE}
              end={false}
              onClick={() => collapsed && setOpen(true)}
              className={railItemClass(onUltra)}
              aria-current={onUltra ? "page" : undefined}
              aria-label={
                feedbackNovos > 0 ? `Portal ultra admin, ${feedbackNovos} feedbacks novos` : "Portal ultra admin"
              }
              title="Portal ultra admin"
            >
              <span className={railIconClass(onUltra)}>
                <Zap size={18} strokeWidth={1.5} />
                {feedbackNovos > 0 && !onUltra && (
                  <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-brand ring-2 ring-white" />
                )}
              </span>
              Ultra
            </NavLink>
          </>
        )}
      </nav>

      {/* Sino + conta */}
      <div className="flex shrink-0 flex-col items-center gap-2 pt-2">
        <NotificationInbox />
        <DropdownMenu open={isUserMenuOpen} onOpenChange={setIsUserMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Menu do usuário"
              title={userName}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-black/10",
                isUserRouteActive || isUserMenuOpen ? "bg-brand" : "hover:bg-brand/30"
              )}
            >
              <AvatarStack pessoas={[{ nome: userName, avatarUrl: profile?.avatar_url }]} size="xs" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="right" sideOffset={12} className="min-w-[240px]">
            {/* Cabeçalho clicável: nome + email abrem as configurações; engrenagem à direita reforça a ação. */}
            <DropdownMenuItem onClick={handleProfile} className="cursor-pointer gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold leading-tight text-ink">{userName}</p>
                {userEmail && <p className="truncate text-xs leading-tight text-muted-foreground">{userEmail}</p>}
              </div>
              <Settings size={16} className="shrink-0 text-muted-foreground" />
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setFeedbackOpen(true)} className="justify-between">
              Feedback
              <MessageSquare size={16} className="text-muted-foreground" />
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={toggleValoresOcultos}
              onSelect={(e) => e.preventDefault()}
              className="justify-between"
            >
              {valoresOcultos ? "Mostrar valores financeiros" : "Ocultar valores financeiros"}
              {valoresOcultos ? (
                <EyeOff size={16} className="text-muted-foreground" />
              ) : (
                <Eye size={16} className="text-muted-foreground" />
              )}
            </DropdownMenuItem>
            {isAdmin && !isUltraAdmin && (
              <DropdownMenuItem onClick={handleAdmin} className="justify-between">
                Portal Admin
                <ShieldCheck size={16} className="text-muted-foreground" />
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
    </div>
  );

  const panel = (
    <div className="flex h-full flex-col bg-white" style={{ width: PANEL_WIDTH }}>
      <div className="flex h-16 shrink-0 items-center justify-between pl-5 pr-3">
        <Logo size="xs" />
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label="Recolher menu"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft transition-all duration-200 hover:bg-black/4 hover:text-ink active:scale-95"
        >
          <PanelLeftClose size={18} strokeWidth={1.5} />
        </button>
      </div>

      {onUltra ? (
        <nav
          aria-label="Menu do portal ultra admin"
          className="flex-1 space-y-3 overflow-y-auto px-3 pb-3 scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {(["Plataforma", "Produto", "Operação"] as const).map((group) => (
            <div key={group} className="space-y-1">
              <p className="px-3 pt-1 text-[10px] font-medium uppercase tracking-wider text-black/35">{group}</p>
              {ULTRA_SECOES.filter((s) => s.group === group).map((secao) => {
                const Icon = secao.icon;
                const isActive = ultraAtiva === secao.id;
                const contador = secao.id === "feedback" ? feedbackNovos : 0;
                return (
                  <NavLink
                    key={secao.id}
                    to={secao.url}
                    end={secao.id === "visao-geral"}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-full text-sm transition-all duration-200",
                      isActive ? "bg-brand text-black/80 font-medium" : "text-black/70 hover:bg-brand/30"
                    )}
                  >
                    <Icon size={18} strokeWidth={1.5} className="w-[18px] h-[18px] shrink-0" />
                    <span className="tracking-tight flex-1">{secao.title}</span>
                    {contador > 0 && (
                      <span className="min-w-5 rounded-full bg-brand px-1.5 text-center text-[10px] font-semibold leading-5 text-ink tabular-nums">
                        {contador}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>
      ) : (
        /* Itens do módulo ativo, agrupados por seção (Comercial/Financeiro/Empresa) */
        <nav
          aria-label={`Menu de ${MODULES[activeModule].label}`}
          className="flex-1 space-y-3 overflow-y-auto px-3 pb-3 scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {moduleGroups.map((group, i) => (
            <div key={group.label ?? `grupo-${i}`} className="space-y-1">
              {group.label && (
                <p className="px-3 pt-1 text-[10px] font-medium uppercase tracking-wider text-black/35">
                  {group.label}
                </p>
              )}
              {group.entries.map(({ item, nav }) => renderItem(item, nav))}
            </div>
          ))}
        </nav>
      )}
    </div>
  );

  // Mobile não tem mais drawer: navegação é <BottomNav /> + <ModuleChipNav />
  // (spec 097 / ADR 0040), montados em Layout.tsx e PageLayout.tsx.
  if (isMobile) return null;

  return (
    <div className="fixed left-0 top-0 z-50 flex h-dvh border-r border-black/5 bg-white">
      {rail}
      {!collapsed && panel}
    </div>
  );
}
