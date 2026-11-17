import { TONE_BADGE } from "@/lib/status";

export type CompanyUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  contato?: string;
};

export type CompanyData = {
  nomeEmpresa: string;
  cnpj: string;
  email: string;
  contato: string;
  endereco: string;
  cidade: string;
  estado: string;
  cep: string;
  status: string;
  logoUrl?: string;
  pixChave?: string;
  pixInstrucoes?: string;
  // Perfil do escritório (SPEC 149)
  site?: string;
  porte?: string;
  disciplinas?: string[];
};

export const ROLES = ["admin", "user"] as const;

export const STATUS_OPTIONS = [
  { value: "active", label: "Ativa" },
  { value: "suspended", label: "Suspensa" },
  { value: "cancelled", label: "Cancelada" },
] as const;

export function getStatusBadge(status: string) {
  const s = (status || "").toLowerCase();
  if (s === "active") return { label: "Ativa", className: TONE_BADGE.positive };
  if (s === "suspended") return { label: "Suspensa", className: TONE_BADGE.attention };
  if (s === "cancelled") return { label: "Cancelada", className: TONE_BADGE.danger };
  return { label: status || "-", className: TONE_BADGE.neutral };
}
