import { m } from "framer-motion";
import {
  Bell,
  Briefcase,
  FolderKanban,
  GanttChartSquare,
  Layers,
  LayoutGrid,
  MapPin,
  Building2,
  ChevronDown,
  FileText,
  Home,
  ListTodo,
  PanelLeftClose,
  Plus,
  Search,
  Sparkles,
  Target,
  UserCircle,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { EASE } from "../../lib/motion";
import { NAV_POR_MODULO, moduloAppAtivo, moduloAtivo } from "./scene";

/* Chrome do app, copiado do real:
   - AppSidebar: 240px, branca, borda black/5, faixa de topo h-16 com a marca,
     pill do seletor de módulo, bloco transversal (Início, Agentes), itens
     agrupados por rótulo em caixa alta, rodapé com usuário e sino.
   - PageHeader: uma linha de 56px com título text-base font-medium, busca em
     pill e ação primária brand.
   Antes o mock tinha lista plana inventada e um cabeçalho de duas linhas que
   não existe no produto. */

const ICONES: Record<string, typeof Home> = {
  "Meu trabalho": ListTodo,
  Financeiro: Wallet,
  Equipe: Users,
  Metas: Target,
  Leads: UserPlus,
  Clientes: Building2,
  Propostas: FileText,
  Projetos: LayoutGrid,
  Disciplinas: Layers,
  Cronograma: GanttChartSquare,
  Mapa: MapPin,
};

/** Ícone do módulo no seletor, igual ao do app. */
const ICONE_MODULO: Record<string, typeof Home> = { Gestão: Briefcase, Projetos: FolderKanban };

export function BarraNavegador() {
  return (
    <div className="h-10 flex items-center gap-2 px-4 border-b border-black/5 bg-paper-alt/60 shrink-0">
      <span className="w-2.5 h-2.5 rounded-full bg-black/10" />
      <span className="w-2.5 h-2.5 rounded-full bg-black/10" />
      <span className="w-2.5 h-2.5 rounded-full bg-black/10" />
      <span className="ml-3 px-3 py-[3px] rounded-md bg-white border border-black/5 text-[10px] text-ink-muted">
        app.pilarsoft.com.br
      </span>
    </div>
  );
}

/** Barra lateral do app. */
export function AppSidebar({ ato }: { ato: number }) {
  const ativo = moduloAtivo(ato);
  const modulo = moduloAppAtivo(ato);
  const itens = NAV_POR_MODULO[modulo] ?? [];
  const IconeModulo = ICONE_MODULO[modulo] ?? Briefcase;
  // Ordem estável dos grupos; módulo sem grupo cai num bloco sem rótulo.
  const grupos = [...new Set(itens.map((i) => i.grupo ?? ""))];

  return (
    <div className="w-[240px] shrink-0 flex flex-col border-r border-black/5 bg-white">
      {/* Topo: marca + recolher. */}
      <div className="h-16 flex items-center gap-2 px-4 shrink-0">
        {/* A marca de verdade, o mesmo SVG que o app serve. */}
        <img src="/pilar-logo.svg" alt="" className="w-7 h-7 shrink-0" />
        <span className="text-[15px] font-medium tracking-tight text-ink">Pilar</span>
        <PanelLeftClose className="ml-auto w-4 h-4 text-black/30" strokeWidth={1.5} />
      </div>

      <div className="px-3 pb-3 flex-1 overflow-hidden">
        {/* Seletor de módulo: troca junto com a tela. */}
        <div className="flex items-center gap-2 rounded-full border border-black/10 bg-black/[0.03] px-3 py-2 mb-3">
          <IconeModulo className="w-[15px] h-[15px] text-ink shrink-0" strokeWidth={1.5} />
          <m.span
            key={modulo}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: EASE.out }}
            className="text-[13px] font-medium text-ink"
          >
            {modulo}
          </m.span>
          <ChevronDown className="ml-auto w-3.5 h-3.5 text-black/35" strokeWidth={1.5} />
        </div>

        {/* Transversais, fora do switcher. */}
        {[
          { nome: "Início", Icone: Home },
          { nome: "Agentes", Icone: Sparkles },
        ].map(({ nome, Icone }) => {
          // Transversal também acende: com a tela de Agentes aberta e o item
          // apagado, o mock mostrava um estado que o app nunca produz.
          const selecionado = nome === ativo;
          return (
            <div key={nome} className="relative px-3 py-2 rounded-full">
              {selecionado && (
                <m.span
                  className="absolute inset-0 rounded-full bg-brand"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.28, ease: EASE.out }}
                />
              )}
              <span
                className={`relative flex items-center gap-3 text-[13px] ${
                  selecionado ? "text-black/80 font-medium" : "text-black/70"
                }`}
              >
                <Icone className="w-[17px] h-[17px] shrink-0" strokeWidth={1.5} />
                {nome}
              </span>
            </div>
          );
        })}

        {grupos.map((grupo) => (
          <div key={grupo || "sem-grupo"} className="mt-3">
            {grupo && (
              <p className="px-3 pt-1 pb-1.5 text-[10px] font-medium uppercase tracking-wider text-black/35">{grupo}</p>
            )}
            {itens
              .filter((n) => (n.grupo ?? "") === grupo)
              .map((item) => {
                const Icone = ICONES[item.nome] ?? ListTodo;
                const selecionado = item.nome === ativo;
                return (
                  <div key={item.nome} className="relative px-3 py-2 rounded-full">
                    {selecionado && (
                      <m.span
                        className="absolute inset-0 rounded-full bg-brand"
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.28, ease: EASE.out }}
                      />
                    )}
                    <span
                      className={`relative flex items-center gap-3 text-[13px] ${
                        selecionado ? "text-black/80 font-medium" : "text-black/70"
                      }`}
                    >
                      <Icone className="w-[17px] h-[17px] shrink-0" strokeWidth={1.5} />
                      {item.nome}
                    </span>
                  </div>
                );
              })}
          </div>
        ))}
      </div>

      {/* Rodapé: usuário + sino. */}
      <div className="border-t border-black/5 p-3 flex items-center gap-2 shrink-0">
        <div className="flex-1 flex items-center gap-2 rounded-full px-2 py-1.5 min-w-0">
          <UserCircle className="w-6 h-6 text-black/35 shrink-0" strokeWidth={1.5} />
          <span className="min-w-0">
            <span className="block text-[12px] font-medium text-black/70 truncate">Marina Alves</span>
            <span className="block text-[10.5px] text-black/40 truncate">marina@vrzengenharia.com.br</span>
          </span>
          <ChevronDown className="ml-auto w-3 h-3 text-black/30 shrink-0" strokeWidth={1.5} />
        </div>
        <Bell className="w-4 h-4 text-black/35 shrink-0" strokeWidth={1.5} />
      </div>
    </div>
  );
}

