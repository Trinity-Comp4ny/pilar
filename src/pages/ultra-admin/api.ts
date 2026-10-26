import { supabase } from "@/integrations/supabase/client";
import { env } from "@/lib/env";
import { parseCompanyFeatures, type CompanyFeatures, type SubscriptionPlanSlug } from "@/lib/features";
import type { PilarRole } from "@/lib/roles";
import type { ManagedUser } from "@/components/admin/UsersAccessManager";

export type CobrancaStatus = "active" | "trialing" | "overdue" | "canceled" | "expired" | null;

/** Estado de cobrança (spec 078/104). "Convidada" é computado no backend: não paga e não está em prazo. */
export type Cobranca = {
  status: CobrancaStatus;
  trialEndsAt: string | null;
  isPaying: boolean;
  convidada: boolean;
};

type CobrancaRaw = {
  status: CobrancaStatus;
  trial_ends_at: string | null;
  is_paying: boolean;
  convidada?: boolean;
};

export type EmpresaStatus = "active" | "suspended" | "cancelled";

export type EmpresaRow = {
  id: string;
  nome: string;
  cnpj: string | null;
  status: EmpresaStatus;
  features: CompanyFeatures;
  plano: SubscriptionPlanSlug;
  usersCount: number;
  cobranca: Cobranca;
  createdAt: string | null;
  /** Login mais recente entre os usuários da empresa (SPEC 117). */
  ultimoAcesso: string | null;
};

export type EmpresaDetalhe = EmpresaRow & {
  usuarios: Array<ManagedUser & { lastSignInAt?: string | null }>;
  maxProjetosOverride: number | null;
  maxUsuariosOverride: number | null;
  planoMaxProjetos: number | null;
  planoMaxUsuarios: number | null;
  projetosAtivos: number | null;
  interna: boolean;
};

export type UsuarioPlataforma = {
  id: string;
  nome: string | null;
  email: string | null;
  role: PilarRole;
  empresaId: string | null;
  empresaNome: string | null;
  createdAt: string | null;
  lastSignInAt: string | null;
};

export const PLAN_LABEL: Record<SubscriptionPlanSlug, string> = {
  starter: "Starter",
  pro: "Pro",
  enterprise: "Enterprise",
};

export const ROLE_LABEL: Record<PilarRole, string> = {
  ultra_admin: "Ultra admin",
  admin: "Admin",
  coordenador: "Coordenador",
  user: "Usuário",
};

export function normalizeRole(role: string | null | undefined): PilarRole {
  if (role === "ultra_admin") return "ultra_admin";
  if (role === "admin") return "admin";
  if (role === "coordenador") return "coordenador";
  return "user";
}

function normalizeStatus(status: string | null | undefined): EmpresaStatus {
  if (status === "suspended" || status === "cancelled") return status;
  return "active";
}

function parseCobranca(raw: CobrancaRaw | undefined): Cobranca {
  return {
    status: raw?.status ?? null,
    trialEndsAt: raw?.trial_ends_at ?? null,
    isPaying: raw?.is_paying ?? false,
    convidada: raw?.convidada ?? false,
  };
}

export async function edgeFetch(
  fn: string,
  options: { method?: string; body?: unknown; params?: Record<string, string> } = {}
): Promise<unknown> {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  if (!token) throw new Error("Sessão expirada");

  const base = `${env.VITE_SUPABASE_URL}/functions/v1/${fn}`;
  const url = options.params ? `${base}?${new URLSearchParams(options.params)}` : base;
  const method = options.method ?? (options.body ? "POST" : "GET");

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Origin: window.location.origin,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `HTTP ${res.status}`);
  return json;
}

type EmpresaListRaw = {
  id: string;
  nome: string;
  cnpj: string | null;
  status: string | null;
  features: unknown;
  plano?: SubscriptionPlanSlug | null;
  usersCount?: number;
  cobranca?: CobrancaRaw;
  created_at?: string | null;
  ultimo_acesso?: string | null;
};

export async function listarEmpresas(): Promise<EmpresaRow[]> {
  const data = (await edgeFetch("ultra-admin-empresas")) as EmpresaListRaw[];
  return data
    .filter((e) => e.nome !== "[empresa excluida]")
    .map((e) => ({
      id: e.id,
      nome: e.nome,
      cnpj: e.cnpj,
      status: normalizeStatus(e.status),
      features: parseCompanyFeatures(e.features),
      plano: e.plano ?? "starter",
      usersCount: e.usersCount ?? 0,
      cobranca: parseCobranca(e.cobranca),
      createdAt: e.created_at ?? null,
      ultimoAcesso: e.ultimo_acesso ?? null,
    }));
}

