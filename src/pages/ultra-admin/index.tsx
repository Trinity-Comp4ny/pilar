import { useMemo, useState } from "react";
import { ArrowLeft, Building2, Search, Users2, Wallet } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CompanyFeatureToggles } from "@/components/admin/CompanyFeatureToggles";
import { UsersAccessManager, type ManagedUser } from "@/components/admin/UsersAccessManager";
import type { CompanyFeatures, SubscriptionPlanSlug } from "@/lib/features";

type MockCompany = {
  id: string;
  name: string;
  cnpj: string;
  plan: SubscriptionPlanSlug;
  status: "active" | "suspended" | "cancelled";
  mrr: number;
  features: CompanyFeatures;
  users: ManagedUser[];
};

const MOCK_COMPANIES: MockCompany[] = [
  {
    id: "c1",
    name: "ACME Construtora",
    cnpj: "12.345.678/0001-00",
    plan: "pro",
    status: "active",
    mrr: 197,
    features: {
      relatorios: true,
      leads: true,
      propostas: true,
      clientes: true,
      projetos: true,
      planejamento: true,
      timesheet: true,
      mapa: true,
      financeiro: true,
      pessoas: true,
      portal_cliente: true,
    },
    users: [
      { id: "u1", name: "Maria Silva", email: "maria@acme.com", role: "admin", features: {} },
      {
        id: "u2",
        name: "João Santos",
        email: "joao@acme.com",
        role: "user",
        features: { projetos: "editor", clientes: "viewer", financeiro: "viewer" },
      },
      {
        id: "u3",
        name: "Paula Lima",
        email: "paula@acme.com",
        role: "user",
        features: { financeiro: "editor", relatorios: "viewer" },
      },
    ],
  },
  {
    id: "c2",
    name: "Beta Engenharia",
    cnpj: "98.765.432/0001-99",
    plan: "enterprise",
    status: "active",
    mrr: 397,
    features: {
      relatorios: true,
      leads: true,
      propostas: true,
      clientes: true,
      projetos: true,
      planejamento: true,
      timesheet: true,
      mapa: true,
      financeiro: true,
      pessoas: true,
      metas: true,
      portal_cliente: true,
      ai_hub: true,
      capacidade: true,
      templates: true,
    },
    users: [
      { id: "u4", name: "Carlos Beta", email: "carlos@beta.com", role: "admin", features: {} },
      {
        id: "u5",
        name: "Ana Costa",
        email: "ana@beta.com",
        role: "user",
        features: { projetos: "editor", planejamento: "editor", timesheet: "editor" },
      },
    ],
  },
  {
    id: "c3",
    name: "Gamma Obras",
    cnpj: "11.222.333/0001-44",
    plan: "starter",
    status: "suspended",
    mrr: 0,
    features: {
      clientes: true,
      projetos: true,
      financeiro: true,
      pessoas: true,
    },
    users: [{ id: "u6", name: "Felipe Gamma", email: "felipe@gamma.com", role: "admin", features: {} }],
  },
];

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

export default function UltraAdmin() {
  const [companies, setCompanies] = useState<MockCompany[]>(MOCK_COMPANIES);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const selected = companies.find((c) => c.id === selectedId) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter((c) => c.name.toLowerCase().includes(q) || c.cnpj.includes(q));
  }, [companies, query]);

  const totals = useMemo(() => {
    const active = companies.filter((c) => c.status === "active").length;
    const users = companies.reduce((acc, c) => acc + c.users.length, 0);
    const mrr = companies.reduce((acc, c) => acc + c.mrr, 0);
    return { active, users, mrr };
  }, [companies]);

  const updateCompany = (id: string, patch: Partial<MockCompany>) => {
    setCompanies((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  if (selected) {
    return (
      <UltraAdminCompanyDetail
        company={selected}
        onBack={() => setSelectedId(null)}
        onChangeFeatures={(next) => updateCompany(selected.id, { features: next })}
        onUpdateUsers={(users) => updateCompany(selected.id, { users })}
      />
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Gestão Pilar</h1>
        <p className="mt-1 text-sm text-black/50">Visão cross-empresa. Apenas ultra admins têm acesso.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard icon={Building2} label="Empresas ativas" value={`${totals.active}`} />
        <StatCard icon={Users2} label="Usuários totais" value={`${totals.users}`} />
        <StatCard icon={Wallet} label="MRR estimado" value={`R$ ${totals.mrr.toLocaleString("pt-BR")}`} />
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
                filtered.map((c) => (
                  <TableRow
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className="cursor-pointer hover:bg-black/[0.02]"
                  >
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-black/60">{c.cnpj}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="h-6 rounded-full text-[11px]">
                        {PLAN_LABEL[c.plan]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-black/70">{c.users.length}</TableCell>
                    <TableCell>
                      <StatusBadge status={c.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedId(c.id);
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
        </CardContent>
      </Card>
    </div>
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

function StatusBadge({ status }: { status: MockCompany["status"] }) {
  const variants: Record<MockCompany["status"], string> = {
    active: "border-emerald-600/30 bg-emerald-600/10 text-emerald-700",
    suspended: "border-yellow-600/30 bg-yellow-600/10 text-yellow-700",
    cancelled: "border-red-600/30 bg-red-600/10 text-red-700",
  };
  return (
    <Badge variant="outline" className={`h-6 rounded-full text-[11px] ${variants[status]}`}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}

type DetailProps = {
  company: MockCompany;
  onBack: () => void;
  onChangeFeatures: (next: CompanyFeatures) => void;
  onUpdateUsers: (users: ManagedUser[]) => void;
};

function UltraAdminCompanyDetail({ company, onBack, onChangeFeatures, onUpdateUsers }: DetailProps) {
  const usersByFeature = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const u of company.users) {
      if (u.role !== "user") continue;
      for (const key of Object.keys(u.features)) {
        counts[key] = (counts[key] ?? 0) + 1;
      }
    }
    return counts;
  }, [company.users]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" className="rounded-full" onClick={onBack}>
          <ArrowLeft size={14} />
          Voltar
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{company.name}</h1>
          <p className="text-sm text-black/50">
            {company.cnpj} · {PLAN_LABEL[company.plan]} · <StatusBadge status={company.status} />
          </p>
        </div>
      </div>

      <Card className="border border-black/5">
        <CardHeader>
          <CardTitle className="text-base">Features da empresa</CardTitle>
          <CardDescription>
            Como ultra admin, você pode ativar qualquer feature — inclusive add-ons ainda não contratados.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CompanyFeatureToggles
            value={company.features}
            onChange={onChangeFeatures}
            currentPlan={company.plan}
            usersByFeature={usersByFeature}
          />
        </CardContent>
      </Card>

      <UsersAccessManager
        users={company.users}
        companyFeatures={company.features}
        currentUserId={null}
        canManage
        onInvite={(payload) => {
          const tempId = `pending-${Date.now()}`;
          onUpdateUsers([
            ...company.users,
            {
              id: tempId,
              name: payload.name,
              email: payload.email,
              role: payload.role,
              isPending: true,
              features: payload.features,
            },
          ]);
        }}
        onUpdate={(payload) =>
          onUpdateUsers(
            company.users.map((u) =>
              u.id === payload.id ? { ...u, role: payload.role, features: payload.features } : u
            )
          )
        }
        onDelete={(id) => onUpdateUsers(company.users.filter((u) => u.id !== id))}
      />
    </div>
  );
}
