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
};

export const ROLES = ["admin", "financeiro", "marketing", "operacional", "user"] as const;

export const STATUS_OPTIONS = [
  { value: "active", label: "Ativa" },
  { value: "suspended", label: "Suspensa" },
  { value: "cancelled", label: "Cancelada" },
] as const;

export function getStatusBadge(status: string) {
  const s = (status || "").toLowerCase();
  if (s === "active") {
    return { label: "Ativa", className: "bg-emerald-600/15 text-emerald-700 border border-emerald-600/20" };
  }
  if (s === "suspended") {
    return { label: "Suspensa", className: "bg-amber-600/15 text-amber-700 border border-amber-600/20" };
  }
  if (s === "cancelled") {
    return { label: "Cancelada", className: "bg-red-600/15 text-red-700 border border-red-600/20" };
  }
  return { label: status || "-", className: "bg-black/10 text-black/70 border border-black/10" };
}