/** Cabeçalho fino do app: uma linha de 56px. */
export function PageHeader({
  titulo,
  trilha,
  busca,
  acao,
}: {
  titulo: string;
  trilha?: string;
  busca?: string;
  acao?: { label: string; primaria?: boolean };
}) {
  return (
    <div className="h-14 shrink-0 flex items-center gap-3 px-6 border-b border-black/5">
      <h3 className="flex items-center gap-1.5 text-[15px] font-medium tracking-tight text-ink shrink-0">
        {trilha && (
          <>
            <span className="text-ink-muted font-normal">{trilha}</span>
            <span className="text-black/25">›</span>
          </>
        )}
        {titulo}
      </h3>

      {busca && (
        <div className="ml-auto flex items-center gap-2 h-9 w-[290px] rounded-full border border-black/10 bg-black/[0.02] px-3">
          <Search className="w-3.5 h-3.5 text-black/30 shrink-0" strokeWidth={1.6} />
          <span className="text-[12px] text-black/30 truncate">{busca}</span>
        </div>
      )}

      {acao && (
        <span
          className={`${busca ? "" : "ml-auto"} flex items-center gap-1.5 h-9 px-4 rounded-full text-[13px] font-medium shrink-0 ${
            acao.primaria === false ? "border border-black/10 text-ink" : "bg-brand text-ink"
          }`}
        >
          {acao.primaria !== false && <Plus className="w-3.5 h-3.5" strokeWidth={2} />}
          {acao.label}
        </span>
      )}
    </div>
  );
}

/** Cartão de KPI do app: rounded-2xl, borda black/5, rótulo em caixa alta. */
export function KPICard({
  rotulo,
  valor,
  sub,
  tom,
  compacto,
}: {
  rotulo: string;
  valor: React.ReactNode;
  sub?: string;
  tom?: "positivo" | "negativo";
  compacto?: boolean;
}) {
  const cor = tom === "positivo" ? "text-positive-strong" : tom === "negativo" ? "text-negative-strong" : "text-ink";

  return (
    <div className={`rounded-2xl border border-black/5 bg-white ${compacto ? "p-3" : "p-4"}`}>
      <p className="text-[9.5px] uppercase tracking-wider text-ink-muted mb-1.5">{rotulo}</p>
      <p className={`${compacto ? "text-[17px]" : "text-[19px]"} font-bold tabular-nums leading-none ${cor}`}>
        {valor}
      </p>
      {sub && <p className="text-[10px] text-ink-muted mt-1.5">{sub}</p>}
    </div>
  );
}
