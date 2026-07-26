import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { Search, X, type LucideIcon } from "lucide-react";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/usePermissions";
import type { Feature } from "@/lib/permissions";
import { MODULES, routeToModule } from "@/lib/modules";
import { cn } from "@/lib/utils";

/**
 * Header fino padrão (spec 002-header-padrao).
 * Uma linha, 56px: título · rótulo do módulo · busca (controlada pela página) ·
 * ações secundárias (children) · ação primária gated por permissão.
 * Padrões emprestados do AppShell do labrynth-platform: linha única sticky,
 * rótulo de contexto uppercase com border-l, atalho de teclado para busca.
 */
interface PageHeaderProps {
  title: string;
  /** Compat: vira linha auxiliar de 1 linha, truncada. Evitar em usos novos. */
  description?: string;
  /** Ações secundárias, alinhadas à direita antes da primária. */
  children?: React.ReactNode;
  /** Busca controlada pela página: liga no estado de filtro que a página já tem. */
  search?: { value: string; onChange: (v: string) => void; placeholder?: string };
  /** Ação primária. Com `feature`, aplica getButtonProps(feature, "edit"). */
  primaryAction?: { label: string; onClick: () => void; icon?: LucideIcon; feature?: Feature };
  /** Mostra o módulo da rota ao lado do título (default true). */
  moduleLabel?: boolean;
}

function isTypingTarget(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (el as HTMLElement).isContentEditable;
}

export function PageHeader({
  title,
  description,
  children,
  search,
  primaryAction,
  moduleLabel = true,
}: PageHeaderProps) {
  const { isMobile } = useSidebar();
  const { pathname } = useLocation();
  const { getButtonProps } = usePermissions();
  const searchRef = useRef<HTMLInputElement>(null);
  const temBusca = !!search;

  const modulo = moduleLabel ? routeToModule(pathname) : null;

  // Atalho "/": foca a busca quando nenhum campo está em edição (spec 002, req. 3).
  useEffect(() => {
    if (!temBusca) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(document.activeElement)) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [temBusca]);

  const limparBusca = () => {
    search?.onChange("");
    searchRef.current?.blur();
  };

  const PrimaryIcon = primaryAction?.icon;
  const gate = primaryAction?.feature ? getButtonProps(primaryAction.feature, "edit") : undefined;

  return (
    <div className="px-4 md:px-6 h-14 w-full flex items-center gap-3">
      {isMobile && (
        <SidebarTrigger className="text-black/80 hover:text-brand hover:bg-black/5 transition-colors rounded-full h-9 w-9 shrink-0" />
      )}

      {/* Título + módulo + descrição compacta */}
      <div className="flex items-baseline gap-2.5 min-w-0">
        <h1 className="text-base font-medium tracking-tight text-ink truncate">{title}</h1>
        {modulo && (
          <span className="hidden sm:inline text-[10px] font-medium uppercase tracking-[0.08em] text-black/40 border-l border-black/10 pl-2.5 shrink-0">
            {MODULES[modulo].label}
          </span>
        )}
        {description && <span className="hidden lg:inline text-xs text-black/45 truncate">{description}</span>}
      </div>

      {/* Busca controlada pela página */}
      {search && (
        <div className="relative ml-auto w-full max-w-[16rem] shrink">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/35 pointer-events-none" />
          <input
            ref={searchRef}
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") limparBusca();
            }}
            placeholder={search.placeholder ?? "Buscar"}
            aria-label={search.placeholder ?? "Buscar"}
            aria-keyshortcuts="/"
            className="w-full h-9 rounded-full border border-black/10 bg-black/[0.02] pl-8 pr-8 text-[13px] text-ink placeholder:text-black/35 outline-none focus:border-black/25 focus:bg-white transition-colors"
          />
          {search.value && (
            <button
              type="button"
              onClick={limparBusca}
              aria-label="Limpar busca"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 grid place-items-center rounded-full text-black/40 hover:bg-black/5"
            >
              <X size={12} />
            </button>
          )}
        </div>
      )}

      {/* Ações: secundárias (children) + primária gated */}
      <div className={cn("flex items-center gap-2 shrink-0", !search && "ml-auto")}>
        {children}
        {primaryAction && (
          <Button
            onClick={primaryAction.onClick}
            variant="brand"
            className="rounded-full h-9 px-4 text-[13px] font-medium"
            {...gate}
          >
            {PrimaryIcon && <PrimaryIcon size={14} className="mr-1.5" />}
            {primaryAction.label}
          </Button>
        )}
      </div>
    </div>
  );
}
