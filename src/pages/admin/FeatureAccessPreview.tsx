import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FeatureAccessGrid } from "@/components/admin/FeatureAccessGrid";
import { CompanyFeatureToggles } from "@/components/admin/CompanyFeatureToggles";
import { UsersAccessManager, type ManagedUser } from "@/components/admin/UsersAccessManager";
import type { CompanyFeatures, SubscriptionPlanSlug, UserFeatures } from "@/lib/features";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { canPreviewUltraAdmin, setUltraAdminPreview } from "@/lib/roles";
import { ExternalLink, Lock } from "lucide-react";

const INITIAL_COMPANY_FEATURES: CompanyFeatures = {
  relatorios: true,
  leads: true,
  propostas: true,
  clientes: true,
  projetos: true,
  mapa: true,
  financeiro: true,
  pessoas: true,
  portal_cliente: true,
};

const INITIAL_USER_FEATURES: UserFeatures = {
  projetos: "editor",
  clientes: "viewer",
  financeiro: "viewer",
};

const INITIAL_USERS: ManagedUser[] = [
  {
    id: "u0",
    name: "Gestor Pilar",
    email: "gestor@labrynth.ai",
    role: "ultra_admin",
    features: {},
  },
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
  {
    id: "u4",
    name: "Pedro Costa (convite)",
    email: "pedro@acme.com",
    role: "user",
    isPending: true,
    features: { leads: "viewer", propostas: "viewer" },
  },
];

export default function FeatureAccessPreview() {
  const [companyFeatures, setCompanyFeatures] = useState<CompanyFeatures>(INITIAL_COMPANY_FEATURES);
  const [userFeatures, setUserFeatures] = useState<UserFeatures>(INITIAL_USER_FEATURES);
  const [isAdmin, setIsAdmin] = useState(false);
  const [plan, setPlan] = useState<SubscriptionPlanSlug>("pro");
  const [users, setUsers] = useState<ManagedUser[]>(INITIAL_USERS);

  const usersByFeature = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const u of users) {
      if (u.role !== "user" || u.isPending) continue;
      for (const key of Object.keys(u.features)) {
        counts[key] = (counts[key] ?? 0) + 1;
      }
    }
    return counts;
  }, [users]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Preview — Permissões granulares</h1>
          <p className="mt-1 text-sm text-black/50">
            Todos os componentes novos. Edite os mocks e valide antes de plugar no DB.
          </p>
        </div>
        <UltraAdminShortcut />
      </div>

      <Tabs defaultValue="grid" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="grid">FeatureAccessGrid</TabsTrigger>
          <TabsTrigger value="company">CompanyFeatureToggles</TabsTrigger>
          <TabsTrigger value="users">UsersAccessManager</TabsTrigger>
          <TabsTrigger value="ultra">Ultra Admin</TabsTrigger>
        </TabsList>

        <TabsContent value="grid" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Grid isolado (usado em convite/edição)</CardTitle>
              <CardDescription>
                Matriz de features × nível. Admin bypassa tudo; features desativadas na empresa somem.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-black/10 p-3">
                <div>
                  <div className="text-sm font-medium">Usuário é admin da empresa?</div>
                  <p className="text-xs text-black/50">Admins ignoram o grid.</p>
                </div>
                <Switch checked={isAdmin} onCheckedChange={setIsAdmin} />
              </div>

              <FeatureAccessGrid
                value={userFeatures}
                onChange={setUserFeatures}
                companyFeatures={companyFeatures}
                disabled={isAdmin}
              />

              <div>
                <Label className="text-xs text-black/50">Payload profiles.features</Label>
                <pre className="mt-1 overflow-auto rounded-lg bg-black/[0.03] p-3 text-xs">
                  {JSON.stringify(userFeatures, null, 2)}
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="company" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">Features da empresa</CardTitle>
                <CardDescription>Admin liga/desliga features. Ao desligar, confirma se afeta usuários.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-black/50">Plano:</Label>
                <Select value={plan} onValueChange={(v) => setPlan(v as SubscriptionPlanSlug)}>
                  <SelectTrigger className="h-9 w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <CompanyFeatureToggles
                value={companyFeatures}
                onChange={setCompanyFeatures}
                currentPlan={plan}
                usersByFeature={usersByFeature}
                onChangePlan={() => toast.info("Em breve", { description: "Abriria a página de billing." })}
              />

              <div className="mt-4">
                <Label className="text-xs text-black/50">Payload empresas.features</Label>
                <pre className="mt-1 overflow-auto rounded-lg bg-black/[0.03] p-3 text-xs">
                  {JSON.stringify(companyFeatures, null, 2)}
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="mt-4 space-y-4">
          <UsersAccessManager
            users={users}
            companyFeatures={companyFeatures}
            currentUserId="u1"
            canManage
            onInvite={(payload) => {
              const tempId = `pending-${Date.now()}`;
              setUsers((prev) => [
                ...prev,
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
              setUsers((prev) =>
                prev.map((u) => (u.id === payload.id ? { ...u, role: payload.role, features: payload.features } : u))
              )
            }
            onDelete={(id) => setUsers((prev) => prev.filter((u) => u.id !== id))}
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payload users (state atual)</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="overflow-auto rounded-lg bg-black/[0.03] p-3 text-xs">
                {JSON.stringify(users, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ultra" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Rota Ultra Admin</CardTitle>
              <CardDescription>
                Página protegida por role <code>ultra_admin</code>. O primeiro ultra admin é promovido exclusivamente
                via SQL direto no Supabase — nenhuma UI concede esse papel.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <UltraAdminShortcut />
              <Button asChild className="rounded-full bg-brand text-ink hover:bg-brand/90">
                <Link to="/ultra-admin">
                  <ExternalLink size={14} />
                  Abrir /ultra-admin
                </Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function UltraAdminShortcut() {
  const devMode = canPreviewUltraAdmin();
  const [enabled, setEnabled] = useState(() => {
    if (!devMode || typeof window === "undefined") return false;
    return window.localStorage.getItem("pilar-ultra-admin-preview") === "1";
  });

  if (!devMode) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-black/10 bg-black/[0.03] px-3 py-2 text-xs text-black/60">
        <Lock size={14} className="mt-0.5 flex-shrink-0" strokeWidth={1.5} />
        <div>
          <span className="font-medium text-black/80">Preview indisponível em produção</span>
          <p className="mt-0.5 text-[11px]">
            Para testar a rota, promova um usuário a <code>ultra_admin</code> diretamente no Supabase:
            <br />
            <code className="text-[11px]">UPDATE profiles SET role = 'ultra_admin' WHERE email = 'seu@email';</code>
          </p>
        </div>
      </div>
    );
  }

  const toggle = (next: boolean) => {
    setUltraAdminPreview(next);
    setEnabled(next);
  };

  return (
    <div className="flex items-center gap-3 rounded-lg border border-brand/30 bg-brand/5 px-3 py-2">
      <div className="text-xs text-black/70">
        <span className="font-medium">Ultra admin preview (DEV only)</span>
        <p className="text-[11px] text-black/50">
          Bypass ativo apenas em <code>npm run dev</code> — removido do bundle de produção.
        </p>
      </div>
      <Switch checked={enabled} onCheckedChange={toggle} />
    </div>
  );
}
