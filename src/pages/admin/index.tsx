import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Building2, CreditCard, ShieldCheck, SlidersHorizontal, Sparkles, Users, Zap } from "lucide-react";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
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

type RawUser = {
  id: string;
  nome: string;
  email: string;
  role: string | null;
  features?: unknown;
  contato?: string | null;
};

const VALID_TABS = ["usuarios", "features", "empresa", "parametros", "automacoes", "auditoria", "plano"] as const;
type AdminTab = (typeof VALID_TABS)[number];

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
            "id, empresa_id, role, empresas(id, nome, cnpj, status, email, contato, endereco, cidade, estado, cep, logo_url)"
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
          // Tipos pilar_subscriptions/pilar_subscription_plans entram após gen:types pós-migration
          const subResult = await (
            supabase as unknown as {
              from: (t: string) => {
                select: (s: string) => {
                  eq: (
                    k: string,
                    v: string
                  ) => {
                    maybeSingle: () => Promise<{ data: { plan_id?: string | null } | null }>;
                  };
                };
              };
            }
          )
            .from("pilar_subscriptions")
            .select("plan_id")
            .eq("empresa_id", profile.empresa_id)
            .maybeSingle();
          const planId = subResult.data?.plan_id;
          if (planId) {
            const planResult = await (
              supabase as unknown as {
                from: (t: string) => {
                  select: (s: string) => {
                    eq: (
                      k: string,
                      v: string
                    ) => {
                      maybeSingle: () => Promise<{ data: { slug?: string | null } | null }>;
                    };
                  };
                };
              }
            )
              .from("pilar_subscription_plans")
              .select("slug")
              .eq("id", planId)
              .maybeSingle();
            const slug = planResult.data?.slug;
            if (slug === "starter" || slug === "pro" || slug === "enterprise") {
              setCurrentPlan(slug);
            }
          }

          const { data: companyUsers } = await supabase
            .from("profiles")
            .select("id, nome, email, role, contato")
            .eq("empresa_id", profile.empresa_id);
          if (companyUsers) {
            setUsers(
              (companyUsers as RawUser[]).map((u) => ({
                id: u.id,
                nome: u.nome,
                email: u.email,
                role: u.role,
                features: (u as RawUser).features,
                contato: u.contato,
              }))
            );
          }
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

  return (
    <PageLayout
      header={<PageHeader title="Admin Portal" description="Governança, configuração e observabilidade da firma" />}
      containerClassName="max-w-6xl"
    >
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="flex flex-wrap gap-1 h-auto p-1">
          <TabsTrigger value="usuarios" className="gap-2">
            <Users size={14} /> Usuários
            <Badge variant="secondary" className="ml-1">
              {users.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="features" className="gap-2">
            <Sparkles size={14} /> Features
          </TabsTrigger>
          <TabsTrigger value="empresa" className="gap-2">
            <Building2 size={14} /> Empresa
          </TabsTrigger>
          <TabsTrigger value="parametros" className="gap-2">
            <SlidersHorizontal size={14} /> Parâmetros
          </TabsTrigger>
          <TabsTrigger value="automacoes" className="gap-2">
            <Zap size={14} /> Automações
          </TabsTrigger>
          <TabsTrigger value="auditoria" className="gap-2">
            <ShieldCheck size={14} /> Auditoria
          </TabsTrigger>
          <TabsTrigger value="plano" className="gap-2">
            <CreditCard size={14} /> Plano
          </TabsTrigger>
        </TabsList>

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

        <TabsContent value="auditoria" className="mt-6">
          <AuditoriaTab />
        </TabsContent>

        <TabsContent value="plano" className="mt-6">
          <PlanoTab empresaId={companyId} />
        </TabsContent>
      </Tabs>
    </PageLayout>
  );
}
