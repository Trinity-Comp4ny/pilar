import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { untypedFrom } from "@/lib/supabaseRpc";
import { toast } from "sonner";
import { Building2, CreditCard, Link2, ShieldCheck, SlidersHorizontal, Sparkles, Users, Zap } from "lucide-react";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { SecondSidebar, type SecondSidebarTab } from "@/components/SecondSidebar";
import { usePageTitle } from "@/hooks/usePageTitle";
import type { CompanyData } from "@/pages/company/types";
import { parseCompanyFeatures, type CompanyFeatures, type SubscriptionPlanSlug } from "@/lib/features";
import { UsuariosTab } from "./tabs/Usuarios";
import { EmpresaTab } from "./tabs/Empresa";
import { FeaturesEmpresaTab } from "./tabs/Features";
import { ParametrosTab } from "./tabs/Parametros";
import { AutomacoesTab } from "./tabs/Automacoes";
import { AuditoriaTab } from "./tabs/Auditoria";
import { PlanoTab } from "./tabs/Plano";
import { IntegracoesTab } from "./tabs/Integracoes";

type RawUser = {
  id: string;
  nome: string;
  email: string;
  role: string | null;
  features?: unknown;
  contato?: string | null;
  isPending?: boolean;
};

const VALID_TABS = ["usuarios", "features", "empresa", "parametros", "automacoes", "auditoria", "plano", "integracoes"] as const;
type AdminTab = (typeof VALID_TABS)[number];

const ADMIN_TABS: SecondSidebarTab[] = [
  { id: "usuarios", label: "Usuários", icon: Users },
  { id: "features", label: "Features", icon: Sparkles },
  { id: "empresa", label: "Empresa", icon: Building2 },
  { id: "parametros", label: "Parâmetros", icon: SlidersHorizontal },
  { id: "automacoes", label: "Automações", icon: Zap },
  { id: "integracoes", label: "Integrações", icon: Link2 },
  { id: "auditoria", label: "Auditoria", icon: ShieldCheck },
  { id: "plano", label: "Plano", icon: CreditCard },
];

