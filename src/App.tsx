import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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
  },
});

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense
            fallback={
              <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">Carregando...</div>
            }
          >
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />

              {/* Rotas Protegidas */}
              <Route path="/dashboard" element={<PrivateRoute />}>
                <Route index element={<Dashboard />} />
              </Route>

              <Route path="/leads" element={<PrivateRoute />}>
                <Route index element={<Leads />} />
              </Route>

              <Route path="/financeiro" element={<PrivateRoute />}>
                <Route index element={<Financeiro />} />
              </Route>

              <Route path="/projetos" element={<PrivateRoute />}>
                <Route index element={<Projetos />} />
              </Route>

              <Route path="/projetos/:id" element={<PrivateRoute />}>
                <Route index element={<ProjetoDetail />} />
              </Route>

              <Route path="/clientes" element={<PrivateRoute />}>
                <Route index element={<Clientes />} />
              </Route>

              <Route path="/pessoas" element={<PrivateRoute />}>
                <Route index element={<Pessoas />} />
              </Route>

              <Route path="/relatorios" element={<PrivateRoute />}>
                <Route index element={<Relatorios />} />
              </Route>

              <Route path="/timesheet" element={<PrivateRoute />}>
                <Route index element={<Timesheet />} />
              </Route>

              <Route path="/templates" element={<PrivateRoute />}>
                <Route index element={<Templates />} />
              </Route>

              <Route path="/rentabilidade" element={<Navigate to="/financeiro?tab=rentabilidade" replace />} />

              <Route path="/mapa" element={<PrivateRoute />}>
                <Route index element={<MapaObras />} />
              </Route>

              <Route path="/propostas" element={<PrivateRoute />}>
                <Route index element={<Propostas />} />
              </Route>

              <Route path="/capacidade" element={<PrivateRoute />}>
                <Route index element={<Capacidade />} />
              </Route>

              <Route path="/metas" element={<PrivateRoute />}>
                <Route index element={<MetasPage />} />
              </Route>

              {/* Portal do Cliente — Token (rota pública legada) */}
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

              <Route path="/ai" element={<PrivateRoute />}>
                <Route index element={<AiHub />} />
              </Route>

              <Route path="/profile" element={<PrivateRoute />}>
                <Route index element={<Profile />} />
              </Route>

              <Route path="/company" element={<PrivateRoute />}>
                <Route index element={<Company />} />
              </Route>

              <Route path="/company-setup" element={<PrivateRoute />}>
                <Route index element={<CompanySetup />} />
              </Route>

              <Route path="/profile-setup" element={<PrivateRoute />}>
                <Route index element={<ProfileSetup />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
