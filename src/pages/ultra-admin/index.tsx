import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  Activity,
  Archive,
  ArrowLeft,
  Building2,
  CircleOff,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users2,
  Layers,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KPICard } from "@/components/KPICard";
import { TokensPanel } from "./TokensPanel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CompanyFeatureToggles } from "@/components/admin/CompanyFeatureToggles";
import { BulkFeatureManager, type BulkFeatureInput } from "@/components/admin/BulkFeatureManager";
import { UsersAccessManager, type ManagedUser } from "@/components/admin/UsersAccessManager";
import {
  FeatureSuggestionsTriage,
  type FeatureSuggestionStatus,
  type ManagedFeatureSuggestion,
} from "@/components/admin/FeatureSuggestionsTriage";
import {
  IncidentsManager,
  type CreateIncidentPayload,
  type ManagedIncident,
  type StatusComponentOption,
} from "@/components/admin/IncidentsManager";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getSafeErrorMessage } from "@/lib/safeError";
import { reportInvokeError } from "@/lib/monitoring";
import { usePageTitle } from "@/hooks/usePageTitle";
import { parseCompanyFeatures, type CompanyFeatures, type SubscriptionPlanSlug } from "@/lib/features";
import type { PilarRole } from "@/lib/roles";
import { env } from "@/lib/env";

type EmpresaRow = {
  id: string;
  nome: string;
  cnpj: string | null;
  status: string;
  features: CompanyFeatures;
  plano: SubscriptionPlanSlug;
  usersCount: number;
};

type EmpresaDetail = EmpresaRow & {
  usuarios: ManagedUser[];
  /** Override por empresa (spec 052); null = usa o padrão do plano. */
  maxProjetosOverride: number | null;
  maxUsuariosOverride: number | null;
  /** Padrão do plano atual, só leitura (mostrado pra dar contexto do override). */
  planoMaxProjetos: number | null;
  planoMaxUsuarios: number | null;
  /** Estado de cobrança (spec 078). "Isenta" é computado: status active sem asaas_subscription_id. */
  cobranca: {
    status: "active" | "trialing" | "overdue" | "canceled" | "expired" | null;
    trialEndsAt: string | null;
    isPaying: boolean;
  };
};

type AuditRow = {
  id: string;
  actor_email: string | null;
  action: string;
  category: string | null;
  target_name: string | null;
  empresa_id: string | null;
  created_at: string;
};

type CrossUserRow = {
  id: string;
  nome: string | null;
  email: string | null;
  role: PilarRole;
  empresaId: string | null;
  empresaNome: string | null;
};

// Mutações de dados (audit_logs): quem criou/editou/apagou o quê na empresa.
type DataAuditRow = {
  id: string;
  actor_email: string | null;
  action: string;
  target_table: string | null;
  created_at: string;
};

type FeatureSuggestionRawRow = {
  id: string;
  titulo: string;
  descricao: string;
  created_at: string;
  status_interno: string;
  created_by: string;
};

const AUDIT_CATEGORIAS = [
  { value: "all", label: "Todas as categorias" },
  { value: "user", label: "Usuários" },
  { value: "empresa", label: "Empresas" },
  { value: "member", label: "Membros" },
  { value: "billing", label: "Cobrança" },
  { value: "impersonation", label: "Impersonation" },
] as const;

const PLAN_LABEL: Record<SubscriptionPlanSlug, string> = {
  starter: "Starter",
  pro: "Pro",
  enterprise: "Enterprise",
};

/** Limite efetivo pra exibição: override vence, senão o padrão do plano, null = ilimitado. */
function formatLimite(override: number | null, planoDefault: number | null): string {
  const efetivo = override ?? planoDefault;
  return efetivo === null ? "Ilimitado" : String(efetivo);
}

