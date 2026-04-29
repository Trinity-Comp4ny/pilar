import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Building2, CircleOff, Loader2, RefreshCw, Search, Users2, Layers } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CompanyFeatureToggles } from "@/components/admin/CompanyFeatureToggles";
import { UsersAccessManager, type ManagedUser } from "@/components/admin/UsersAccessManager";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  parseCompanyFeatures,
  parseUserFeatures,
  type CompanyFeatures,
  type SubscriptionPlanSlug,
} from "@/lib/features";
import type { PilarRole } from "@/lib/roles";

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
};

const PLAN_LABEL: Record<SubscriptionPlanSlug, string> = {
  starter: "Starter",
  pro: "Pro",
  enterprise: "Enterprise",
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
  return "user";
}

async function edgeFetch(
  fn: string,
  options: { method?: string; body?: unknown; params?: Record<string, string> } = {}
): Promise<unknown> {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  if (!token) throw new Error("Sessão expirada");

  const base = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fn}`;
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
  const [empresas, setEmpresas] = useState<EmpresaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<EmpresaDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [query, setQuery] = useState("");

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
      toast.error("Erro ao carregar empresas", {
        description: err instanceof Error ? err.message : "Erro inesperado",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmpresas();
  }, [fetchEmpresas]);

  const fetchDetail = useCallback(async (id: string) => {
    setLoadingDetail(true);
    try {
      const raw = (await edgeFetch("ultra-admin-empresas", { params: { id } })) as {
        empresa: { id: string; nome: string; cnpj: string | null; status: string | null; features: unknown };
        plano: SubscriptionPlanSlug | null;
        usuarios: Array<{
          id: string;
          nome: string | null;
          email: string | null;
          role: string | null;
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
        usersCount: raw.usuarios.length,
        usuarios: (
          raw.usuarios as Array<{
            id: string;
            nome: string | null;
            email: string | null;
            role: string | null;
            features: unknown;
          }>
        ).map((u) => ({
          id: u.id,
          name: u.nome ?? u.email ?? u.id,
          email: u.email ?? "",
          role: normalizeRole(u.role),
          features: parseUserFeatures(u.features),
        })),
      };

      setDetail(emp);
      setSelectedId(id);
    } catch (err) {
      toast.error("Erro ao carregar empresa", {
        description: err instanceof Error ? err.message : "Erro inesperado",
      });
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const handleChangeFeatures = useCallback(
    async (next: CompanyFeatures) => {
      if (!detail) return;
      try {
        await edgeFetch("ultra-admin-empresas", {
          method: "PUT",
          body: { empresa_id: detail.id, features: next },
        });
        setDetail((prev) => (prev ? { ...prev, features: next } : prev));
        setEmpresas((prev) => prev.map((e) => (e.id === detail.id ? { ...e, features: next } : e)));
        toast.success("Features atualizadas");
      } catch (err) {
        toast.error("Erro ao salvar features", {
          description: err instanceof Error ? err.message : "Erro inesperado",
        });
      }
    },
    [detail]
  );

  const handleUpdateUser = useCallback(
    async (payload: { id: string; role: "admin" | "user"; features: import("@/lib/features").UserFeatures }) => {
      if (!detail) return;
      try {
        await edgeFetch("ultra-admin-usuarios", {
          method: "PUT",
          body: { user_id: payload.id, role: payload.role, features: payload.features, empresa_id: detail.id },
        });
        setDetail((prev) =>
          prev
            ? {
                ...prev,
                usuarios: prev.usuarios.map((u) =>
                  u.id === payload.id ? { ...u, role: payload.role, features: payload.features } : u
                ),
              }
            : prev
        );
        toast.success("Usuário atualizado");
      } catch (err) {
        toast.error("Erro ao atualizar usuário", {
          description: err instanceof Error ? err.message : "Erro inesperado",
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
        toast.error("Erro ao remover usuário", {
          description: err instanceof Error ? err.message : "Erro inesperado",
        });
      }
    },
    [detail]
  );

  const handleInviteUser = useCallback(
    async (payload: {
      name: string;
      email: string;
      role: "admin" | "user";
      features: import("@/lib/features").UserFeatures;
    }) => {
      if (!detail) return;
      try {
        await edgeFetch("ultra-admin-usuarios", {
          body: {
            empresa_id: detail.id,
            email: payload.email,
            nome: payload.name,
            role: payload.role,
            features: payload.features,
          },
        });
        setDetail((prev) =>
          prev
            ? {
                ...prev,
                usuarios: [
                  ...prev.usuarios,
                  {
                    id: `pending-${Date.now()}`,
                    name: payload.name,
                    email: payload.email,
                    role: payload.role,
                    features: payload.features,
                    isPending: true,
                  },
                ],
              }
            : prev
        );
        toast.success("Convite enviado");
      } catch (err) {
        toast.error("Erro ao convidar usuário", {
          description: err instanceof Error ? err.message : "Erro inesperado",
        });
      }
    },
    [detail]
  );

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
      <PageLayout
        header={<PageHeader title="Gestão Pilar" description="Visão cross-empresa. Apenas ultra admins têm acesso." />}
      >
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-black/40" />
        </div>
      </PageLayout>
    );
  }

  if (selectedId && detail) {
    const usersByFeature = detail.usuarios.reduce(
      (acc, u) => {
        if (u.role !== "user") return acc;
        for (const key of Object.keys(u.features)) {
          acc[key] = (acc[key] ?? 0) + 1;
        }
        return acc;
      },
      {} as Record<string, number>
    );

    return (
      <PageLayout
        header={
          <PageHeader
            title={detail.nome}
            description={`${detail.cnpj ?? "CNPJ não cadastrado"} · ${PLAN_LABEL[detail.plano]}`}
          >
            <div className="flex items-center gap-3">
              <StatusBadge status={detail.status as EmpresaStatus} />
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
            <CardTitle className="text-base">Features da empresa</CardTitle>
            <CardDescription>
              Como ultra admin, você pode ativar qualquer feature — inclusive add-ons ainda não contratados.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CompanyFeatureToggles
              value={detail.features}
              onChange={handleChangeFeatures}
              currentPlan={detail.plano}
              usersByFeature={usersByFeature}
            />
          </CardContent>
        </Card>

        <UsersAccessManager
          users={detail.usuarios}
          companyFeatures={detail.features}
          currentUserId={null}
          canManage
          onInvite={handleInviteUser}
          onUpdate={handleUpdateUser}
          onDelete={handleDeleteUser}
        />
      </PageLayout>
    );
  }

  return (
    <PageLayout
      header={
        <PageHeader title="Gestão Pilar" description="Visão cross-empresa. Apenas ultra admins têm acesso.">
          <Button variant="outline" size="sm" onClick={fetchEmpresas} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Atualizar
          </Button>
        </PageHeader>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Layers} label="Total de empresas" value={`${totals.total}`} />
        <StatCard icon={Building2} label="Empresas ativas" value={`${totals.active}`} />
        <StatCard icon={CircleOff} label="Suspensas" value={`${totals.suspended}`} />
        <StatCard icon={Users2} label="Usuários totais" value={`${totals.users}`} />
      </div>

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
    </PageLayout>
  );
}

type StatCardProps = {
  icon: typeof Building2;
  label: string;
  value: string;
};

function StatCard({ icon: Icon, label, value }: StatCardProps) {
  return (
    <Card className="border border-black/5">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/5">
          <Icon size={18} strokeWidth={1.5} className="text-black/60" />
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-black/40">{label}</p>
          <p className="text-lg font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: EmpresaStatus }) {
  const variants: Record<EmpresaStatus, string> = {
    active: "border-emerald-600/30 bg-emerald-600/10 text-emerald-700",
    suspended: "border-yellow-600/30 bg-yellow-600/10 text-yellow-700",
    cancelled: "border-red-600/30 bg-red-600/10 text-red-700",
  };
  return (
    <Badge variant="outline" className={`h-6 rounded-full text-[11px] ${variants[status] ?? ""}`}>
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}
