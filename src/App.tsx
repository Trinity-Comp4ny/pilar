import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { toast } from "sonner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { monitoring } from "@/lib/monitoring";
import { usePageTracking } from "@/hooks/usePageTracking";
import { AuthProvider } from "@/contexts/AuthContext";
import { ImpersonationProvider } from "@/contexts/ImpersonationContext";
import { PageSkeleton } from "@/components/PageSkeleton";
import { PrivateRoute } from "./components/PrivateRoute";
import { ClientePrivateRoute } from "./components/ClientePrivateRoute";
import { AdminRoute } from "./components/AdminRoute";
import { UltraAdminRoute } from "./components/UltraAdminRoute";
import { FeatureRoute } from "./components/FeatureRoute";
import { RequireRole } from "./components/RequireRole";
import { RequireAal2 } from "./components/RequireAal2";
import { ImpersonationBanner } from "./components/ImpersonationBanner";
import { TrialBanner } from "./components/TrialBanner";

const Landing = lazy(() => import("./pages/Landing"));
const Planos = lazy(() => import("./pages/planos"));
const Checkout = lazy(() => import("./pages/checkout"));
const Billing = lazy(() => import("./pages/billing"));
const Login = lazy(() => import("./pages/Login"));
const Inicio = lazy(() => import("./pages/inicio"));
const MeuTrabalho = lazy(() => import("./pages/meu-trabalho"));
const Obras = lazy(() => import("./pages/obras"));
const ObraClima = lazy(() => import("./pages/obras/clima"));
const ObraDetalhe = lazy(() => import("./pages/obras/[id]"));
const Leads = lazy(() => import("./pages/leads"));
const Financeiro = lazy(() => import("./pages/Financeiro"));
const Projetos = lazy(() => import("./pages/Projetos"));
const Clientes = lazy(() => import("./pages/clientes"));
const ClienteDetalhe = lazy(() => import("./pages/clientes/[id]"));
const Fornecedores = lazy(() => import("./pages/fornecedores"));
const Pessoas = lazy(() => import("./pages/pessoas"));
const Profile = lazy(() => import("./pages/Profile"));
const Company = lazy(() => import("./pages/Company"));
const CompanySetup = lazy(() => import("./pages/CompanySetup"));
const ProfileSetup = lazy(() => import("./pages/ProfileSetup"));
const Templates = lazy(() => import("./pages/templates"));
const Timesheet = lazy(() => import("./pages/Timesheet"));
const Chat = lazy(() => import("./pages/chat"));
const Propostas = lazy(() => import("./pages/propostas"));
const Capacidade = lazy(() => import("./pages/capacidade"));
const AiHub = lazy(() => import("./pages/ai"));
const ProjetoDetail = lazy(() => import("./pages/projetos/ProjetoDetail"));
const Calendario = lazy(() => import("./pages/Calendario"));
const ClienteLogin = lazy(() => import("./pages/cliente/ClienteLogin"));
const ClienteDashboard = lazy(() => import("./pages/cliente/ClienteDashboard"));
const ClienteProjetoDetail = lazy(() => import("./pages/cliente/ClienteProjetoDetail"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Admin = lazy(() => import("./pages/admin"));
const UltraAdmin = lazy(() => import("./pages/ultra-admin"));
const MfaChallengePage = lazy(() => import("./pages/MfaChallengePage"));
const MfaSetupPage = lazy(() => import("./pages/MfaSetupPage"));
const PasswordReset = lazy(() => import("./pages/PasswordReset"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const SemAcesso = lazy(() => import("./pages/SemAcesso"));
const Privacidade = lazy(() => import("./pages/Privacidade"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 15,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      onError: (error, variables) => {
        const message = error instanceof Error ? error.message : "Erro inesperado";
        toast.error(message);
        monitoring.captureException(error instanceof Error ? error : new Error(message), {
          source: "react-query.mutation",
          variables,
        });
      },
    },
  },
});

queryClient.getQueryCache().subscribe((event) => {
  if (event.type === "updated" && event.action.type === "error") {
    const err = event.action.error;
    monitoring.captureException(err instanceof Error ? err : new Error(String(err)), {
      source: "react-query.query",
      queryKey: event.query.queryKey,
    });
  }
});

const App = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <BrowserRouter>
            <PageTracker />
            <AuthProvider>
              <ImpersonationProvider>
                <ImpersonationBanner />
                <TrialBanner />
                <Suspense fallback={<PageSkeleton />}>
                  <Routes>
                    <Route path="/" element={<Landing />} />
                    <Route path="/planos" element={<Planos />} />
                    <Route path="/checkout" element={<Checkout />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password" element={<PasswordReset />} />
                    <Route path="/privacidade" element={<Privacidade />} />

                    <Route element={<PrivateRoute />}>
                      <Route path="/inicio" element={<Inicio />} />

                      {/* Obras (reaberto — ADR 0011, spec 015): fase de execução do projeto. */}
                      <Route element={<FeatureRoute feature="obras" />}>
                        <Route path="/obras" element={<Obras />} />
                        <Route path="/obras/clima" element={<ObraClima />} />
                        <Route path="/obras/:id" element={<ObraDetalhe />} />
                      </Route>
                      {/* Dashboard aposentado (spec 005): financeiro vive em Gestão, operacional na Início. */}
                      <Route path="/dashboard" element={<Navigate to="/inicio" replace />} />

                      <Route element={<FeatureRoute feature="leads" />}>
                        <Route path="/leads" element={<Leads />} />
                      </Route>

                      {/* Meu trabalho (Gestão): disciplinas do responsável + tarefas do dia. */}
                      <Route element={<FeatureRoute feature="meu_trabalho" />}>
                        <Route path="/meu-trabalho" element={<MeuTrabalho />} />
                      </Route>

                      {/* Financeiro (inclui aba Folha) escondido de coordenador/colaborador.
                          Guard de UX; a barreira real é a RLS do Cluster 1. */}
                      <Route element={<FeatureRoute feature="financeiro" />}>
                        <Route element={<RequireRole roles={["owner"]} />}>
                          <Route path="/financeiro" element={<Financeiro />} />
                        </Route>
                      </Route>

                      <Route element={<FeatureRoute feature="projetos" />}>
                        <Route path="/projetos" element={<Projetos />} />
                        <Route path="/projetos/:id" element={<ProjetoDetail />} />
                        <Route path="/calendario" element={<Calendario />} />
                      </Route>

                      <Route element={<FeatureRoute feature="clientes" />}>
                        <Route path="/clientes" element={<Clientes />} />
                        <Route path="/clientes/:id" element={<ClienteDetalhe />} />
                      </Route>

                      <Route element={<FeatureRoute feature="financeiro" />}>
                        <Route element={<RequireRole roles={["owner"]} />}>
                          <Route path="/fornecedores" element={<Fornecedores />} />
                        </Route>
                      </Route>

                      {/* ACH-RBAC-OWNER-01: o dono (role de contrato "owner") precisa
                          gerenciar a própria equipe. Antes só admin legado passava. */}
                      <Route element={<RequireRole roles={["owner"]} />}>
                        <Route path="/equipe" element={<Pessoas />} />
                        <Route path="/pessoas" element={<Navigate to="/equipe" replace />} />
                      </Route>

                      {/* Relatórios virou aba do Financeiro (recorte financeiro).
                          Link antigo continua funcionando via redirect. */}
                      <Route path="/relatorios" element={<Navigate to="/financeiro?tab=relatorios" replace />} />

                      <Route element={<FeatureRoute feature="templates" />}>
                        <Route path="/templates" element={<Templates />} />
                      </Route>

                      <Route element={<FeatureRoute feature="timesheet" />}>
                        <Route path="/timesheet" element={<Timesheet />} />
                      </Route>

                      <Route element={<FeatureRoute feature="ai_chat" />}>
                        <Route path="/agentes" element={<Chat />} />
                      </Route>
                      <Route path="/chat" element={<Navigate to="/agentes" replace />} />

                      {/* Mapa virou aba dentro de Projetos; redireciona links antigos */}
                      <Route path="/mapa" element={<Navigate to="/projetos?view=mapa" replace />} />

                      <Route element={<FeatureRoute feature="propostas" />}>
                        <Route path="/documentos" element={<Propostas />} />
                        <Route path="/propostas" element={<Navigate to="/documentos" replace />} />
                      </Route>

                      <Route element={<FeatureRoute feature="capacidade" />}>
                        <Route path="/capacidade" element={<Capacidade />} />
                      </Route>

                      <Route element={<FeatureRoute feature="ai_hub" />}>
                        <Route path="/ai" element={<AiHub />} />
                      </Route>

                      {/* Revisão IA virou aba dentro de Agentes; redireciona links antigos.
                          O gate de owner (ACH-ADM-01) agora vive na própria aba. */}
                      <Route path="/revisao-ia" element={<Navigate to="/agentes?tab=revisao" replace />} />
                      <Route path="/profile" element={<Profile />} />
                      <Route path="/company-setup" element={<CompanySetup />} />
                      <Route path="/profile-setup" element={<ProfileSetup />} />

                      {/* Rotas administrativas sensíveis exigem step-up MFA (sessão AAL2) */}
                      <Route element={<RequireAal2 />}>
                        <Route path="/company" element={<Company />} />
                        <Route path="/billing" element={<Billing />} />
                      </Route>

                      <Route path="/mfa" element={<MfaChallengePage />} />
                      <Route path="/mfa/setup" element={<MfaSetupPage />} />
                      <Route path="/sem-acesso" element={<SemAcesso />} />

                      <Route element={<AdminRoute />}>
                        <Route path="/admin" element={<Admin />} />
                      </Route>

                      <Route element={<UltraAdminRoute />}>
                        <Route path="/ultra-admin" element={<UltraAdmin />} />
                      </Route>
                    </Route>

                    <Route path="/rentabilidade" element={<Navigate to="/financeiro?tab=rentabilidade" replace />} />

                    {/* Portal do Cliente — Autenticado */}
                    <Route path="/portal" element={<Navigate to="/cliente/login" replace />} />
                    <Route path="/cliente/login" element={<ClienteLogin />} />
                    <Route path="/cliente" element={<ClientePrivateRoute />}>
                      <Route path="dashboard" element={<ClienteDashboard />} />
                      <Route path="projeto/:id" element={<ClienteProjetoDetail />} />
                      <Route path="projeto/:id/financeiro" element={<ClienteProjetoDetail />} />
                      <Route path="projeto/:id/entregas" element={<ClienteProjetoDetail />} />
                    </Route>

                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </ImpersonationProvider>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

function PageTracker() {
  usePageTracking();
  return null;
}

export default App;