/** String do form pro override: vazia = sem override (null, usa o padrão do plano). */
function parseOverride(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

function CapacidadeStat({ label, value, overridden }: { label: string; value: string; overridden?: boolean }) {
  return (
    <div className="rounded-lg border border-black/10 bg-black/[0.015] p-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-black/40">{label}</div>
      <div className="mt-1 flex items-center gap-2">
        <span className="text-lg font-medium text-black/80">{value}</span>
        {overridden && (
          <Badge variant="outline" className="h-5 rounded-full border-brand/30 bg-brand px-2 text-[10px] text-ink">
            Override
          </Badge>
        )}
      </div>
    </div>
  );
}

const ROLE_LABEL: Record<PilarRole, string> = {
  ultra_admin: "Ultra Admin",
  admin: "Admin",
  coordenador: "Coordenador",
  user: "Usuário",
};

const STATUS_LABEL = {
  active: "Ativa",
  suspended: "Suspensa",
  cancelled: "Cancelada",
} as const;

type EmpresaStatus = keyof typeof STATUS_LABEL;

function normalizeRole(role: string | null | undefined): PilarRole {
  if (role === "ultra_admin") return "ultra_admin";
  if (role === "admin") return "admin";
  if (role === "coordenador") return "coordenador";
  return "user";
}

async function edgeFetch(
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

export default function UltraAdmin() {
  usePageTitle("Ultra Admin");
  const [empresas, setEmpresas] = useState<EmpresaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<EmpresaDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [savingFeatures, setSavingFeatures] = useState(false);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<
    "dashboard" | "empresas" | "funcionalidades" | "usuarios" | "atividade" | "feedback" | "status" | "tokens"
  >("dashboard");
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [auditFull, setAuditFull] = useState<AuditRow[]>([]);
  const [auditEmpresa, setAuditEmpresa] = useState<string>("all");
  const [auditCategoria, setAuditCategoria] = useState<string>("all");
  const [users, setUsers] = useState<CrossUserRow[]>([]);
  const [userQuery, setUserQuery] = useState("");
  const [userEmpresa, setUserEmpresa] = useState<string>("all");
  const [userRole, setUserRole] = useState<string>("all");
  const [userToDelete, setUserToDelete] = useState<CrossUserRow | null>(null);
  const [detailAudit, setDetailAudit] = useState<DataAuditRow[]>([]);
  const [suggestionsRaw, setSuggestionsRaw] = useState<FeatureSuggestionRawRow[]>([]);
  const [statusComponents, setStatusComponents] = useState<StatusComponentOption[]>([]);
  const [incidents, setIncidents] = useState<ManagedIncident[]>([]);
  const [creatingIncident, setCreatingIncident] = useState(false);

  const fetchEmpresas = useCallback(async () => {
    setLoading(true);
    try {
      const data = await edgeFetch("ultra-admin-empresas");
      const rows: EmpresaRow[] = (data as EmpresaRow[]).map((e) => ({
        ...e,
        features: parseCompanyFeatures(e.features),
      }));
      setEmpresas(rows);
    } catch (err) {
      reportInvokeError(err, "ultra-admin-empresas:list");
      toast.error("Erro ao carregar empresas", {
        description: getSafeErrorMessage(err, "Tente de novo em instantes."),
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmpresas();
  }, [fetchEmpresas]);

  // Ação em massa (spec 035): liga/desliga uma feature em N empresas via edge
  // function (PUT ?action=bulk-feature, service_role). Recarrega a lista depois
  // para as contagens refletirem o novo estado.
  const handleBulkFeature = useCallback(
    async (input: BulkFeatureInput): Promise<number> => {
      const res = (await edgeFetch("ultra-admin-empresas", {
        method: "PUT",
        params: { action: "bulk-feature" },
        body: input,
      })) as { affected: number; considered: number; failures: number };
      await fetchEmpresas();
      toast.success(`${res.affected} ${res.affected === 1 ? "empresa atualizada" : "empresas atualizadas"}`, {
        description: res.failures > 0 ? `${res.failures} falha(s) ao aplicar` : undefined,
      });
      return res.affected;
    },
    [fetchEmpresas]
  );

  // Ultra admin lê admin_audit_logs e profiles cross-empresa direto (RLS
  // is_ultra_admin). Uso de IA (ai_usage_logs) fica fora do v1: a policy não
  // tem bypass de ultra, exigiria endpoint com service_role.
  const fetchAudit = useCallback(async () => {
    const { data, error } = await supabase
      .from("admin_audit_logs")
      .select("id, actor_email, action, category, target_name, empresa_id, created_at")
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) return;
    setAudit((data ?? []) as AuditRow[]);
  }, []);

  const fetchUsers = useCallback(async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, nome, email, role, empresa_id, empresas(nome)")
      .order("nome", { ascending: true });
    if (error) return;
    setUsers(
      (data ?? []).map((u) => ({
        id: u.id,
        nome: u.nome,
        email: u.email,
        role: normalizeRole(u.role),
        empresaId: u.empresa_id,
        empresaNome: (u.empresas as { nome: string } | null)?.nome ?? null,
      }))
    );
  }, []);

  // Spec 056: feedback enviado pelo modal (bug vai pro Sentry, sugestão cai
  // aqui). Autor resolvido via `users` (já carregado por fetchUsers).
  const fetchSuggestions = useCallback(async () => {
    const { data, error } = await supabase
      .from("feature_suggestions")
      .select("id, titulo, descricao, created_at, status_interno, created_by")
      .order("created_at", { ascending: false });
    if (error) return;
    setSuggestionsRaw((data ?? []) as FeatureSuggestionRawRow[]);
  }, []);

  const handleChangeSuggestionStatus = useCallback(async (id: string, status: FeatureSuggestionStatus) => {
    const { error } = await supabase.from("feature_suggestions").update({ status_interno: status }).eq("id", id);
    if (error) {
      toast.error("Erro ao atualizar sugestão", { description: getSafeErrorMessage(error) });
      return;
    }
    setSuggestionsRaw((prev) => prev.map((s) => (s.id === id ? { ...s, status_interno: status } : s)));
  }, []);

  // Spec 055: status page pública. Componentes são catálogo fixo (seed via
  // migration); incidentes carregam junto com os componentes afetados e a
  // timeline de atualizações.
  const fetchStatusComponents = useCallback(async () => {
    const { data, error } = await supabase
      .from("status_components")
      .select("id, slug, nome_exibicao, ordem")
      .order("ordem");
    if (error) return;
    setStatusComponents((data ?? []).map((c) => ({ id: c.id, slug: c.slug, nomeExibicao: c.nome_exibicao })));
  }, []);

  const fetchIncidents = useCallback(async () => {
    const { data, error } = await supabase
      .from("status_incidents")
      .select(
        "id, titulo, severidade, status, created_at, status_incident_components(component_id), status_incident_updates(id, mensagem, created_at)"
      )
      .order("created_at", { ascending: false });
    if (error) return;
    setIncidents(
      (data ?? []).map((i) => ({
        id: i.id,
        titulo: i.titulo,
        severidade: i.severidade as ManagedIncident["severidade"],
        status: i.status as ManagedIncident["status"],
        createdAt: i.created_at,
        componentIds: (i.status_incident_components ?? []).map((c) => c.component_id),
        updates: (i.status_incident_updates ?? [])
          .slice()
          .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
          .map((u) => ({ id: u.id, mensagem: u.mensagem, createdAt: u.created_at })),
      }))
    );
  }, []);

  const handleCreateIncident = useCallback(
    async (payload: CreateIncidentPayload) => {
      setCreatingIncident(true);
      try {
        const { data: incident, error } = await supabase
          .from("status_incidents")
          .insert({ titulo: payload.titulo, severidade: payload.severidade })
          .select("id")
          .single();
        if (error || !incident) throw error;
        const { error: linkError } = await supabase
          .from("status_incident_components")
          .insert(payload.componentIds.map((component_id) => ({ incident_id: incident.id, component_id })));
        if (linkError) throw linkError;
        toast.success("Incidente criado");
        await fetchIncidents();
      } catch (err) {
        reportInvokeError(err, "ultra-admin:create-incident");
        toast.error("Erro ao criar incidente", { description: getSafeErrorMessage(err) });
      } finally {
        setCreatingIncident(false);
      }
    },
    [fetchIncidents]
  );

  const handleAddIncidentUpdate = useCallback(
    async (incidentId: string, mensagem: string) => {
      const { error } = await supabase.from("status_incident_updates").insert({ incident_id: incidentId, mensagem });
      if (error) {
        toast.error("Erro ao adicionar atualização", { description: getSafeErrorMessage(error) });
        return;
      }
      await fetchIncidents();
    },
    [fetchIncidents]
  );

  const handleResolveIncident = useCallback(
    async (incidentId: string) => {
      const { error } = await supabase
        .from("status_incidents")
        .update({ status: "resolvido", resolved_at: new Date().toISOString() })
        .eq("id", incidentId);
      if (error) {
        toast.error("Erro ao resolver incidente", { description: getSafeErrorMessage(error) });
        return;
      }
      await fetchIncidents();
    },
    [fetchIncidents]
  );

  useEffect(() => {
    fetchAudit();
    fetchUsers();
    fetchSuggestions();
    fetchStatusComponents();
    fetchIncidents();
  }, [fetchAudit, fetchUsers, fetchSuggestions, fetchStatusComponents, fetchIncidents]);

  // Aba Atividade: log administrativo completo, com filtros de empresa e categoria.
  useEffect(() => {
    const run = async () => {
      let q = supabase
        .from("admin_audit_logs")
        .select("id, actor_email, action, category, target_name, empresa_id, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (auditEmpresa !== "all") q = q.eq("empresa_id", auditEmpresa);
      if (auditCategoria !== "all") q = q.eq("category", auditCategoria);
      const { data, error } = await q;
      if (error) return;
      setAuditFull((data ?? []) as AuditRow[]);
    };
    run();
  }, [auditEmpresa, auditCategoria]);

  const usuariosFiltrados = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    return users.filter((u) => {
      if (userEmpresa !== "all" && u.empresaId !== userEmpresa) return false;
      if (userRole !== "all" && u.role !== userRole) return false;
      if (!q) return true;
      return (u.nome ?? "").toLowerCase().includes(q) || (u.email ?? "").toLowerCase().includes(q);
    });
  }, [users, userQuery, userEmpresa, userRole]);

  const suggestions: ManagedFeatureSuggestion[] = useMemo(
    () =>
      suggestionsRaw.map((s) => ({
        id: s.id,
        titulo: s.titulo,
        descricao: s.descricao,
        createdAt: s.created_at,
        authorEmail: users.find((u) => u.id === s.created_by)?.email ?? null,
        statusInterno: s.status_interno as FeatureSuggestionStatus,
      })),
    [suggestionsRaw, users]
  );

  const handleCrossDelete = useCallback(async (user: CrossUserRow) => {
    try {
      await edgeFetch("ultra-admin-usuarios", {
        method: "DELETE",
        body: { user_id: user.id, empresa_id: user.empresaId },
      });
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      toast.success("Usuário removido");
    } catch (err) {
      reportInvokeError(err, "ultra-admin-usuarios:cross-delete");
      toast.error("Erro ao remover usuário", {
        description: getSafeErrorMessage(err, "Tente de novo em instantes."),
      });
    }
  }, []);

  const fetchDetail = useCallback(async (id: string) => {
    setLoadingDetail(true);
    try {
      const raw = (await edgeFetch("ultra-admin-empresas", { params: { id } })) as {
        empresa: {
          id: string;
          nome: string;
          cnpj: string | null;
          status: string | null;
          features: unknown;
          max_projetos_override: number | null;
          max_usuarios_override: number | null;
        };
        plano: SubscriptionPlanSlug | null;
        planoMaxProjetos: number | null;
        planoMaxUsuarios: number | null;
        cobranca: {
          status: "active" | "trialing" | "overdue" | "canceled" | "expired" | null;
          trial_ends_at: string | null;
          is_paying: boolean;
        };
        usuarios: Array<{
          id: string;
          nome: string | null;
          email: string | null;
          role: string | null;
          features: unknown;
        }>;
        convites?: Array<{
          id: string;
          email: string;
          nome: string | null;
          cargo: string | null;
          features: unknown;
        }>;
      };

      const emp: EmpresaDetail = {
        id: raw.empresa.id,
        nome: raw.empresa.nome,
        cnpj: raw.empresa.cnpj,
        status: raw.empresa.status ?? "active",
        features: parseCompanyFeatures(raw.empresa.features),
        plano: raw.plano ?? "starter",
        maxProjetosOverride: raw.empresa.max_projetos_override,
        maxUsuariosOverride: raw.empresa.max_usuarios_override,
        planoMaxProjetos: raw.planoMaxProjetos,
        planoMaxUsuarios: raw.planoMaxUsuarios,
        cobranca: {
          status: raw.cobranca?.status ?? null,
          trialEndsAt: raw.cobranca?.trial_ends_at ?? null,
          isPaying: raw.cobranca?.is_paying ?? false,
        },
        usersCount: raw.usuarios.length,
        usuarios: (
          raw.usuarios as Array<{
            id: string;
            nome: string | null;
            email: string | null;
            role: string | null;
          }>
        ).map((u) => ({
          id: u.id,
          name: u.nome ?? u.email ?? u.id,
          email: u.email ?? "",
          role: normalizeRole(u.role),
        })),
      };

      // Convites pendentes entram na mesma lista como "Pendente"
      for (const c of raw.convites ?? []) {
        emp.usuarios.push({
          id: `convite-${c.id}`,
          inviteId: c.id,
          name: c.nome ?? c.email,
          email: c.email,
          role: normalizeRole(c.cargo),
          isPending: true,
        });
      }
      emp.usersCount = emp.usuarios.filter((u) => !u.isPending).length;

      setDetail(emp);
      setSelectedId(id);

      // Mutações de dados da empresa (audit_logs, ultra lê cross-empresa).
      const { data: aud } = await supabase
        .from("audit_logs")
        .select("id, actor_email, action, target_table, created_at")
        .eq("empresa_id", id)
        .order("created_at", { ascending: false })
        .limit(20);
      setDetailAudit((aud ?? []) as DataAuditRow[]);
    } catch (err) {
      reportInvokeError(err, "ultra-admin-empresas:detail");
      toast.error("Erro ao carregar empresa", {
        description: getSafeErrorMessage(err, "Tente de novo em instantes."),
      });
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const handleChangeFeatures = useCallback(
    async (next: CompanyFeatures) => {
      if (!detail || savingFeatures) return;
      setSavingFeatures(true);
      try {
        await edgeFetch("ultra-admin-empresas", {
          method: "PUT",
          body: { empresa_id: detail.id, features: next },
        });
        setDetail((prev) => (prev ? { ...prev, features: next } : prev));
        setEmpresas((prev) => prev.map((e) => (e.id === detail.id ? { ...e, features: next } : e)));
        toast.success("Features atualizadas");
      } catch (err) {
        reportInvokeError(err, "ultra-admin-empresas:features");
        toast.error("Erro ao salvar features", {
          description: getSafeErrorMessage(err, "Tente de novo em instantes."),
        });
      } finally {
        setSavingFeatures(false);
      }
    },
    [detail, savingFeatures]
  );

  const handleUpdateUser = useCallback(
    async (payload: { id: string; role: "admin" | "coordenador" | "user" }) => {
      if (!detail) return;
      try {
        await edgeFetch("ultra-admin-usuarios", {
          method: "PUT",
          body: { user_id: payload.id, role: payload.role, empresa_id: detail.id },
        });
        setDetail((prev) =>
          prev
            ? {
                ...prev,
                usuarios: prev.usuarios.map((u) => (u.id === payload.id ? { ...u, role: payload.role } : u)),
              }
            : prev
        );
        toast.success("Usuário atualizado");
      } catch (err) {
        reportInvokeError(err, "ultra-admin-usuarios:update");
        toast.error("Erro ao atualizar usuário", {
          description: getSafeErrorMessage(err, "Tente de novo em instantes."),
        });
      }
    },
    [detail]
  );

  const handleDeleteUser = useCallback(
    async (userId: string) => {
      if (!detail) return;
      try {
        await edgeFetch("ultra-admin-usuarios", {
          method: "DELETE",
          body: { user_id: userId, empresa_id: detail.id },
        });
        setDetail((prev) => (prev ? { ...prev, usuarios: prev.usuarios.filter((u) => u.id !== userId) } : prev));
        toast.success("Usuário removido");
      } catch (err) {
        reportInvokeError(err, "ultra-admin-usuarios:delete");
        toast.error("Erro ao remover usuário", {
          description: getSafeErrorMessage(err, "Tente de novo em instantes."),
        });
      }
    },
    [detail]
  );

  const handleInviteUser = useCallback(
    async (payload: { name: string; email: string; role: "admin" | "coordenador" | "user" }) => {
      if (!detail) return;
      try {
        await edgeFetch("ultra-admin-usuarios", {
          body: {
            empresa_id: detail.id,
            email: payload.email,
            nome: payload.name,
            role: payload.role,
          },
        });
        toast.success("Convite enviado");
        await fetchDetail(detail.id);
      } catch (err) {
        reportInvokeError(err, "ultra-admin-usuarios:invite");
        toast.error("Erro ao convidar usuário", {
          description: getSafeErrorMessage(err, "Tente de novo em instantes."),
        });
      }
    },
    [detail, fetchDetail]
  );

  const handleResendInvite = useCallback(
    async (user: ManagedUser) => {
      if (!detail || !user.inviteId) return;
      try {
        await edgeFetch("ultra-admin-usuarios", {
          method: "POST",
          body: { resend: true, convite_id: user.inviteId },
        });
        toast.success("Convite reenviado", { description: `Novo e-mail enviado para ${user.email}.` });
      } catch (err) {
        reportInvokeError(err, "ultra-admin-usuarios:resend-invite");
        toast.error("Erro ao reenviar convite", {
          description: getSafeErrorMessage(err, "Tente de novo em instantes."),
        });
      }
    },
    [detail]
  );

  const handleCancelInvite = useCallback(
    async (user: ManagedUser) => {
      if (!detail || !user.inviteId) return;
      try {
        await edgeFetch("ultra-admin-usuarios", {
          method: "DELETE",
          body: { convite_id: user.inviteId, empresa_id: detail.id },
        });
        setDetail((prev) =>
          prev ? { ...prev, usuarios: prev.usuarios.filter((u) => u.inviteId !== user.inviteId) } : prev
        );
        toast.success("Convite cancelado");
      } catch (err) {
        reportInvokeError(err, "ultra-admin-usuarios:cancel-invite");
        toast.error("Erro ao cancelar convite", {
          description: getSafeErrorMessage(err, "Tente de novo em instantes."),
        });
      }
    },
    [detail]
  );

  const handleUpdateCompany = useCallback(
    async (patch: {
      nome?: string;
      cnpj?: string | null;
      status?: EmpresaStatus;
      plano?: SubscriptionPlanSlug;
      confirm_name?: string;
      max_projetos_override?: number | null;
      max_usuarios_override?: number | null;
    }) => {
      if (!detail) return;
      try {
        await edgeFetch("ultra-admin-empresas", {
          method: "PUT",
          body: { empresa_id: detail.id, ...patch },
        });
        setDetail((prev) =>
          prev
            ? {
                ...prev,
                ...(patch.nome !== undefined ? { nome: patch.nome } : {}),
                ...(patch.cnpj !== undefined ? { cnpj: patch.cnpj } : {}),
                ...(patch.status !== undefined ? { status: patch.status } : {}),
                ...(patch.plano !== undefined ? { plano: patch.plano } : {}),
                ...(patch.max_projetos_override !== undefined
                  ? { maxProjetosOverride: patch.max_projetos_override }
                  : {}),
                ...(patch.max_usuarios_override !== undefined
                  ? { maxUsuariosOverride: patch.max_usuarios_override }
                  : {}),
              }
            : prev
        );
        setEmpresas((prev) =>
          prev.map((e) =>
            e.id === detail.id
              ? {
                  ...e,
                  ...(patch.nome ? { nome: patch.nome } : {}),
                  ...(patch.status ? { status: patch.status } : {}),
                  ...(patch.plano ? { plano: patch.plano } : {}),
                  ...(patch.cnpj !== undefined ? { cnpj: patch.cnpj } : {}),
                }
              : e
          )
        );
        toast.success("Empresa atualizada");
      } catch (err) {
        reportInvokeError(err, "ultra-admin-empresas:update");
        toast.error("Erro ao atualizar empresa", {
          description: getSafeErrorMessage(err, "Tente de novo em instantes."),
        });
      }
    },
    [detail]
  );

  // Converte empresa isenta em pagante (spec 078): inicia o mesmo prazo de
  // graça do trial (aviso 7/3/1 dias, corta acesso se não pagar). Refetch do
  // detalhe porque o retorno da RPC não traz o objeto completo de novo.
  const handleConverterPagante = useCallback(
    async (diasPrazo: number, confirmName: string) => {
      if (!detail) return;
      try {
        await edgeFetch("ultra-admin-empresas", {
          method: "PUT",
          body: { empresa_id: detail.id, converter_pagante: { dias_prazo: diasPrazo, confirm_name: confirmName } },
        });
        toast.success("Empresa em conversão", {
          description: `Prazo de ${diasPrazo} dia(s) iniciado. O acesso continua normal até vencer.`,
        });
        await fetchDetail(detail.id);
      } catch (err) {
        reportInvokeError(err, "ultra-admin-empresas:converter-pagante");
        toast.error("Erro ao converter empresa", {
          description: getSafeErrorMessage(err, "Tente de novo em instantes."),
        });
        throw err;
      }
    },
    [detail, fetchDetail]
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ nome: "", cnpj: "", ownerEmail: "", ownerNome: "" });

  const [editCompanyOpen, setEditCompanyOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [converterPaganteOpen, setConverterPaganteOpen] = useState(false);
  const [companyForm, setCompanyForm] = useState<{
    nome: string;
    cnpj: string;
    status: EmpresaStatus;
    plano: SubscriptionPlanSlug;
    /** String vazia = sem override (usa o padrão do plano). */
    maxProjetosOverride: string;
    maxUsuariosOverride: string;
  }>({ nome: "", cnpj: "", status: "active", plano: "starter", maxProjetosOverride: "", maxUsuariosOverride: "" });

  const resetForm = () => setForm({ nome: "", cnpj: "", ownerEmail: "", ownerNome: "" });

  const handleCreateEmpresa = useCallback(async () => {
    if (!form.nome.trim() || !form.ownerEmail.trim()) {
      toast.error("Informe o nome da empresa e o e-mail do dono");
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.ownerEmail.trim())) {
      toast.error("E-mail do dono inválido");
      return;
    }
    setCreating(true);
    try {
      const res = (await edgeFetch("ultra-admin-empresas", {
        method: "POST",
        body: {
          nome: form.nome.trim(),
          cnpj: form.cnpj.trim() || undefined,
          owner_email: form.ownerEmail.trim(),
          owner_nome: form.ownerNome.trim() || undefined,
        },
      })) as { warning?: string | null };

      if (res.warning) {
        toast.warning("Empresa criada com ressalva", { description: res.warning });
      } else {
        toast.success("Empresa criada", { description: "Convite enviado ao dono por e-mail." });
      }
      setCreateOpen(false);
      resetForm();
      await fetchEmpresas();
    } catch (err) {
      reportInvokeError(err, "ultra-admin-empresas:create");
      toast.error("Erro ao criar empresa", {
        description: getSafeErrorMessage(err, "Tente de novo em instantes."),
      });
    } finally {
      setCreating(false);
    }
  }, [form, fetchEmpresas]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return empresas;
    return empresas.filter((e) => e.nome.toLowerCase().includes(q) || (e.cnpj ?? "").includes(q));
  }, [empresas, query]);

  const totals = useMemo(() => {
    const active = empresas.filter((e) => e.status === "active").length;
    const suspended = empresas.filter((e) => e.status === "suspended").length;
    const users = empresas.reduce((acc, e) => acc + e.usersCount, 0);
    return { total: empresas.length, active, suspended, users };
  }, [empresas]);

  if (selectedId && loadingDetail) {
    return (
      <PageLayout header={<PageHeader title="Gestão Pilar" />}>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-black/40" />
        </div>
      </PageLayout>
    );
  }

  if (selectedId && detail) {
    return (
      <PageLayout
        header={
          <PageHeader title={detail.nome}>
            <div className="flex items-center gap-3">
              <StatusBadge status={detail.status as EmpresaStatus} />
              <Button
                variant="outline"
                size="sm"
                className="rounded-full gap-1.5"
                onClick={() => {
                  setCompanyForm({
                    nome: detail.nome,
                    cnpj: detail.cnpj ?? "",
                    status: detail.status as EmpresaStatus,
                    plano: detail.plano,
                    maxProjetosOverride: detail.maxProjetosOverride === null ? "" : String(detail.maxProjetosOverride),
                    maxUsuariosOverride: detail.maxUsuariosOverride === null ? "" : String(detail.maxUsuariosOverride),
                  });
                  setEditCompanyOpen(true);
                }}
              >
                <Pencil size={14} />
                Editar empresa
              </Button>
              {detail.status !== "cancelled" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full gap-1.5 border-danger-mid-border text-danger-strong hover:bg-danger-soft hover:text-danger-strong"
                  onClick={() => setArchiveOpen(true)}
                >
                  <Archive size={14} />
                  Arquivar empresa
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => {
                  setSelectedId(null);
                  setDetail(null);
                }}
              >
                <ArrowLeft size={14} />
                Voltar para empresas
              </Button>
            </div>
          </PageHeader>
        }
      >
        <Card className="border border-black/5">
          <CardHeader>
            <CardTitle className="text-base">Capacidade</CardTitle>
            <CardDescription>
              O plano define o padrão de limite; o override vale só pra esta empresa (caso negociado fora da tabela
              padrão). Edite em "Editar empresa". Ainda não bloqueia a criação de projeto na prática, ver SPEC 052.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <CapacidadeStat label="Plano" value={PLAN_LABEL[detail.plano]} />
              <CapacidadeStat
                label="Projetos ativos"
                value={formatLimite(detail.maxProjetosOverride, detail.planoMaxProjetos)}
                overridden={detail.maxProjetosOverride !== null}
              />
              <CapacidadeStat
                label="Usuários"
                value={formatLimite(detail.maxUsuariosOverride, detail.planoMaxUsuarios)}
                overridden={detail.maxUsuariosOverride !== null}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-black/5">
          <CardHeader>
            <CardTitle className="text-base">Cobrança</CardTitle>
            <CardDescription>
              Empresa convidada pelo ultra-admin nasce isenta (sem Asaas vinculado). Converter para pagante inicia um
              prazo de graça — acesso normal até vencer, aviso de contagem regressiva pro usuário, corta se não assinar
              (spec 078).
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <CobrancaBadge cobranca={detail.cobranca} />
            {!detail.cobranca.isPaying && detail.cobranca.status === "active" && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => setConverterPaganteOpen(true)}
              >
                Converter para pagante
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="border border-black/5">
          <CardHeader>
            <CardTitle className="text-base">Acesso antecipado</CardTitle>
            <CardDescription>
              Módulo maduro (Financeiro, Projetos, Obras...) é universal, toda empresa já tem, sem toggle. Aqui só dá
              acesso cedo a módulo ainda não pronto pra lançamento geral.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CompanyFeatureToggles value={detail.features} onChange={handleChangeFeatures} disabled={savingFeatures} />
          </CardContent>
        </Card>

        <UsersAccessManager
          users={detail.usuarios}
          currentUserId={null}
          canManage
          onInvite={handleInviteUser}
          onUpdate={handleUpdateUser}
          onDelete={handleDeleteUser}
          onResendInvite={handleResendInvite}
          onCancelInvite={handleCancelInvite}
        />

        <Card className="border border-black/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity size={16} strokeWidth={1.5} className="text-black/50" />
              Atividade da empresa
            </CardTitle>
            <CardDescription>
              Últimas alterações de dados (quem criou, editou ou apagou o quê). Atividade de IA cross-empresa ainda não
              disponível aqui.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {detailAudit.length === 0 ? (
              <p className="py-6 text-center text-sm text-black/50">Nenhuma alteração registrada.</p>
            ) : (
              <ul className="divide-y divide-black/5">
                {detailAudit.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div className="min-w-0 truncate">
                      <span className="font-medium text-black/80">{a.actor_email ?? "sistema"}</span>
                      <span className="text-black/50"> · {a.action}</span>
                      {a.target_table && <span className="text-black/50"> em {a.target_table}</span>}
                    </div>
                    <time className="flex-shrink-0 text-xs text-black/40">
                      {new Date(a.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <EditCompanyDialog
          open={editCompanyOpen}
          onOpenChange={setEditCompanyOpen}
          form={companyForm}
          setForm={setCompanyForm}
          confirmName={detail.nome}
          onSave={async (confirmName) => {
            await handleUpdateCompany({
              nome: companyForm.nome.trim() || undefined,
              cnpj: companyForm.cnpj.trim() || null,
              status: companyForm.status,
              plano: companyForm.plano,
              confirm_name: confirmName,
              max_projetos_override: parseOverride(companyForm.maxProjetosOverride),
              max_usuarios_override: parseOverride(companyForm.maxUsuariosOverride),
            });
            setEditCompanyOpen(false);
          }}
        />

        <ArchiveCompanyDialog
          open={archiveOpen}
          onOpenChange={setArchiveOpen}
          companyName={detail.nome}
          onConfirm={async (confirmName) => {
            await handleUpdateCompany({ status: "cancelled", confirm_name: confirmName });
            setArchiveOpen(false);
          }}
        />

        <ConverterParaPaganteDialog
          open={converterPaganteOpen}
          onOpenChange={setConverterPaganteOpen}
          companyName={detail.nome}
          onConfirm={async (diasPrazo, confirmName) => {
            await handleConverterPagante(diasPrazo, confirmName);
            setConverterPaganteOpen(false);
          }}
        />
      </PageLayout>
    );
  }

  return (
    <PageLayout
      header={
        <PageHeader title="Gestão Pilar">
          <Button variant="brand" className="rounded-full gap-2" onClick={() => setCreateOpen(true)}>
            <Plus size={16} />
            Criar empresa
          </Button>
        </PageHeader>
      }
    >
      <Tabs
        value={tab}
        onValueChange={(v) =>
          setTab(
            v as
              "dashboard" | "empresas" | "funcionalidades" | "usuarios" | "atividade" | "feedback" | "status" | "tokens"
          )
        }
      >
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="empresas">Empresas</TabsTrigger>
          <TabsTrigger value="funcionalidades">Funcionalidades</TabsTrigger>
          <TabsTrigger value="usuarios">Usuários</TabsTrigger>
          <TabsTrigger value="atividade">Atividade</TabsTrigger>
          <TabsTrigger value="feedback">Feedback</TabsTrigger>
          <TabsTrigger value="status">Status</TabsTrigger>
          <TabsTrigger value="tokens">Tokens</TabsTrigger>
        </TabsList>

        <TabsContent value="tokens" className="mt-4">
          <TokensPanel />
        </TabsContent>

        <TabsContent value="dashboard" className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KPICard
              icon={Layers}
              label="Total de empresas"
              value={`${totals.total}`}
              tone="neutral"
              loading={loading}
            />
            <KPICard
              icon={Building2}
              label="Empresas ativas"
              value={`${totals.active}`}
              tone="neutral"
              loading={loading}
            />
            <KPICard
              icon={CircleOff}
              label="Suspensas"
              value={`${totals.suspended}`}
              tone="neutral"
              loading={loading}
            />
            <KPICard icon={Users2} label="Usuários totais" value={`${totals.users}`} tone="neutral" loading={loading} />
          </div>

          <Card className="border border-black/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity size={16} strokeWidth={1.5} className="text-black/50" />
                Atividade recente
              </CardTitle>
              <CardDescription>
                Ações administrativas em todas as empresas (convites, acessos, billing, impersonation).
              </CardDescription>
            </CardHeader>
            <CardContent>
              {audit.length === 0 ? (
                <p className="py-6 text-center text-sm text-black/50">Nenhuma atividade registrada ainda.</p>
              ) : (
                <ul className="divide-y divide-black/5">
                  {audit.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <div className="min-w-0 truncate">
                        <span className="font-medium text-black/80">{a.actor_email ?? "sistema"}</span>
                        <span className="text-black/50"> · {a.action}</span>
                        {a.target_name && <span className="text-black/50"> → {a.target_name}</span>}
                      </div>
                      <time className="flex-shrink-0 text-xs text-black/40">
                        {new Date(a.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                      </time>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="empresas" className="mt-4">
          <Card className="border border-black/5">
            <CardHeader>
              <CardTitle className="text-base">Empresas</CardTitle>
              <CardDescription>Clique para ver detalhes ou editar features.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-black/40"
                  strokeWidth={1.5}
                />
                <Input
                  placeholder="Buscar por nome ou CNPJ"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-black/40" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empresa</TableHead>
                      <TableHead>CNPJ</TableHead>
                      <TableHead>Plano</TableHead>
                      <TableHead>Usuários</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-20 text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-black/50">
                          Nenhuma empresa encontrada.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((e) => (
                        <TableRow
                          key={e.id}
                          onClick={() => fetchDetail(e.id)}
                          className="cursor-pointer hover:bg-black/[0.02]"
                        >
                          <TableCell className="font-medium">{e.nome}</TableCell>
                          <TableCell className="text-black/60">{e.cnpj ?? "—"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="h-6 rounded-full text-[11px]">
                              {PLAN_LABEL[e.plano]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-black/70">{e.usersCount}</TableCell>
                          <TableCell>
                            <StatusBadge status={e.status as EmpresaStatus} />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-full"
                              onClick={(ev) => {
                                ev.stopPropagation();
                                fetchDetail(e.id);
                              }}
                            >
                              Abrir
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="funcionalidades" className="mt-4">
          <Card className="border border-black/5">
            <CardHeader>
              <CardTitle className="text-base">Funcionalidades</CardTitle>
              <CardDescription>
                Ligue ou desligue uma funcionalidade para todas as empresas de uma vez. Aqui a feature é controle de
                rollout, não de plano.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center gap-2 py-8 text-sm text-black/50">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando empresas…
                </div>
              ) : (
                <BulkFeatureManager empresas={empresas} onApply={handleBulkFeature} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usuarios" className="mt-4">
          <Card className="border border-black/5">
            <CardHeader>
              <CardTitle className="text-base">Usuários</CardTitle>
              <CardDescription>Todos os usuários da plataforma, de todas as empresas.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <Search
                    size={16}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-black/40"
                    strokeWidth={1.5}
                  />
                  <Input
                    placeholder="Buscar por nome ou e-mail"
                    value={userQuery}
                    onChange={(e) => setUserQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={userEmpresa} onValueChange={setUserEmpresa}>
                  <SelectTrigger className="sm:w-52">
                    <SelectValue placeholder="Empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as empresas</SelectItem>
                    {empresas.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={userRole} onValueChange={setUserRole}>
                  <SelectTrigger className="sm:w-40">
                    <SelectValue placeholder="Papel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os papéis</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="user">Usuário</SelectItem>
                    <SelectItem value="ultra_admin">Ultra Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Papel</TableHead>
                    <TableHead className="w-32 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usuariosFiltrados.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-black/50">
                        Nenhum usuário encontrado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    usuariosFiltrados.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div className="font-medium">{u.nome ?? "—"}</div>
                          <div className="text-xs text-black/50">{u.email ?? "—"}</div>
                        </TableCell>
                        <TableCell className="text-black/70">{u.empresaNome ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="h-6 rounded-full text-[11px]">
                            {ROLE_LABEL[u.role]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1.5">
                            {u.empresaId && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="rounded-full gap-1.5"
                                onClick={() => fetchDetail(u.empresaId as string)}
                              >
                                <ExternalLink size={13} />
                                Abrir empresa
                              </Button>
                            )}
                            {u.role !== "ultra_admin" && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="rounded-full border-danger-mid-border text-danger-strong hover:bg-danger-soft hover:text-danger-strong"
                                onClick={() => setUserToDelete(u)}
                                aria-label="Remover usuário"
                              >
                                <Trash2 size={13} />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="atividade" className="mt-4">
          <Card className="border border-black/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity size={16} strokeWidth={1.5} className="text-black/50" />
                Log administrativo
              </CardTitle>
              <CardDescription>
                Ações administrativas em todas as empresas. Últimas 100, filtráveis. Atividade de IA por empresa fica no
                detalhe da empresa.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row">
                <Select value={auditEmpresa} onValueChange={setAuditEmpresa}>
                  <SelectTrigger className="sm:w-52">
                    <SelectValue placeholder="Empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as empresas</SelectItem>
                    {empresas.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={auditCategoria} onValueChange={setAuditCategoria}>
                  <SelectTrigger className="sm:w-52">
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {AUDIT_CATEGORIAS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-36">Quando</TableHead>
                    <TableHead>Ator</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Alvo</TableHead>
                    <TableHead>Empresa</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditFull.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-black/50">
                        Nenhuma atividade registrada para este filtro.
                      </TableCell>
                    </TableRow>
                  ) : (
                    auditFull.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="text-xs text-black/50">
                          {new Date(a.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                        </TableCell>
                        <TableCell className="text-black/70">{a.actor_email ?? "sistema"}</TableCell>
                        <TableCell className="font-medium">{a.action}</TableCell>
                        <TableCell>
                          {a.category && (
                            <Badge variant="outline" className="h-6 rounded-full text-[11px]">
                              {a.category}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-black/60">{a.target_name ?? "—"}</TableCell>
                        <TableCell className="text-black/60">
                          {empresas.find((e) => e.id === a.empresa_id)?.nome ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="feedback" className="mt-4">
          <FeatureSuggestionsTriage suggestions={suggestions} onChangeStatus={handleChangeSuggestionStatus} />
        </TabsContent>

        <TabsContent value="status" className="mt-4">
          <IncidentsManager
            components={statusComponents}
            incidents={incidents}
            isCreating={creatingIncident}
            onCreateIncident={handleCreateIncident}
            onAddUpdate={handleAddIncidentUpdate}
            onResolve={handleResolveIncident}
          />
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!userToDelete} onOpenChange={(o) => !o && setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              {userToDelete?.nome ?? userToDelete?.email} perde o acesso à plataforma. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => {
                if (userToDelete) handleCrossDelete(userToDelete);
                setUserToDelete(null);
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={createOpen}
        onOpenChange={(o) => {
          if (creating) return;
          setCreateOpen(o);
          if (!o) resetForm();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Criar empresa</DialogTitle>
            <DialogDescription>
              A empresa é criada com o plano Starter ativo e o dono recebe um convite de administrador por e-mail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="empresa-nome">Nome da empresa *</Label>
              <Input
                id="empresa-nome"
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                placeholder="Ex.: Alfa Engenharia"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="empresa-cnpj">CNPJ (opcional)</Label>
              <Input
                id="empresa-cnpj"
                value={form.cnpj}
                onChange={(e) => setForm((f) => ({ ...f, cnpj: e.target.value }))}
                placeholder="00.000.000/0000-00"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="owner-email">E-mail do dono/admin *</Label>
              <Input
                id="owner-email"
                type="email"
                value={form.ownerEmail}
                onChange={(e) => setForm((f) => ({ ...f, ownerEmail: e.target.value }))}
                placeholder="dono@empresa.com.br"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="owner-nome">Nome do dono (opcional)</Label>
              <Input
                id="owner-nome"
                value={form.ownerNome}
                onChange={(e) => setForm((f) => ({ ...f, ownerNome: e.target.value }))}
                placeholder="Como aparecerá no convite"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateOpen(false);
                resetForm();
              }}
              disabled={creating}
            >
              Cancelar
            </Button>
            <Button variant="brand" onClick={handleCreateEmpresa} disabled={creating}>
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Criando…
                </>
              ) : (
                "Criar e convidar dono"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}

function StatusBadge({ status }: { status: EmpresaStatus }) {
  const variants: Record<EmpresaStatus, string> = {
    active: "border-success/30 bg-success/10 text-success-strong",
    suspended: "border-warning/30 bg-warning/10 text-warning-strong",
    cancelled: "border-danger/30 bg-danger/10 text-danger-strong",
  };
  return (
    <Badge variant="outline" className={`h-6 rounded-full text-[11px] ${variants[status] ?? ""}`}>
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

type CompanyForm = {
  nome: string;
  cnpj: string;
  status: EmpresaStatus;
  plano: SubscriptionPlanSlug;
  maxProjetosOverride: string;
  maxUsuariosOverride: string;
};

function EditCompanyDialog({
  open,
  onOpenChange,
  form,
  setForm,
  confirmName,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  form: CompanyForm;
  setForm: Dispatch<SetStateAction<CompanyForm>>;
  confirmName: string;
  onSave: (confirmName?: string) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const dangerous = form.status !== "active";
  const confirmMatches = confirmText.trim() === (confirmName ?? "").trim();

  // Reseta o campo de confirmação sempre que o dialog abre/fecha.
  useEffect(() => {
    if (!open) setConfirmText("");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar empresa</DialogTitle>
          <DialogDescription>
            Dados cadastrais, status de acesso, plano e capacidade. Suspender ou cancelar bloqueia o acesso da empresa.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="edit-nome">Nome</Label>
            <Input
              id="edit-nome"
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-cnpj">CNPJ</Label>
            <Input
              id="edit-cnpj"
              value={form.cnpj}
              onChange={(e) => setForm((f) => ({ ...f, cnpj: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as EmpresaStatus }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativa</SelectItem>
                  <SelectItem value="suspended">Suspensa</SelectItem>
                  <SelectItem value="cancelled">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Plano</Label>
              <Select
                value={form.plano}
                onValueChange={(v) => setForm((f) => ({ ...f, plano: v as SubscriptionPlanSlug }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="starter">Starter</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-max-projetos">Override de projetos</Label>
              <Input
                id="edit-max-projetos"
                type="number"
                min={0}
                placeholder="usa o padrão do plano"
                value={form.maxProjetosOverride}
                onChange={(e) => setForm((f) => ({ ...f, maxProjetosOverride: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-max-usuarios">Override de usuários</Label>
              <Input
                id="edit-max-usuarios"
                type="number"
                min={0}
                placeholder="usa o padrão do plano"
                value={form.maxUsuariosOverride}
                onChange={(e) => setForm((f) => ({ ...f, maxUsuariosOverride: e.target.value }))}
              />
            </div>
          </div>
          <p className="text-xs text-black/40">Deixe em branco pra voltar a usar o limite do plano.</p>
          {dangerous && (
            <div className="space-y-2 rounded-md border border-danger-mid-border bg-danger-soft px-3 py-2.5">
              <p className="text-xs text-danger-strong">
                {form.status === "suspended"
                  ? "Suspensa: os usuários da empresa perdem o acesso até reativar."
                  : "Cancelada: o acesso é encerrado. Use com cuidado."}
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-empresa" className="text-xs text-danger-strong">
                  Digite <span className="font-semibold">{confirmName}</span> para confirmar
                </Label>
                <Input
                  id="confirm-empresa"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={confirmName}
                  autoComplete="off"
                />
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            variant="brand"
            onClick={async () => {
              setSaving(true);
              try {
                await onSave(dangerous ? confirmText : undefined);
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving || !form.nome.trim() || (dangerous && !confirmMatches)}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ArchiveCompanyDialog({
  open,
  onOpenChange,
  companyName,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  companyName: string;
  onConfirm: (confirmName: string) => Promise<void>;
}) {
  const [confirmText, setConfirmText] = useState("");
  const [saving, setSaving] = useState(false);
  const matches = confirmText.trim() === (companyName ?? "").trim();

  // Reseta o campo de confirmação sempre que o dialog fecha.
  useEffect(() => {
    if (!open) setConfirmText("");
  }, [open]);

  return (
    <AlertDialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Arquivar {companyName}?</AlertDialogTitle>
          <AlertDialogDescription>
            A empresa é marcada como cancelada e sai do fluxo. Os usuários perdem o acesso na hora. Os dados ficam
            preservados no banco, e a ação pode ser revertida reativando a empresa em "Editar empresa".
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="archive-confirm" className="text-xs">
            Digite <span className="font-semibold">{companyName}</span> para confirmar
          </Label>
          <Input
            id="archive-confirm"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={companyName}
            autoComplete="off"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={async (e) => {
              e.preventDefault();
              if (!matches) return;
              setSaving(true);
              try {
                await onConfirm(confirmText.trim());
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving || !matches}
            className="bg-destructive hover:bg-destructive/90 focus:ring-destructive"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Arquivar empresa"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// Badge de estado de cobrança (spec 078). "Isenta"/"Pagante" são computados
// no backend (ver GET detalhe); os demais espelham o status de assinatura.
function CobrancaBadge({ cobranca }: { cobranca: EmpresaDetail["cobranca"] }) {
  if (cobranca.isPaying) {
    return <Badge className="bg-fill-success text-fill-success-foreground">Pagante</Badge>;
  }
  if (cobranca.status === "trialing" && cobranca.trialEndsAt) {
    const diasRestantes = Math.ceil((new Date(cobranca.trialEndsAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    return (
      <Badge className="bg-fill-warning text-fill-warning-foreground">
        Em conversão · {diasRestantes > 0 ? `expira em ${diasRestantes}d` : "expira hoje"}
      </Badge>
    );
  }
  if (cobranca.status === "expired" || cobranca.status === "canceled" || cobranca.status === "overdue") {
    return <Badge className="bg-fill-danger text-fill-danger-foreground">Vencido</Badge>;
  }
  return <Badge variant="outline">Isenta</Badge>;
}

function ConverterParaPaganteDialog({
  open,
  onOpenChange,
  companyName,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  companyName: string;
  onConfirm: (diasPrazo: number, confirmName: string) => Promise<void>;
}) {
  const [diasPrazo, setDiasPrazo] = useState("14");
  const [confirmText, setConfirmText] = useState("");
  const [saving, setSaving] = useState(false);
  const diasValido = Number.isInteger(Number(diasPrazo)) && Number(diasPrazo) >= 1 && Number(diasPrazo) <= 365;
  const nomeConfere = confirmText.trim() === (companyName ?? "").trim();

  // Reseta os campos sempre que o dialog fecha.
  useEffect(() => {
    if (!open) {
      setDiasPrazo("14");
      setConfirmText("");
    }
  }, [open]);

  return (
    <AlertDialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Converter {companyName} para pagante?</AlertDialogTitle>
          <AlertDialogDescription>
            A empresa continua com acesso normal durante o prazo, com um aviso de contagem regressiva pro usuário. Se
            ninguém completar a assinatura até o fim do prazo, o acesso é cortado (mesmo mecanismo do trial).
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="converter-dias" className="text-xs">
              Prazo de graça (dias)
            </Label>
            <Input
              id="converter-dias"
              type="number"
              min={1}
              max={365}
              value={diasPrazo}
              onChange={(e) => setDiasPrazo(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="converter-confirm" className="text-xs">
              Digite <span className="font-semibold">{companyName}</span> para confirmar
            </Label>
            <Input
              id="converter-confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={companyName}
              autoComplete="off"
            />
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={async (e) => {
              e.preventDefault();
              if (!nomeConfere || !diasValido) return;
              setSaving(true);
              try {
                await onConfirm(Number(diasPrazo), confirmText.trim());
              } catch {
                // handleConverterPagante já mostrou o toast de erro; dialog fica aberto pra retry.
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving || !nomeConfere || !diasValido}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Converter para pagante"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
