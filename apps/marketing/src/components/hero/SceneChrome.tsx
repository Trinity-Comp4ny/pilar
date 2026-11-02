import { m } from "framer-motion";
import {
  Bell,
  Briefcase,
  Building2,
  Calculator,
  CloudSun,
  FileText,
  FolderKanban,
  GanttChartSquare,
  HardHat,
  Home,
  Layers,
  LayoutGrid,
  ListTodo,
  MapPin,
  PanelLeftClose,
  Plus,
  Search,
  Sparkles,
  Target,
  Truck,
  UserPlus,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { EASE } from "../../lib/motion";
import { MODULOS_APP, NAV_POR_MODULO, moduloAppAtivo, moduloAtivo } from "./scene";

/* Chrome do app, copiado do real (`AppSidebar.tsx`):
   - Trilho de 64px (bg-muted/50, borda black/5): Início, os três módulos,
     Agentes, sino e conta. O item ativo acende numa pílula brand de 40x32.
   - Painel de 208px, branco: marca com botão de recolher e os itens do módulo
     aberto, agrupados por rótulo em caixa alta (black/35).
   - PageHeader: uma linha de 56px com título, busca em pill e ação brand.
   O mock anterior tinha um painel só, com o seletor de módulo em pill, que o
   app trocou pelo trilho. */

const ICONES: Record<string, LucideIcon> = {
  Tarefas: ListTodo,
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
  Obras: HardHat,
  Estimativas: Calculator,
  Fornecedores: Truck,
  Clima: CloudSun,
};

/** Ícone de cada módulo no trilho, igual ao do app. */
const ICONE_MODULO: Record<string, LucideIcon> = { Gestão: Briefcase, Projetos: FolderKanban, Obras: HardHat };

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

/** Divisor do trilho, o mesmo h-px w-8 do app. */
const DivisorTrilho = () => <div className="my-1 h-px w-8 bg-black/10" />;

/** Item do trilho: pílula de ícone mais o rótulo de 10,5px embaixo. */
function ItemTrilho({
  rotulo,
  Icone,
  ativo,
  contador,
}: {
  rotulo: string;
  Icone: LucideIcon;
  ativo: boolean;
  contador?: number;
}) {
  return (
    <div
      className={`flex w-14 flex-col items-center gap-1 py-1 text-[10.5px] leading-none tracking-tight ${
        ativo ? "font-medium text-ink" : "text-black/60"
      }`}
    >
      <span className="relative flex h-8 w-10 items-center justify-center rounded-full">
        {ativo && (
          <m.span
            className="absolute inset-0 rounded-full bg-brand"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.28, ease: EASE.out }}
          />
        )}
        <Icone className="relative w-[18px] h-[18px] text-black/80" strokeWidth={1.5} />
        {!!contador && (
          <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-brand px-1 text-center text-[10px] font-semibold leading-4 text-ink ring-2 ring-white">
            {contador}
          </span>
        )}
      </span>
      {rotulo}
    </div>
  );
}

