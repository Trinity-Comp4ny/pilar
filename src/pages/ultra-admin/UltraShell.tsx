import { NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import { ULTRA_SECOES, rotaDaAbaLegada, ultraSecaoAtiva } from "@/lib/ultraAdminNav";
import { cn } from "@/lib/utils";

/**
 * Casca das rotas /ultra-admin/* (SPEC 117). No desktop a navegação mora no
 * painel lateral (AppSidebar); aqui só ficam o redirect dos links antigos
 * `?tab=` e a faixa de chips do mobile, onde não há painel.
 */
export default function UltraShell() {
  const location = useLocation();
  const legado = rotaDaAbaLegada(new URLSearchParams(location.search).get("tab"));
  if (legado && location.pathname.replace(/\/+$/, "") === "/ultra-admin") {
    return <Navigate to={legado} replace />;
  }

  const ativa = ultraSecaoAtiva(location.pathname);

  return (
    <>
      <nav
        aria-label="Seções do portal ultra admin"
        className="flex gap-1.5 overflow-x-auto px-4 pb-2 pt-3 scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden md:hidden"
      >
        {ULTRA_SECOES.map((s) => (
          <NavLink
            key={s.id}
            to={s.url}
            end={s.id === "visao-geral"}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs transition-colors",
              ativa === s.id ? "bg-brand font-medium text-ink" : "bg-muted text-ink-soft"
            )}
          >
            {s.title}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </>
  );
}
