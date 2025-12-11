import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { PrivateRoute } from "./components/PrivateRoute";

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
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm text-gray-500">Carregando...</div>}>
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
              
              <Route path="/clientes" element={<PrivateRoute />}>
                <Route index element={<Clientes />} />
              </Route>
              
              <Route path="/pessoas" element={<PrivateRoute />}>
                <Route index element={<Pessoas />} />
              </Route>
              
              <Route path="/relatorios" element={<PrivateRoute />}>
                <Route index element={<Relatorios />} />
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
