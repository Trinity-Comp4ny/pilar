import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { toast } from "sonner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/contexts/AuthContext";
import { PrivateRoute } from "./components/PrivateRoute";
import { ClientePrivateRoute } from "./components/ClientePrivateRoute";

const Landing = lazy(() => import("./pages/Landing"));
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
const Timesheet = lazy(() => import("./pages/timesheet"));
const Templates = lazy(() => import("./pages/templates"));
const MapaObras = lazy(() => import("./pages/mapa"));
const Propostas = lazy(() => import("./pages/propostas"));
const Capacidade = lazy(() => import("./pages/capacidade"));
const Portal = lazy(() => import("./pages/portal"));
const MetasPage = lazy(() => import("./pages/metas"));
const AiHub = lazy(() => import("./pages/ai"));
const ProjetoDetail = lazy(() => import("./pages/projetos/ProjetoDetail"));
const PortalFinanceiro = lazy(() => import("./pages/portal/PortalFinanceiro"));
const PortalEntregas = lazy(() => import("./pages/portal/PortalEntregas"));
const ClienteLogin = lazy(() => import("./pages/cliente/ClienteLogin"));
const ClienteDashboard = lazy(() => import("./pages/cliente/ClienteDashboard"));
const ClienteProjetoDetail = lazy(() => import("./pages/cliente/ClienteProjetoDetail"));
const NotFound = lazy(() => import("./pages/NotFound"));

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
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <Suspense
                fallback={
                  <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">
                    Carregando...
                  </div>
                }
              >
                <Routes>
                  <Route path="/" element={<Landing />} />
                  <Route path="/login" element={<Login />} />

                  <Route element={<PrivateRoute />}>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/leads" element={<Leads />} />
                    <Route path="/financeiro" element={<Financeiro />} />
                    <Route path="/projetos" element={<Projetos />} />
                    <Route path="/projetos/:id" element={<ProjetoDetail />} />
                    <Route path="/clientes" element={<Clientes />} />
                    <Route path="/pessoas" element={<Pessoas />} />
                    <Route path="/relatorios" element={<Relatorios />} />
                    <Route path="/timesheet" element={<Timesheet />} />
                    <Route path="/templates" element={<Templates />} />
                    <Route path="/mapa" element={<MapaObras />} />
                    <Route path="/propostas" element={<Propostas />} />
                    <Route path="/capacidade" element={<Capacidade />} />
                    <Route path="/metas" element={<MetasPage />} />
                    <Route path="/ai" element={<AiHub />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/company" element={<Company />} />
                    <Route path="/company-setup" element={<CompanySetup />} />
                    <Route path="/profile-setup" element={<ProfileSetup />} />
                  </Route>

                  <Route path="/rentabilidade" element={<Navigate to="/financeiro?tab=rentabilidade" replace />} />

                  {/* Portal do Cliente — Token (rota publica legada) */}
                  <Route path="/portal/:token" element={<Portal />} />
                  <Route path="/portal/:token/financeiro" element={<PortalFinanceiro />} />
                  <Route path="/portal/:token/entregas" element={<PortalEntregas />} />

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
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
