import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Search, X, ChevronRight, type LucideIcon } from "lucide-react";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/usePermissions";
import type { Feature } from "@/lib/permissions";
import { cn } from "@/lib/utils";

/**
 * Header fino padrão (spec 002-header-padrao).
 * Uma linha, 56px: título · busca (controlada pela página) · ações secundárias
 * (children) · ação primária gated por permissão. Todas as páginas usam este
 * mesmo componente, então o título tem sempre o mesmo tamanho e peso
 * (text-base font-medium) e mostra só o nome da página (sem rótulo de módulo).
 * Contexto de subnível fica a cargo do breadcrumb (spec 006 / ADR 0009).
 */
interface PageHeaderProps {
  title: string;
  /**
   * Trilha de ancestrais clicáveis (spec 006). Renderiza `Ancestral › title` na
   * mesma linha; o `title` continua sendo a folha (página atual). Cada item usa
   * `to` (navega por rota) OU `onClick` (troca de contexto sem trocar de rota,
   * ex.: aba do Financeiro). No mobile a trilha some e sobra só o título.
   */
  breadcrumbs?: Array<{ label: string; to?: string; onClick?: () => void }>;
  /** Ações secundárias, alinhadas à direita antes da primária. */
  children?: React.ReactNode;
  /** Busca controlada pela página: liga no estado de filtro que a página já tem. */
  search?: { value: string; onChange: (v: string) => void; placeholder?: string };
  /** Ação primária. Com `feature`, aplica getButtonProps(feature, "edit"). */
  primaryAction?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
    feature?: Feature;
    /** Âncora do coach mark de onboarding (vira [data-tour=...] no botão). */
    dataTour?: string;
  };
}

function isTypingTarget(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (el as HTMLElement).isContentEditable;
}

export function PageHeader({ title, breadcrumbs, children, search, primaryAction }: PageHeaderProps) {
  const { isMobile } = useSidebar();
  const { getButtonProps } = usePermissions();
  const searchRef = useRef<HTMLInputElement>(null);
  const temBusca = !!search;

  const temTrilha = !!breadcrumbs?.length;

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

      {/* Trilha (breadcrumb) ou título + descrição compacta */}
      {temTrilha ? (
        <nav aria-label="Trilha de navegação" className="flex items-baseline gap-1.5 min-w-0">
          <ol className="hidden sm:flex items-baseline gap-1.5 shrink-0">
            {breadcrumbs!.map((bc) => (
              <li key={bc.label} className="flex items-baseline gap-1.5">
                {bc.onClick ? (
                  <button
                    type="button"
                    onClick={bc.onClick}
                    className="text-sm text-black/45 hover:text-brand transition-colors"
                  >
                    {bc.label}
                  </button>
                ) : (
                  <Link to={bc.to ?? "#"} className="text-sm text-black/45 hover:text-brand transition-colors">
                    {bc.label}
                  </Link>
                )}
                <ChevronRight size={13} className="self-center text-black/25" aria-hidden="true" />
              </li>
            ))}
          </ol>
          <h1 className="text-base font-medium tracking-tight text-ink truncate" aria-current="page">
            {title}
          </h1>
        </nav>
      ) : (
        <div className="flex items-baseline gap-2.5 min-w-0">
          <h1 className="text-base font-medium tracking-tight text-ink truncate">{title}</h1>
        </div>
      )}

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
            data-tour={primaryAction.dataTour}
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
