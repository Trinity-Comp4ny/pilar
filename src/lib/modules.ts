/**
 * Mapa central dos módulos (pilares) do shell — spec 001-shell-3-pilares.
 *
 * Regras:
 * - O módulo ativo é SEMPRE inferido da rota via routeToModule(); o switcher da
 *   sidebar é apresentação, nunca autorização (gates continuam em FeatureRoute,
 *   RequireRole e usePermissions).
 * - Nenhuma rota existente muda de path; este arquivo só classifica rotas em módulos.
 * - Entidade é da empresa; o módulo é dono da tela de administração dela; outros
 *   módulos referenciam a entidade e mostram recortes (ver spec, "Regra de
 *   arquitetura").
 */
import {
  BarChart,
  Briefcase,
  Building2,
  Calendar,
  CalendarDays,
  FileText,
  FolderKanban,
  HardHat,
  Home,
  Sparkles,
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
    homeRoute: "/financeiro",
    items: [
      { title: "Financeiro", url: "/financeiro", icon: Wallet, feature: "financeiro" },
      { title: "Equipe", url: "/equipe", icon: Users, feature: "pessoas", adminOnly: true },
      { title: "Fornecedores", url: "/fornecedores", icon: Truck, feature: "financeiro" },
      { title: "Relatórios", url: "/relatorios", icon: BarChart, feature: "relatorios" },
    ],
  },
  projetos: {
    id: "projetos",
    label: "Projetos",
    icon: FolderKanban,
    homeRoute: "/dashboard",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: Home, feature: "dashboard" },
      { title: "Leads", url: "/leads", icon: UserPlus, feature: "leads" },
      { title: "Documentos", url: "/documentos", icon: FileText, feature: "propostas" },
      { title: "Clientes", url: "/clientes", icon: Building2, feature: "clientes" },
      { title: "Projetos", url: "/projetos", icon: Calendar, feature: "projetos" },
      { title: "Calendário", url: "/calendario", icon: CalendarDays, feature: "projetos" },
    ],
  },
  obras: {
    id: "obras",
    label: "Obras",
    icon: HardHat,
    homeRoute: "/obras",
    emBreve: true,
    items: [{ title: "Obras", url: "/obras", icon: HardHat, badge: "em breve" }],
  },
};

/** Grupo fixo "Empresa" — transversal, fora do switcher. */
export const EMPRESA_ITEMS: ModuleMenuItem[] = [
  { title: "Agentes", url: "/agentes", icon: Sparkles, feature: "ai_chat" as Feature, badge: "novo" },
];

/** Rotas que pertencem a um módulo mas não são item de menu (detalhes, sub-rotas). */
const EXTRA_ROUTE_PREFIXES: ReadonlyArray<readonly [string, ModuleId]> = [
  ["/mapa", "projetos"],
  ["/rentabilidade", "projetos"],
];

const ROUTE_PREFIXES: ReadonlyArray<readonly [string, ModuleId]> = [
  ...MODULE_ORDER.flatMap((id) => MODULES[id].items.map((item) => [item.url, id] as const)),
  ...EXTRA_ROUTE_PREFIXES,
  // Ordena da mais longa pra mais curta: prefixo mais específico vence.
].sort((a, b) => b[0].length - a[0].length);

/**
 * Infere o módulo dono de uma rota. Prefix match: "/projetos/123" → projetos.
 * Rotas transversais (/inicio, /agentes, /profile...) retornam null.
 */
export function routeToModule(pathname: string): ModuleId | null {
  const path = pathname.replace(/\/+$/, "") || "/";
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
