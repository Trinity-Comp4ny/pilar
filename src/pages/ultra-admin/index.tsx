import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { ArrowLeft, Building2, CircleOff, Loader2, Pencil, Plus, Search, Users2, Layers } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CompanyFeatureToggles } from "@/components/admin/CompanyFeatureToggles";
import { UsersAccessManager, type ManagedUser } from "@/components/admin/UsersAccessManager";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { usePageTitle } from "@/hooks/usePageTitle";
import {
  parseCompanyFeatures,
  parseUserFeatures,
  type CompanyFeatures,
  type SubscriptionPlanSlug,
} from "@/lib/features";
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

      // Convites pendentes entram na mesma lista como "Pendente"
      for (const c of raw.convites ?? []) {
        emp.usuarios.push({
          id: `convite-${c.id}`,
          inviteId: c.id,
          name: c.nome ?? c.email,
          email: c.email,
          role: normalizeRole(c.cargo),
          features: parseUserFeatures(c.features),
          isPending: true,
        });
      }
      emp.usersCount = emp.usuarios.filter((u) => !u.isPending).length;

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
        toast.error("Erro ao salvar features", {
          description: err instanceof Error ? err.message : "Erro inesperado",
        });
      } finally {
        setSavingFeatures(false);
      }
    },
    [detail, savingFeatures]
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
        toast.success("Convite enviado");
        await fetchDetail(detail.id);
      } catch (err) {
        toast.error("Erro ao convidar usuário", {
          description: err instanceof Error ? err.message : "Erro inesperado",
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
        toast.error("Erro ao reenviar convite", {
          description: err instanceof Error ? err.message : "Erro inesperado",
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
        toast.error("Erro ao cancelar convite", {
          description: err instanceof Error ? err.message : "Erro inesperado",
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
    }) => {
      if (!detail) return;
      try {
        await edgeFetch("ultra-admin-empresas", {
          method: "PUT",
          body: { empresa_id: detail.id, ...patch },
        });
        setDetail((prev) => (prev ? { ...prev, ...patch } : prev));
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
        toast.error("Erro ao atualizar empresa", {
          description: err instanceof Error ? err.message : "Erro inesperado",
        });
      }
    },
    [detail]
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ nome: "", cnpj: "", ownerEmail: "", ownerNome: "" });

  const [editCompanyOpen, setEditCompanyOpen] = useState(false);
  const [companyForm, setCompanyForm] = useState<{
    nome: string;
    cnpj: string;
    status: EmpresaStatus;
    plano: SubscriptionPlanSlug;
  }>({ nome: "", cnpj: "", status: "active", plano: "starter" });

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
      toast.error("Erro ao criar empresa", {
        description: err instanceof Error ? err.message : "Erro inesperado",
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
                className="rounded-full gap-1.5"
                onClick={() => {
                  setCompanyForm({
                    nome: detail.nome,
                    cnpj: detail.cnpj ?? "",
                    status: detail.status as EmpresaStatus,
                    plano: detail.plano,
                  });
                  setEditCompanyOpen(true);
                }}
              >
                <Pencil size={14} />
                Editar empresa
              </Button>
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
              disabled={savingFeatures}
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
          onResendInvite={handleResendInvite}
          onCancelInvite={handleCancelInvite}
        />

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
            });
            setEditCompanyOpen(false);
          }}
        />
      </PageLayout>
    );
  }

  return (
    <PageLayout
      header={
        <PageHeader title="Gestão Pilar" description="Visão cross-empresa. Apenas ultra admins têm acesso.">
          <Button className="rounded-full gap-2" onClick={() => setCreateOpen(true)}>
            <Plus size={16} />
            Criar empresa
          </Button>
        </PageHeader>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard icon={Layers} label="Total de empresas" value={`${totals.total}`} />
            <StatCard icon={Building2} label="Empresas ativas" value={`${totals.active}`} />
            <StatCard icon={CircleOff} label="Suspensas" value={`${totals.suspended}`} />
            <StatCard icon={Users2} label="Usuários totais" value={`${totals.users}`} />
          </>
        )}
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
            <Button onClick={handleCreateEmpresa} disabled={creating}>
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

function StatCardSkeleton() {
  return (
    <Card className="border border-black/5">
      <CardContent className="flex items-center gap-3 p-4">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-5 w-10" />
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

type CompanyForm = { nome: string; cnpj: string; status: EmpresaStatus; plano: SubscriptionPlanSlug };

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
            Dados cadastrais, status de acesso e plano. Suspender ou cancelar bloqueia o acesso da empresa.
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
          {dangerous && (
            <div className="space-y-2 rounded-md border border-red-200 bg-red-50 px-3 py-2.5">
              <p className="text-xs text-red-700">
                {form.status === "suspended"
                  ? "Suspensa: os usuários da empresa perdem o acesso até reativar."
                  : "Cancelada: o acesso é encerrado. Use com cuidado."}
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-empresa" className="text-xs text-red-800">
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