/** Barra lateral do app: trilho de módulos mais painel do módulo aberto. */
export function AppSidebar({ ato }: { ato: number }) {
  const ativo = moduloAtivo(ato);
  const modulo = moduloAppAtivo(ato);
  const noAgentes = ativo === "Agentes";
  const itens = NAV_POR_MODULO[modulo] ?? [];
  // Ordem estável dos grupos; módulo sem grupo cai num bloco sem rótulo.
  const grupos = [...new Set(itens.map((i) => i.grupo ?? ""))];

  return (
    <div className="flex shrink-0 border-r border-black/5 bg-white">
      {/* Trilho. */}
      <div className="w-16 flex flex-col items-center border-r border-black/5 bg-app-muted/50 pt-3 pb-3">
        <div className="flex flex-1 flex-col items-center gap-2">
          <ItemTrilho rotulo="Início" Icone={Home} ativo={false} />
          <DivisorTrilho />
          {MODULOS_APP.map((nome) => (
            <ItemTrilho key={nome} rotulo={nome} Icone={ICONE_MODULO[nome]} ativo={!noAgentes && nome === modulo} />
          ))}
          <DivisorTrilho />
          {/* O contador de pendências do agente aparece no app como um ponto no ícone. */}
          <ItemTrilho rotulo="Agentes" Icone={Sparkles} ativo={noAgentes} contador={1} />
        </div>

        <div className="flex flex-col items-center gap-2 pt-2">
          <span className="relative flex h-9 w-9 items-center justify-center">
            <Bell className="w-4 h-4 text-black/50" strokeWidth={1.5} />
            <span className="absolute right-2 top-1.5 h-2 w-2 rounded-full bg-chart-danger" />
          </span>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-info-soft text-[9px] font-semibold text-info-strong">
            MA
          </span>
        </div>
      </div>

      {/* Painel. */}
      <div className="w-[208px] flex flex-col">
        <div className="h-16 flex items-center justify-between pl-5 pr-3 shrink-0">
          {/* A marca de verdade, o mesmo SVG que o app serve. */}
          <span className="flex items-center gap-3">
            <img src="/pilar-logo.svg" alt="" className="w-7 h-7 shrink-0" />
            <span className="text-[15px] font-medium tracking-tight text-ink">Pilar</span>
          </span>
          <PanelLeftClose className="w-[18px] h-[18px] text-black/50" strokeWidth={1.5} />
        </div>

        <div className="px-3 pb-3 flex-1 overflow-hidden space-y-3">
          {grupos.map((grupo) => (
            <div key={grupo || "sem-grupo"} className="space-y-1">
              {grupo && (
                <p className="px-3 pt-1 text-[10px] font-medium uppercase tracking-wider text-black/35">{grupo}</p>
              )}
              {itens
                .filter((n) => (n.grupo ?? "") === grupo)
                .map((item) => {
                  const Icone = ICONES[item.nome] ?? ListTodo;
                  const selecionado = !noAgentes && item.nome === ativo;
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
                        className={`relative flex items-center gap-3 text-[13px] tracking-tight ${
                          selecionado ? "text-black/80 font-medium" : "text-black/70"
                        }`}
                      >
                        <Icone className="w-[18px] h-[18px] shrink-0" strokeWidth={1.5} />
                        {item.nome}
                      </span>
                    </div>
                  );
                })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Cabeçalho fino do app: uma linha de 56px. */
export function PageHeader({
  titulo,
  trilha,
  busca,
  secundarias,
  acao,
}: {
  titulo: string;
  trilha?: string;
  busca?: string;
  /** Botões de contorno antes da ação primária (ex.: Pausar projeto, Editar). */
  secundarias?: string[];
  acao?: { label: string; primaria?: boolean };
}) {
  return (
    <div className="h-14 shrink-0 flex items-center gap-3 px-6">
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
        <div className="ml-auto flex items-center gap-2 h-9 w-[290px] rounded-full border border-black/10 bg-white px-3">
          <Search className="w-3.5 h-3.5 text-black/30 shrink-0" strokeWidth={1.6} />
          <span className="text-[12px] text-black/60 truncate">{busca}</span>
        </div>
      )}

      {secundarias?.map((rotulo, i) => (
        <span
          key={rotulo}
          className={`${!busca && i === 0 ? "ml-auto" : ""} flex items-center h-9 px-4 rounded-full border border-black/10 bg-white text-[13px] font-medium text-ink shrink-0`}
        >
          {rotulo}
        </span>
      ))}

      {acao && (
        <span
          className={`${busca || secundarias?.length ? "" : "ml-auto"} flex items-center gap-1.5 h-9 px-4 rounded-full text-[13px] font-medium shrink-0 ${
            acao.primaria === false ? "border border-black/10 bg-white text-ink" : "bg-brand text-ink"
          }`}
        >
          {acao.primaria !== false && <Plus className="w-3.5 h-3.5" strokeWidth={2} />}
          {acao.label}
        </span>
      )}
    </div>
  );
}

/** Tom da pílula de ícone do KPI, o mesmo `TONE_BADGE` do app. */
const TOM_ICONE = {
  neutro: "bg-app-muted text-ink-muted",
  positivo: "bg-positive/10 text-positive-strong",
  atencao: "bg-attention-soft text-attention-strong",
  perigo: "bg-danger-soft text-danger-strong",
} as const;

/** Cartão de KPI do app: rounded-2xl, borda black/5, rótulo em caixa alta e ícone em pílula. */
export function KPICard({
  rotulo,
  valor,
  sub,
  tom,
  compacto,
  icone: Icone,
  tomIcone = "neutro",
}: {
  rotulo: string;
  valor: React.ReactNode;
  sub?: string;
  tom?: "positivo" | "negativo";
  compacto?: boolean;
  icone?: LucideIcon;
  tomIcone?: keyof typeof TOM_ICONE;
}) {
  const cor = tom === "positivo" ? "text-positive-strong" : tom === "negativo" ? "text-negative-strong" : "text-ink";

  return (
    <div className={`rounded-2xl border border-black/5 bg-white ${compacto ? "p-3" : "p-4"}`}>
      <div className="flex items-start justify-between gap-1.5 mb-1.5">
        <p className="text-[9.5px] uppercase tracking-wider text-ink-muted pt-0.5">{rotulo}</p>
        {Icone && (
          <span className={`-mr-1 -mt-1 shrink-0 rounded-full p-1 ${TOM_ICONE[tomIcone]}`}>
            <Icone className="w-3 h-3" />
          </span>
        )}
      </div>
      <p className={`${compacto ? "text-[17px]" : "text-[19px]"} font-bold tabular-nums leading-none ${cor}`}>
        {valor}
      </p>
      {sub && <p className="text-[10px] text-ink-muted mt-1.5">{sub}</p>}
    </div>
  );
}