export default function Admin() {
  usePageTitle("Admin");
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab") as AdminTab | null;
  const initialTab: AdminTab = tabParam && VALID_TABS.includes(tabParam) ? tabParam : "usuarios";
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState<RawUser[]>([]);
  const [companyFeatures, setCompanyFeatures] = useState<CompanyFeatures>({});
  const [currentPlan, setCurrentPlan] = useState<SubscriptionPlanSlug>("starter");
  const [companyData, setCompanyData] = useState<CompanyData>({
    nomeEmpresa: "",
    cnpj: "",
    email: "",
    contato: "",
    endereco: "",
    cidade: "",
    estado: "",
    cep: "",
    status: "active",
    logoUrl: "",
  });

  useEffect(() => {
    const load = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        setCurrentUserId(user.id);

        const { data: profile } = await supabase
          .from("profiles")
          .select(
            "id, empresa_id, role, empresas(id, nome, cnpj, status, email, contato, endereco, cidade, estado, cep, logo_url, features)"
          )
          .eq("id", user.id)
          .single();

        if (profile?.empresa_id) setCompanyId(profile.empresa_id);

        if (profile?.empresas) {
          const emp = profile.empresas as typeof profile.empresas & { features?: unknown };
          setCompanyData({
            nomeEmpresa: emp.nome || "",
            cnpj: emp.cnpj || "",
            email: emp.email || "",
            contato: emp.contato || "",
            endereco: emp.endereco || "",
            cidade: emp.cidade || "",
            estado: emp.estado || "",
            cep: emp.cep || "",
            status: emp.status || "active",
            logoUrl: emp.logo_url || "",
          });
          setCompanyFeatures(parseCompanyFeatures(emp.features));
        }

        if (profile?.empresa_id) {
          // gen:types não inclui pilar_subscriptions/pilar_subscription_plans ainda
          const subResult = await untypedFrom<{ plan_id: string | null }>("pilar_subscriptions")
            .select("plan_id")
            .eq("empresa_id", profile.empresa_id)
            .maybeSingle();
          const planId = subResult.data?.plan_id;
          if (planId) {
            const planResult = await untypedFrom<{ slug: string | null }>("pilar_subscription_plans")
              .select("slug")
              .eq("id", planId)
              .maybeSingle();
            const slug = planResult.data?.slug;
            if (slug === "starter" || slug === "pro" || slug === "enterprise") {
              setCurrentPlan(slug);
            }
          }

          const [{ data: companyUsers }, { data: pendingConvites }] = await Promise.all([
            supabase
              .from("profiles")
              .select("id, first_name, last_name, email, role, features, contato, onboarding_completed")
              .eq("empresa_id", profile.empresa_id),
            supabase
              .from("convites")
              .select("id, nome, email, cargo, features")
              .eq("empresa_id", profile.empresa_id)
              .is("usado_em", null)
              .gt("expira_em", new Date().toISOString()),
          ]);

          const profileList: RawUser[] = (companyUsers ?? []).map((u) => ({
            id: u.id,
            nome:
              [(u as { first_name?: string }).first_name, (u as { last_name?: string }).last_name]
                .filter(Boolean)
                .join(" ")
                .trim() || u.email,
            email: u.email,
            role: u.role,
            features: u.features,
            contato: (u as { contato?: string | null }).contato,
            isPending: (u as { onboarding_completed?: boolean | null }).onboarding_completed === false,
          }));

          const pendingList: RawUser[] = (pendingConvites ?? []).map((c) => ({
            id: `pending-${c.id}`,
            nome: c.nome ?? c.email,
            email: c.email,
            role: c.cargo,
            features: c.features,
            isPending: true,
          }));

          // Remove pending se o email já tem perfil (convite aceito mas expirado não removido)
          const profileEmails = new Set(profileList.map((u) => u.email.toLowerCase()));
          setUsers([...profileList, ...pendingList.filter((p) => !profileEmails.has(p.email.toLowerCase()))]);
        }
      } catch {
        toast.error("Erro ao carregar admin");
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, []);

  const handleTabChange = (value: string) => {
    const next = (VALID_TABS.includes(value as AdminTab) ? value : "usuarios") as AdminTab;
    setActiveTab(next);
    setSearchParams({ tab: next }, { replace: true });
  };

  const adminSidebarTabs: SecondSidebarTab[] = ADMIN_TABS.map((t) =>
    t.id === "usuarios" ? { ...t, badge: users.length } : t
  );

  return (
    <PageLayout
      header={<PageHeader title="Admin Portal" description="Governança, configuração e observabilidade da firma" />}
      sidebar={<SecondSidebar tabs={adminSidebarTabs} value={activeTab} onValueChange={handleTabChange} />}
      containerClassName="max-w-6xl"
    >
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsContent value="usuarios" className="mt-6">
          <UsuariosTab
            users={users}
            setUsers={setUsers}
            currentUserId={currentUserId}
            companyFeatures={companyFeatures}
          />
        </TabsContent>

        <TabsContent value="features" className="mt-6">
          <FeaturesEmpresaTab
            companyFeatures={companyFeatures}
            setCompanyFeatures={setCompanyFeatures}
            currentPlan={currentPlan}
            users={users}
          />
        </TabsContent>

        <TabsContent value="empresa" className="mt-6">
          <EmpresaTab
            companyId={companyId}
            companyData={companyData}
            setCompanyData={setCompanyData}
            usersCount={users.length}
            isLoading={isLoading}
          />
        </TabsContent>

        <TabsContent value="parametros" className="mt-6">
          <ParametrosTab />
        </TabsContent>

        <TabsContent value="automacoes" className="mt-6">
          <AutomacoesTab />
        </TabsContent>

        <TabsContent value="integracoes" className="mt-6">
          <IntegracoesTab />
        </TabsContent>

        <TabsContent value="auditoria" className="mt-6">
          <AuditoriaTab />
        </TabsContent>

        <TabsContent value="plano" className="mt-6">
          <PlanoTab empresaId={companyId} currentPlan={currentPlan} />
        </TabsContent>
      </Tabs>
    </PageLayout>
  );
}
