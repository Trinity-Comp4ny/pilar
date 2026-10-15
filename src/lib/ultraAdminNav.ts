/**
 * Navegação do portal ultra admin (SPEC 117). O portal entra no trilho de
 * módulos como item "Ultra" (só ultra_admin) e, com a rota em /ultra-admin,
 * o painel lateral lista estas seções no lugar dos itens do módulo.
 * Autorização continua no UltraAdminRoute (papel + MFA); isto é só menu.
 */
import {
  Activity,
  Bug,
  Building2,
  Coins,
  HeartHandshake,
  LineChart,
  Megaphone,
  TrendingUp,
  UsersRound,
  Wallet,
  FlaskConical,
  LayoutDashboard,
  MessageSquare,
  ShieldCheck,
  Siren,
  ToggleRight,
  Users,
  type LucideIcon,
} from "lucide-react";

export const ULTRA_ADMIN_BASE = "/ultra-admin";

export type UltraSecaoId =
  | "time"
  | "time-receita"
  | "time-clientes"
  | "time-marketing"
  | "time-produto"
  | "time-qualidade"
  | "time-financas"
  | "visao-geral"
  | "empresas"
  | "usuarios"
  | "testes"
  | "funcionalidades"
  | "feedback"
  | "atividade"
  | "incidentes"
  | "custos-ia"
  | "lgpd";

export interface UltraSecao {
  id: UltraSecaoId;
  title: string;
  url: string;
  icon: LucideIcon;
  group: UltraGrupo;
}

/** Ordem dos grupos no painel lateral. "Time" vem antes: é onde o dia começa (SPEC 126). */
export const ULTRA_GRUPOS = ["Time", "Plataforma", "Produto", "Operação"] as const;
type UltraGrupo = (typeof ULTRA_GRUPOS)[number];

const ULTRA_TIME_BASE = `${ULTRA_ADMIN_BASE}/time`;

export const ULTRA_SECOES: readonly UltraSecao[] = [
  { id: "time", title: "Central", url: ULTRA_TIME_BASE, icon: UsersRound, group: "Time" },
  { id: "time-receita", title: "Receita", url: `${ULTRA_TIME_BASE}/receita`, icon: TrendingUp, group: "Time" },
  { id: "time-clientes", title: "Clientes", url: `${ULTRA_TIME_BASE}/clientes`, icon: HeartHandshake, group: "Time" },
  { id: "time-marketing", title: "Marketing", url: `${ULTRA_TIME_BASE}/marketing`, icon: Megaphone, group: "Time" },
  { id: "time-produto", title: "Produto", url: `${ULTRA_TIME_BASE}/produto`, icon: LineChart, group: "Time" },
  { id: "time-qualidade", title: "Qualidade", url: `${ULTRA_TIME_BASE}/qualidade`, icon: Bug, group: "Time" },
  { id: "time-financas", title: "Finanças", url: `${ULTRA_TIME_BASE}/financas`, icon: Wallet, group: "Time" },
  { id: "visao-geral", title: "Visão geral", url: ULTRA_ADMIN_BASE, icon: LayoutDashboard, group: "Plataforma" },
  { id: "empresas", title: "Empresas", url: `${ULTRA_ADMIN_BASE}/empresas`, icon: Building2, group: "Plataforma" },
  { id: "usuarios", title: "Usuários", url: `${ULTRA_ADMIN_BASE}/usuarios`, icon: Users, group: "Plataforma" },
  { id: "testes", title: "Testes", url: `${ULTRA_ADMIN_BASE}/testes`, icon: FlaskConical, group: "Plataforma" },
  {
    id: "funcionalidades",
    title: "Funcionalidades",
    url: `${ULTRA_ADMIN_BASE}/funcionalidades`,
    icon: ToggleRight,
    group: "Produto",
  },
  { id: "feedback", title: "Feedback", url: `${ULTRA_ADMIN_BASE}/feedback`, icon: MessageSquare, group: "Produto" },
  { id: "atividade", title: "Atividade", url: `${ULTRA_ADMIN_BASE}/atividade`, icon: Activity, group: "Operação" },
  { id: "incidentes", title: "Incidentes", url: `${ULTRA_ADMIN_BASE}/incidentes`, icon: Siren, group: "Operação" },
  { id: "custos-ia", title: "Custos de IA", url: `${ULTRA_ADMIN_BASE}/custos-ia`, icon: Coins, group: "Operação" },
  { id: "lgpd", title: "Pedidos LGPD", url: `${ULTRA_ADMIN_BASE}/lgpd`, icon: ShieldCheck, group: "Operação" },
];

export function isUltraAdminPath(pathname: string): boolean {
  return pathname === ULTRA_ADMIN_BASE || pathname.startsWith(`${ULTRA_ADMIN_BASE}/`);
}

/**
 * Seção ativa da rota. Visão geral só na raiz; as demais pelo prefixo mais longo,
 * pra /ultra-admin/empresas/:id manter "Empresas" e /ultra-admin/time/receita marcar
 * "Receita", não a Central.
 */
export function ultraSecaoAtiva(pathname: string): UltraSecaoId | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === ULTRA_ADMIN_BASE) return "visao-geral";
  const candidatas = ULTRA_SECOES.filter(
    (s) => s.id !== "visao-geral" && (path === s.url || path.startsWith(`${s.url}/`))
  );
  const maisLonga = candidatas.sort((a, b) => b.url.length - a.url.length)[0];
  return maisLonga?.id ?? null;
}

/**
 * Abas da página antiga (`/ultra-admin?tab=`) → rota nova. Os links velhos
 * estão gravados em notificações e e-mails já enviados (SPEC 112/113), então
 * o redirect fica pra sempre.
 */
const ABA_LEGADA: Record<string, UltraSecaoId> = {
  dashboard: "visao-geral",
  empresas: "empresas",
  funcionalidades: "funcionalidades",
  usuarios: "usuarios",
  atividade: "atividade",
  feedback: "feedback",
  status: "incidentes",
  tokens: "custos-ia",
  trials: "testes",
};

export function rotaDaAbaLegada(tab: string | null): string | null {
  if (!tab) return null;
  const id = ABA_LEGADA[tab];
  if (!id) return null;
  return ULTRA_SECOES.find((s) => s.id === id)?.url ?? null;
}