type EmpresaDetalheRaw = {
  empresa: {
    id: string;
    nome: string;
    cnpj: string | null;
    status: string | null;
    features: unknown;
    created_at?: string | null;
    max_projetos_override: number | null;
    max_usuarios_override: number | null;
    /** SPEC 129: empresa da equipe ou de teste, fora dos números do Time. Opcional: edge antiga não manda. */
    interna?: boolean | null;
  };
  plano: SubscriptionPlanSlug | null;
  planoMaxProjetos: number | null;
  planoMaxUsuarios: number | null;
  cobranca: CobrancaRaw;
  uso?: { projetos_ativos?: number; ultimo_acesso?: string | null };
  usuarios: Array<{
    id: string;
    nome: string | null;
    email: string | null;
    role: string | null;
    financeiro_delegado: boolean | null;
    equipe_delegado: boolean | null;
    metas_delegado: boolean | null;
    last_sign_in_at?: string | null;
  }>;
  convites?: Array<{ id: string; email: string; nome: string | null; cargo: string | null }>;
};

export async function buscarEmpresa(id: string): Promise<EmpresaDetalhe> {
  const raw = (await edgeFetch("ultra-admin-empresas", { params: { id } })) as EmpresaDetalheRaw;

  const usuarios: EmpresaDetalhe["usuarios"] = raw.usuarios.map((u) => ({
    id: u.id,
    name: u.nome ?? u.email ?? u.id,
    email: u.email ?? "",
    role: normalizeRole(u.role),
    financeiroDelegado: u.financeiro_delegado ?? false,
    equipeDelegado: u.equipe_delegado ?? false,
    metasDelegado: u.metas_delegado ?? false,
    lastSignInAt: u.last_sign_in_at ?? null,
  }));
  // Convites pendentes entram na mesma lista como "Pendente".
  for (const c of raw.convites ?? []) {
    usuarios.push({
      id: `convite-${c.id}`,
      inviteId: c.id,
      name: c.nome ?? c.email,
      email: c.email,
      role: normalizeRole(c.cargo),
      isPending: true,
    });
  }

  return {
    id: raw.empresa.id,
    nome: raw.empresa.nome,
    cnpj: raw.empresa.cnpj,
    status: normalizeStatus(raw.empresa.status),
    features: parseCompanyFeatures(raw.empresa.features),
    plano: raw.plano ?? "starter",
    cobranca: parseCobranca(raw.cobranca),
    createdAt: raw.empresa.created_at ?? null,
    ultimoAcesso: raw.uso?.ultimo_acesso ?? null,
    projetosAtivos: raw.uso?.projetos_ativos ?? null,
    maxProjetosOverride: raw.empresa.max_projetos_override,
    maxUsuariosOverride: raw.empresa.max_usuarios_override,
    interna: raw.empresa.interna ?? false,
    planoMaxProjetos: raw.planoMaxProjetos,
    planoMaxUsuarios: raw.planoMaxUsuarios,
    usersCount: usuarios.filter((u) => !u.isPending).length,
    usuarios,
  };
}

type UsuarioRaw = {
  id: string;
  nome: string | null;
  email: string | null;
  role: string | null;
  empresa_id: string | null;
  empresa_nome?: string | null;
  created_at?: string | null;
  last_sign_in_at?: string | null;
};

/**
 * Usuários da plataforma com último login (edge, SPEC 117). Se a edge ainda
 * não tem o GET (janela entre merge e deploy), cai na leitura direta de
 * profiles, sem último login.
 */
export async function listarUsuarios(): Promise<UsuarioPlataforma[]> {
  let raw: UsuarioRaw[];
  try {
    raw = (await edgeFetch("ultra-admin-usuarios")) as UsuarioRaw[];
    if (!Array.isArray(raw)) throw new Error("resposta inesperada");
  } catch {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, nome, email, role, empresa_id, created_at, empresas(nome)")
      .is("desativado_em", null)
      .order("nome", { ascending: true });
    if (error) throw error;
    raw = (data ?? []).map((u) => ({
      id: u.id,
      nome: u.nome,
      email: u.email,
      role: u.role,
      empresa_id: u.empresa_id,
      empresa_nome: (u.empresas as { nome: string } | null)?.nome ?? null,
      created_at: u.created_at,
    }));
  }
  return raw.map((u) => ({
    id: u.id,
    nome: u.nome,
    email: u.email,
    role: normalizeRole(u.role),
    empresaId: u.empresa_id,
    empresaNome: u.empresa_nome ?? null,
    createdAt: u.created_at ?? null,
    lastSignInAt: u.last_sign_in_at ?? null,
  }));
}
