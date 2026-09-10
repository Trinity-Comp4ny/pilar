import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Search, X, ChevronRight, type LucideIcon } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
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
  /**
   * Conteúdo centralizado na mesma linha do título (ex.: alternador de abas).
   * Fica sobreposto ao resto da linha via posicionamento absoluto; a página
   * controla a própria responsividade (ex.: esconder em telas pequenas).
   */
  center?: React.ReactNode;
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

export function PageHeader({ title, breadcrumbs, children, search, center, primaryAction }: PageHeaderProps) {
  const { isMobile } = useSidebar();
  const { getButtonProps } = usePermissions();
  const searchRef = useRef<HTMLInputElement>(null);
  const temBusca = !!search;
  // Em mobile, a busca some por trás de um botão-ícone e só vira campo quando
  // tocada: um input sempre visível de ~144px (achado da auditoria: "o botão de
  // busca precisava melhorar") não dava espaço pra digitar nada de verdade.
  // Expandida, ela cobre a linha toda (título e ações somem), como o padrão que
  // Notion/ClickUp já usam no mobile.
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const temTrilha = !!breadcrumbs?.length;

  // Atalho "/": foca a busca quando nenhum campo está em edição (spec 002, req. 3).
  useEffect(() => {
    if (!temBusca) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(document.activeElement)) return;
      e.preventDefault();
      if (isMobile) setMobileSearchOpen(true);
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [temBusca, isMobile]);

  useEffect(() => {
    if (mobileSearchOpen) searchRef.current?.focus();
  }, [mobileSearchOpen]);

  const limparBusca = () => {
    search?.onChange("");
    searchRef.current?.blur();
  };

  const fecharBuscaMobile = () => {
    setMobileSearchOpen(false);
    search?.onChange("");
  };

  const PrimaryIcon = primaryAction?.icon;
  const gate = primaryAction?.feature ? getButtonProps(primaryAction.feature, "edit") : undefined;

  // Busca expandida em mobile: cobre a linha toda (título e ações somem), com
  // botão de voltar à esquerda. Fecha a busca ao voltar e limpa o valor.
  if (isMobile && mobileSearchOpen) {
    return (
      <div className="flex h-14 w-full items-center gap-2 px-4">
        <button
          type="button"
          onClick={fecharBuscaMobile}
          aria-label="Fechar busca"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-soft hover:bg-black/5"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="relative min-w-0 flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/35 pointer-events-none" />
          <input
            ref={searchRef}
            value={search?.value}
            onChange={(e) => search?.onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") fecharBuscaMobile();
            }}
            placeholder={search?.placeholder ?? "Buscar"}
            aria-label={search?.placeholder ?? "Buscar"}
            className="w-full h-10 rounded-full border border-black/10 bg-black/[0.02] pl-8 pr-8 text-[15px] text-ink placeholder:text-black/35 outline-none focus:border-brand focus:bg-white transition-colors"
          />
          {!!search?.value && (
            <button
              type="button"
              onClick={limparBusca}
              aria-label="Limpar busca"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 grid place-items-center rounded-full text-black/40 hover:bg-black/5"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative px-4 md:px-6 h-14 w-full flex items-center gap-3">
      {center && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="pointer-events-auto">{center}</div>
        </div>
      )}

      {/* Trilha (breadcrumb) ou título + descrição compacta. min-w-0 sozinho
          deixava o título perder a disputa de espaço pra busca: o input tinha
          w-full (base grande antes do shrink), então o flexbox dava quase todo
          o espaço livre a ela e esmagava o título a poucos px, às vezes 0
          (achado da auditoria: título ficava invisível mesmo com o texto
          certo). Agora a busca mobile é um ícone (ver abaixo), então o título
          sozinho já tem folga; min-w-[80px] segue como piso de segurança. */}
      {temTrilha ? (
        <nav aria-label="Trilha de navegação" className="flex items-baseline gap-1.5 min-w-[80px] shrink">
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
        <div className="flex items-baseline gap-2.5 min-w-[80px] shrink">
          <h1 className="text-base font-medium tracking-tight text-ink truncate">{title}</h1>
        </div>
      )}

      {/* Busca controlada pela página. Em mobile vira só um botão-ícone que abre
          o overlay full-width acima (achado da auditoria: um input de ~144px
          sempre visível não dava espaço real pra digitar). Em desktop segue
          como sempre foi. */}
      {search &&
        (isMobile ? (
          <button
            type="button"
            onClick={() => setMobileSearchOpen(true)}
            aria-label={search.placeholder ?? "Buscar"}
            className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-black/5"
          >
            <Search size={18} />
          </button>
        ) : (
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
        ))}

      {/* Ações: secundárias (children) + primária gated */}
      <div className={cn("flex items-center gap-2 shrink-0", !search && "ml-auto")}>
        {children}
        {primaryAction && (
          <Button
            onClick={primaryAction.onClick}
            variant="brand"
            className={cn(
              "rounded-full h-9 text-[13px] font-medium",
              // Com título + busca + ações secundárias na mesma linha, o label da ação
              // primária era o que sobrava de fora do viewport em mobile (achado da
              // auditoria: "Novo projeto" ficava inalcançável em 390px, sem scroll pra
              // chegar nele). Ícone-only com o ícone sempre presente garante alvo de
              // toque claro sem depender de o texto caber.
              isMobile && PrimaryIcon ? "w-9 px-0 justify-center" : "px-4"
            )}
            data-tour={primaryAction.dataTour}
            aria-label={isMobile && PrimaryIcon ? primaryAction.label : undefined}
            {...gate}
          >
            {PrimaryIcon && <PrimaryIcon size={14} className={cn(isMobile ? undefined : "mr-1.5")} />}
            <span className={cn(isMobile && PrimaryIcon && "sr-only")}>{primaryAction.label}</span>
          </Button>
        )}
      </div>
    </div>
  );
}
