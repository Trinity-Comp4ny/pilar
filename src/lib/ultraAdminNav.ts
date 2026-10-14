/**
 * Navegação do portal ultra admin (SPEC 117). O portal entra no trilho de
 * módulos como item "Ultra" (só ultra_admin) e, com a rota em /ultra-admin,
 * o painel lateral lista estas seções no lugar dos itens do módulo.
 * Autorização continua no UltraAdminRoute (papel + MFA); isto é só menu.
 */
import {
  Activity,
  Building2,
  Coins,
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
  group: "Plataforma" | "Produto" | "Operação";
}

export const ULTRA_SECOES: readonly UltraSecao[] = [
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
 * Seção ativa da rota. Visão geral só na raiz; as demais por prefixo, pra
 * /ultra-admin/empresas/:id manter "Empresas" marcado.
 */
export function ultraSecaoAtiva(pathname: string): UltraSecaoId | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === ULTRA_ADMIN_BASE) return "visao-geral";
  const secao = ULTRA_SECOES.find((s) => s.id !== "visao-geral" && (path === s.url || path.startsWith(`${s.url}/`)));
  return secao?.id ?? null;
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
