import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { toast } from "sonner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/contexts/AuthContext";
import { ImpersonationProvider } from "@/contexts/ImpersonationContext";
import { IdleTimeoutProvider } from "@/components/IdleTimeoutProvider";
import { PrivateRoute } from "./components/PrivateRoute";
import { ClientePrivateRoute } from "./components/ClientePrivateRoute";
import { AdminRoute } from "./components/AdminRoute";
import { UltraAdminRoute } from "./components/UltraAdminRoute";
import { FeatureRoute } from "./components/FeatureRoute";
import { ImpersonationBanner } from "./components/ImpersonationBanner";

const Landing = lazy(() => import("./pages/Landing"));
const Planos = lazy(() => import("./pages/planos"));
const Checkout = lazy(() => import("./pages/checkout"));
const Billing = lazy(() => import("./pages/billing"));
const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Leads = lazy(() => import("./pages/leads"));
const Financeiro = lazy(() => import("./pages/Financeiro"));
const Projetos = lazy(() => import("./pages/Projetos"));
const Clientes = lazy(() => import("./pages/clientes"));
const Pessoas = lazy(() => import("./pages/pessoas"));
const Relatorios = lazy(() => import("./pages/Relatorios"));
const Profile = lazy(() => import("./pages/Profile"));
const Company = lazy(() => import("./pages/Company"));
const CompanySetup = lazy(() => import("./pages/CompanySetup"));
const ProfileSetup = lazy(() => import("./pages/ProfileSetup"));
const Templates = lazy(() => import("./pages/templates"));
const MapaObras = lazy(() => import("./pages/mapa"));
const Propostas = lazy(() => import("./pages/propostas"));
const Capacidade = lazy(() => import("./pages/capacidade"));
const MetasPage = lazy(() => import("./pages/metas"));
const AiHub = lazy(() => import("./pages/ai"));
const ProjetoDetail = lazy(() => import("./pages/projetos/ProjetoDetail"));
const ClienteLogin = lazy(() => import("./pages/cliente/ClienteLogin"));
const ClienteDashboard = lazy(() => import("./pages/cliente/ClienteDashboard"));
const ClienteProjetoDetail = lazy(() => import("./pages/cliente/ClienteProjetoDetail"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Admin = lazy(() => import("./pages/admin"));
const FeatureAccessPreview = lazy(() => import("./pages/admin/FeatureAccessPreview"));
const UltraAdmin = lazy(() => import("./pages/ultra-admin"));
const MfaChallengePage = lazy(() => import("./pages/MfaChallengePage"));
const MfaSetupPage = lazy(() => import("./pages/MfaSetupPage"));
const PasswordReset = lazy(() => import("./pages/PasswordReset"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const SemAcesso = lazy(() => import("./pages/SemAcesso"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 15,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      onError: (error) => {
        const message = error instanceof Error ? error.message : "Erro inesperado";
        toast.error(message);
      },
    },
  },
});

const App = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <BrowserRouter>
            <AuthProvider>
              <IdleTimeoutProvider />
              <ImpersonationProvider>
                <ImpersonationBanner />
                <Suspense
                  fallback={
                    <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">
                      Carregando...
                    </div>
                  }
                >
                  <Routes>
                    <Route path="/" element={<Landing />} />
                    <Route path="/planos" element={<Planos />} />
                    <Route path="/checkout" element={<Checkout />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password" element={<PasswordReset />} />

                    <Route element={<PrivateRoute />}>
                      <Route path="/dashboard" element={<Dashboard />} />

                      <Route element={<FeatureRoute feature="leads" />}>
                        <Route path="/leads" element={<Leads />} />
                      </Route>

                      <Route element={<FeatureRoute feature="financeiro" />}>
                        <Route path="/financeiro" element={<Financeiro />} />
                      </Route>

                      <Route element={<FeatureRoute feature="projetos" />}>
                        <Route path="/projetos" element={<Projetos />} />
                        <Route path="/projetos/:id" element={<ProjetoDetail />} />
                      </Route>

                      <Route element={<FeatureRoute feature="clientes" />}>
                        <Route path="/clientes" element={<Clientes />} />
                      </Route>

                      <Route element={<FeatureRoute feature="pessoas" />}>
                        <Route path="/pessoas" element={<Pessoas />} />
                      </Route>

                      <Route element={<FeatureRoute feature="relatorios" />}>
                        <Route path="/relatorios" element={<Relatorios />} />
                      </Route>

                      <Route element={<FeatureRoute feature="templates" />}>
                        <Route path="/templates" element={<Templates />} />
                      </Route>

                      <Route element={<FeatureRoute feature="mapa" />}>
                        <Route path="/mapa" element={<MapaObras />} />
                      </Route>

                      <Route element={<FeatureRoute feature="propostas" />}>
                        <Route path="/propostas" element={<Propostas />} />
                      </Route>

                      <Route element={<FeatureRoute feature="capacidade" />}>
                        <Route path="/capacidade" element={<Capacidade />} />
                      </Route>

                      <Route element={<FeatureRoute feature="metas" />}>
                        <Route path="/metas" element={<MetasPage />} />
                      </Route>

                      <Route element={<FeatureRoute feature="ai_hub" />}>
                        <Route path="/ai" element={<AiHub />} />
                      </Route>
                      <Route path="/profile" element={<Profile />} />
                      <Route path="/company" element={<Company />} />
                      <Route path="/company-setup" element={<CompanySetup />} />
                      <Route path="/billing" element={<Billing />} />
                      <Route path="/profile-setup" element={<ProfileSetup />} />
                      <Route path="/mfa" element={<MfaChallengePage />} />
                      <Route path="/mfa/setup" element={<MfaSetupPage />} />
                      <Route path="/sem-acesso" element={<SemAcesso />} />

                      <Route element={<AdminRoute />}>
                        <Route path="/admin" element={<Admin />} />
                        <Route path="/admin/features-preview" element={<FeatureAccessPreview />} />
                      </Route>

                      <Route element={<UltraAdminRoute />}>
                        <Route path="/ultra-admin" element={<UltraAdmin />} />
                      </Route>
                    </Route>

                    <Route path="/rentabilidade" element={<Navigate to="/financeiro?tab=rentabilidade" replace />} />

                    {/* Portal do Cliente — Autenticado */}
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

export default App;
