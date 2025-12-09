import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Leads from "./pages/leads";
import Financeiro from "./pages/Financeiro";
import Projetos from "./pages/Projetos";
import Clientes from "./pages/clientes";
import Pessoas from "./pages/pessoas";
import Relatorios from "./pages/Relatorios";
import NotFound from "./pages/NotFound";
import { PrivateRoute } from "./components/PrivateRoute";
import Profile from "./pages/Profile";
import Company from "./pages/Company";
import Landing from "./pages/Landing";
import CompanySetup from "./pages/CompanySetup";
import ProfileSetup from "./pages/ProfileSetup";

const queryClient = new QueryClient();

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
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
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
