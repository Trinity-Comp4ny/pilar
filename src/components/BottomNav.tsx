import { Home, Menu as MenuIcon } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { lazy, Suspense, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { MODULES, type ModuleId } from "@/lib/modules";
import { useModuleNav } from "@/hooks/useModuleNav";
import { useBarraVisivel } from "@/hooks/useBarraVisivel";
import { usePendenciasAgentes } from "@/hooks/useEscopos";

// O Menu só abre ao toque: o painel (com conta, notificações e feedback) fica fora do carregamento inicial.
const carregarMoreSheet = () => import("@/components/MoreSheet");
const MoreSheet = lazy(() => carregarMoreSheet().then((m) => ({ default: m.MoreSheet })));

/** Ordem dos pilares na barra (SPEC 134): Início, Projetos, Obra, Gestão, Menu. */
const PILAR_ORDER: ModuleId[] = ["projetos", "obras", "gestao"];
const INDICE_MENU = PILAR_ORDER.length + 1;

const ITEM_CLASS =
  "relative z-10 flex flex-1 flex-col items-center justify-center gap-0.5 rounded-[26px] outline-hidden transition-[color,transform] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] active:scale-90 focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none";

/** Item ativo: ícone e texto pretos sobre a lente verde; inativo: cinza. */
const itemTone = (active: boolean) => (active ? "text-ink" : "text-muted-foreground");

function BottomNavItem({ active, label, children }: { active: boolean; label: string; children: ReactNode }) {
  return (
    <>
      <span className="relative flex h-6 items-center justify-center">{children}</span>
      <span className={cn("text-[10.5px] font-semibold leading-none tracking-tight", active && "text-ink")}>
        {label}
      </span>
    </>
  );
}

/**
 * Lente verde da aba ativa. Desliza com mola entre os itens e estica no meio do
 * caminho; alterna o nome da animação (a/b) para reiniciá-la a cada troca de aba.
 * Some quando nenhuma aba da barra corresponde à rota (ex.: /agentes).
 */
function LenteAtiva({ indice }: { indice: number }) {
  // Estado derivado da troca de prop, ajustado no próprio render (padrão do React).
  // `posicao` guarda a última aba válida: sem aba ativa, a lente some onde estava.
  const [visto, setVisto] = useState({
    indice,
    posicao: Math.max(indice, 0),
    pulso: undefined as "a" | "b" | undefined,
  });

  if (visto.indice !== indice) {
    const pulsa = visto.indice >= 0 && indice >= 0;
    setVisto({
      indice,
      posicao: indice >= 0 ? indice : visto.posicao,
      pulso: pulsa ? (visto.pulso === "a" ? "b" : "a") : visto.pulso,
    });
  }

  const ativa = indice >= 0;
  return (
    <span
      aria-hidden
      data-testid="lente-ativa"
      data-ativa={ativa}
      data-pulso={visto.pulso}
      className="vidro-lente"
      style={{ "--lente-i": ativa ? indice : visto.posicao } as CSSProperties}
    />
  );
}

/**
 * Navegação mobile (< 768px, SPEC 134 sobre a spec 097 / ADR 0040): pílula flutuante
 * de vidro líquido, solta das bordas. Cinco itens, sempre nesta ordem: Início,
 * Projetos, Obra, Gestão, Menu. Os 3 pilares mantêm slot fixo mesmo sem feature
 * liberada para a empresa (decisão do ADR 0040): quem barra o acesso é o
 * `FeatureRoute` da rota, não este componente. Agentes mora no Menu, com o contador
 * de pendências no ícone dele. Some ao rolar para baixo e com o teclado aberto
 * (`useBarraVisivel`). O vidro e a lente vivem em `src/styles/vidro.css`.
 */
export function BottomNav() {
  const { routeModule, selectModule } = useModuleNav();
  const { pathname } = useLocation();
  const { data: pendenciasAgentes } = usePendenciasAgentes();
  const numPendenciasAgentes = pendenciasAgentes?.length ?? 0;
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuMontado, setMenuMontado] = useState(false);
  const [toque, setToque] = useState(false);
  const visivel = useBarraVisivel();

  const inicioAtivo = pathname.startsWith("/inicio");
  const indicePilar = routeModule ? PILAR_ORDER.indexOf(routeModule) : -1;
  const indiceAtivo = menuOpen ? INDICE_MENU : inicioAtivo ? 0 : indicePilar >= 0 ? indicePilar + 1 : -1;

  // Brilho do vidro no ponto do toque.
  const acender = (e: PointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--toque-x", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--toque-y", `${e.clientY - r.top}px`);
    setToque(true);
  };
  const apagar = () => setToque(false);

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
        <nav
          aria-label="Navegação principal"
          data-visivel={visivel}
          data-toque={toque}
          onPointerDown={acender}
          onPointerUp={apagar}
          onPointerCancel={apagar}
          onPointerLeave={apagar}
          className={cn(
            "vidro-liquido pointer-events-auto mx-auto flex h-16 max-w-md gap-0.5 rounded-[32px] p-1.5 transition-transform duration-300 ease-out motion-reduce:transition-none",
            visivel ? "translate-y-0" : "translate-y-[calc(100%+1.5rem)]"
          )}
        >
          <LenteAtiva indice={indiceAtivo} />

          <NavLink
            to="/inicio"
            data-ativo={inicioAtivo && !menuOpen}
            className={cn(ITEM_CLASS, itemTone(inicioAtivo && !menuOpen))}
          >
            <BottomNavItem active={inicioAtivo && !menuOpen} label="Início">
              <Home size={21} strokeWidth={inicioAtivo && !menuOpen ? 2.1 : 1.8} />
            </BottomNavItem>
          </NavLink>

          {PILAR_ORDER.map((id, i) => {
            const mod = MODULES[id];
            const Icon = mod.icon;
            const active = routeModule === id;
            const destacado = indiceAtivo === i + 1;
            return (
              <button
                key={id}
                type="button"
                onClick={() => selectModule(id)}
                data-ativo={destacado}
                className={cn(ITEM_CLASS, itemTone(destacado))}
                aria-label={mod.label}
                aria-current={active ? "page" : undefined}
              >
                <BottomNavItem active={destacado} label={mod.label}>
                  <Icon size={21} strokeWidth={destacado ? 2.1 : 1.8} />
                </BottomNavItem>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => {
              setMenuMontado(true);
              setMenuOpen(true);
            }}
            onPointerDown={() => void carregarMoreSheet()}
            data-ativo={menuOpen}
            className={cn(ITEM_CLASS, itemTone(menuOpen))}
            aria-label={numPendenciasAgentes > 0 ? `Menu, ${numPendenciasAgentes} pendências de agentes` : "Menu"}
            aria-haspopup="dialog"
          >
            <BottomNavItem active={menuOpen} label="Menu">
              <MenuIcon size={21} strokeWidth={menuOpen ? 2.1 : 1.8} />
              {numPendenciasAgentes > 0 && (
                <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold leading-none text-white">
                  {numPendenciasAgentes}
                </span>
              )}
            </BottomNavItem>
          </button>
        </nav>
      </div>

      {menuMontado && (
        <Suspense fallback={null}>
          <MoreSheet open={menuOpen} onOpenChange={setMenuOpen} />
        </Suspense>
      )}
    </>
  );
}
