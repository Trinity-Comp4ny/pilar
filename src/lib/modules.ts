/**
 * Mapa central dos módulos (pilares) do shell — spec 001-shell-3-pilares.
 *
 * Regras:
 * - O módulo ativo é SEMPRE inferido da rota via routeToModule(); o switcher da
 *   sidebar é apresentação, nunca autorização (gates continuam em FeatureRoute,
 *   AdminOnlyRoute e usePermissions).
 * - As rotas são aninhadas por módulo (/<modulo>/<aba>) desde o ADR 0016; rotas
 *   flat antigas seguem funcionando via redirect em App.tsx.
 * - Entidade é da empresa; o módulo é dono da tela de administração dela; outros
 *   módulos referenciam a entidade e mostram recortes (ver spec, "Regra de
 *   arquitetura").
 */
import {
  Briefcase,
  Building2,
  CalendarDays,
  CloudSun,
  FileText,
  FolderKanban,
  GanttChartSquare,
  HardHat,
  Layers,
  LayoutGrid,
  ListTodo,
  MapPin,
  Sparkles,
  Target,
  Truck,
  UserPlus,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { Feature } from "@/lib/permissions";

export type ModuleId = "gestao" | "projetos" | "obras";

export type ModuleMenuItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  /** Sem feature = sempre visível (ex.: Obras "em breve"). */
  feature?: Feature;
  badge?: "novo" | "em breve";
  adminOnly?: boolean;
  /** Rótulo do sub-grupo na sidebar (ex.: "Comercial"). Itens sem grupo ficam soltos. */
  group?: string;
};

export type ModuleDef = {
  id: ModuleId;
  label: string;
  icon: LucideIcon;
  /** Rota aberta ao selecionar o módulo no switcher. */
  homeRoute: string;
  emBreve?: boolean;
  items: ModuleMenuItem[];
};

export const MODULE_ORDER: readonly ModuleId[] = ["gestao", "projetos", "obras"] as const;

export const MODULES: Record<ModuleId, ModuleDef> = {
  gestao: {
    id: "gestao",
    label: "Gestão",
    icon: Briefcase,
    homeRoute: "/gestao/meu-trabalho",
    items: [
      // Empresa (primeiro grupo: Meu trabalho é a home do módulo)
      { title: "Meu trabalho", url: "/gestao/meu-trabalho", icon: ListTodo, feature: "meu_trabalho", group: "Empresa" },
      { title: "Equipe", url: "/gestao/equipe", icon: Users, feature: "pessoas", adminOnly: true, group: "Empresa" },
      { title: "Metas", url: "/gestao/metas", icon: Target, feature: "metas", adminOnly: true, group: "Empresa" },
      // Comercial (movido de Projetos: dono da relação com o cliente é gestão/comercial)
      { title: "Leads", url: "/gestao/leads", icon: UserPlus, feature: "leads", group: "Comercial" },
      { title: "Clientes", url: "/gestao/clientes", icon: Building2, feature: "clientes", group: "Comercial" },
      { title: "Propostas", url: "/gestao/propostas", icon: FileText, feature: "propostas", group: "Comercial" },
      // Financeiro
      { title: "Financeiro", url: "/gestao/financeiro", icon: Wallet, feature: "financeiro", group: "Financeiro" },
    ],
  },
  projetos: {
    id: "projetos",
    label: "Projetos",
    icon: FolderKanban,
    homeRoute: "/projetos",
    items: [
      // A coleção de projetos (com toggle Quadro/Lista interno) + as lentes de
      // recorte, aninhadas sob o módulo (/projetos/*) para comunicar pertencimento
      // e liberar os nomes genéricos (cronograma/mapa) para outros módulos.
      { title: "Projetos", url: "/projetos", icon: LayoutGrid, feature: "projetos" },
      { title: "Disciplinas", url: "/projetos/disciplinas", icon: Layers, feature: "projetos" },
      { title: "Cronograma", url: "/projetos/cronograma", icon: GanttChartSquare, feature: "projetos" },
      { title: "Mapa", url: "/projetos/mapa", icon: MapPin, feature: "mapa" },
      { title: "Calendário", url: "/projetos/calendario", icon: CalendarDays, feature: "projetos" },
    ],
  },
  obras: {
    id: "obras",
    label: "Obras",
    icon: HardHat,
    homeRoute: "/obras",
    items: [
      { title: "Obras", url: "/obras", icon: HardHat, feature: "obras" },
      // Fornecedor é cadastro global da empresa (empresa_id, sem obra_id), reusado
      // por cotação/conta da obra e pela despesa do escritório. A porta de gerência
      // mora aqui na Obra; o escritório mantém o SupplierManager embutido na despesa.
      { title: "Fornecedores", url: "/obras/fornecedores", icon: Truck, feature: "obras" },
      { title: "Clima", url: "/obras/clima", icon: CloudSun, feature: "obras" },
    ],
  },
};

/** Grupo fixo "Empresa" — transversal, fora do switcher. */
export const EMPRESA_ITEMS: ModuleMenuItem[] = [
  { title: "Agentes", url: "/agentes", icon: Sparkles, feature: "ai_chat" as Feature, badge: "novo" },
];

/** Rotas que pertencem a um módulo mas não são item de menu (detalhes, redirects). */
const EXTRA_ROUTE_PREFIXES: ReadonlyArray<readonly [string, ModuleId]> = [
  ["/mapa", "projetos"],
  ["/rentabilidade", "gestao"], // redireciona para /gestao/financeiro?tab=rentabilidade
];

const ROUTE_PREFIXES: ReadonlyArray<readonly [string, ModuleId]> = [
  // Só o pathname importa aqui; itens com ?view= compartilham o mesmo prefixo (/projetos).
  ...MODULE_ORDER.flatMap((id) => MODULES[id].items.map((item) => [item.url.split("?")[0], id] as const)),
  ...EXTRA_ROUTE_PREFIXES,
  // Ordena da mais longa pra mais curta: prefixo mais específico vence.
].sort((a, b) => b[0].length - a[0].length);

/**
 * Infere o módulo dono de uma rota. Prefix match: "/projetos/123" → projetos.
 * Rotas transversais (/inicio, /agentes, /profile...) retornam null.
 */
export function routeToModule(pathname: string): ModuleId | null {
  // Só o pathname classifica; ?view= e #hash não mudam o módulo dono da rota.
  const path = pathname.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  for (const [prefix, moduleId] of ROUTE_PREFIXES) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return moduleId;
  }
  return null;
}

export const ULTIMO_MODULO_KEY = "pilar.ultimo-modulo";

function isModuleId(value: unknown): value is ModuleId {
  return value === "gestao" || value === "projetos" || value === "obras";
}

/** Último módulo usado (localStorage). Fallback: projetos, o pilar maduro. */
export function readUltimoModulo(): ModuleId {
  try {
    const raw = localStorage.getItem(ULTIMO_MODULO_KEY);
    return isModuleId(raw) ? raw : "projetos";
  } catch {
    return "projetos";
  }
}

export function saveUltimoModulo(moduleId: ModuleId): void {
  try {
    localStorage.setItem(ULTIMO_MODULO_KEY, moduleId);
  } catch {
    // localStorage indisponível (modo privado etc.): sem estado, sem erro.
  }
}
