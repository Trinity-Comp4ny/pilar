import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
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
import { AdminOnlyRoute } from "./components/AdminOnlyRoute";
import { ImpersonationBanner } from "./components/ImpersonationBanner";
import { TrialBanner } from "./components/TrialBanner";
import { SettingsModalProvider } from "./contexts/SettingsModalContext";
import { SettingsDialog } from "./components/settings/SettingsDialog";

const Landing = lazy(() => import("./pages/Landing"));
const Planos = lazy(() => import("./pages/planos"));
const Checkout = lazy(() => import("./pages/checkout"));
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
const FornecedorDetalhe = lazy(() => import("./pages/fornecedores/[id]"));
const Pessoas = lazy(() => import("./pages/pessoas"));
const Metas = lazy(() => import("./pages/metas"));
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
const ClienteObraDetail = lazy(() => import("./pages/cliente/ClienteObraDetail"));
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

// Redireciona uma rota flat antiga para a aninhada, preservando o sufixo
// (ex.: /clientes/123 → /gestao/clientes/123) e a query. Usado nas rotas de
// compatibilidade após a reorg de rotas por módulo (ADR 0016).
function RedirectPrefix({ from, to }: { from: string; to: string }) {
  const location = useLocation();
  const rest = location.pathname.startsWith(from) ? location.pathname.slice(from.length) : "";
  return <Navigate to={`${to}${rest}${location.search}`} replace />;
}

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
                <SettingsModalProvider>
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

                        {/* ===== Rotas aninhadas por módulo (ADR 0016) ===== */}

                        {/* Obras (reaberto — ADR 0011, spec 015): fase de execução do projeto. */}
                        <Route element={<FeatureRoute feature="obras" />}>
                          <Route path="/obras" element={<Obras />} />
                          <Route path="/obras/clima" element={<ObraClima />} />
                          {/* Fornecedor mora no módulo Obra (spec 026). */}
                          <Route path="/obras/fornecedores" element={<Fornecedores />} />
                          <Route path="/obras/fornecedores/:id" element={<FornecedorDetalhe />} />
                          <Route path="/obras/:id" element={<ObraDetalhe />} />
                        </Route>

                        {/* Gestão: /gestao abre a primeira aba; cada aba vive em /gestao/*. */}
                        <Route path="/gestao" element={<Navigate to="/gestao/meu-trabalho" replace />} />
                        <Route element={<FeatureRoute feature="meu_trabalho" />}>
                          <Route path="/gestao/meu-trabalho" element={<MeuTrabalho />} />
                        </Route>
                        <Route element={<FeatureRoute feature="leads" />}>
                          <Route path="/gestao/leads" element={<Leads />} />
                        </Route>
                        <Route element={<FeatureRoute feature="clientes" />}>
                          <Route path="/gestao/clientes" element={<Clientes />} />
                          <Route path="/gestao/clientes/:id" element={<ClienteDetalhe />} />
                        </Route>
                        <Route element={<FeatureRoute feature="propostas" />}>
                          <Route path="/gestao/propostas" element={<Propostas />} />
                        </Route>
                        {/* Financeiro: acesso granular por usuário (profiles.features)
                          + RLS. Quem não tem a feature não vê. */}
                        <Route element={<FeatureRoute feature="financeiro" />}>
                          <Route path="/gestao/financeiro" element={<Financeiro />} />
                        </Route>
                        {/* Equipe (RH: cadastro e salário) é só admin da empresa. */}
                        <Route element={<AdminOnlyRoute />}>
                          <Route path="/gestao/equipe" element={<Pessoas />} />
                        </Route>
                        <Route element={<FeatureRoute feature="metas" />}>
                          <Route element={<AdminOnlyRoute />}>
                            <Route path="/gestao/metas" element={<Metas />} />
                          </Route>
                        </Route>
                        <Route element={<FeatureRoute feature="templates" />}>
                          <Route path="/gestao/templates" element={<Templates />} />
                        </Route>
                        <Route element={<FeatureRoute feature="timesheet" />}>
                          <Route path="/gestao/timesheet" element={<Timesheet />} />
                        </Route>
                        <Route element={<FeatureRoute feature="capacidade" />}>
                          <Route path="/gestao/capacidade" element={<Capacidade />} />
                        </Route>
                        <Route element={<FeatureRoute feature="ai_hub" />}>
                          <Route path="/gestao/ai" element={<AiHub />} />
                        </Route>

                        {/* Projetos (coleção + lentes de recorte; a lente vem do pathname).
                          Estáticas antes de /projetos/:id para o segmento estático vencer. */}
                        <Route element={<FeatureRoute feature="projetos" />}>
                          <Route path="/projetos" element={<Projetos />} />
                          <Route path="/projetos/disciplinas" element={<Projetos />} />
                          <Route path="/projetos/cronograma" element={<Projetos />} />
                          <Route path="/projetos/calendario" element={<Calendario />} />
                          <Route path="/projetos/:id" element={<ProjetoDetail />} />
                        </Route>
                        <Route element={<FeatureRoute feature="mapa" />}>
                          <Route path="/projetos/mapa" element={<Projetos />} />
                        </Route>

                        {/* Agentes (transversal, fora do switcher de módulo). */}
                        <Route element={<FeatureRoute feature="ai_chat" />}>
                          <Route path="/agentes" element={<Chat />} />
                        </Route>

                        {/* ===== Compat: rotas flat antigas → aninhadas. RedirectPrefix
                          preserva o sufixo (/:id) e a query. ===== */}
                        <Route path="/dashboard" element={<Navigate to="/inicio" replace />} />
                        <Route path="/chat" element={<Navigate to="/agentes" replace />} />
                        <Route
                          path="/meu-trabalho/*"
                          element={<RedirectPrefix from="/meu-trabalho" to="/gestao/meu-trabalho" />}
                        />
                        <Route path="/leads/*" element={<RedirectPrefix from="/leads" to="/gestao/leads" />} />
                        <Route path="/clientes/*" element={<RedirectPrefix from="/clientes" to="/gestao/clientes" />} />
                        <Route
                          path="/financeiro/*"
                          element={<RedirectPrefix from="/financeiro" to="/gestao/financeiro" />}
                        />
                        <Route path="/equipe/*" element={<RedirectPrefix from="/equipe" to="/gestao/equipe" />} />
                        <Route path="/pessoas/*" element={<RedirectPrefix from="/pessoas" to="/gestao/equipe" />} />
                        <Route path="/metas/*" element={<RedirectPrefix from="/metas" to="/gestao/metas" />} />
                        <Route
                          path="/documentos/*"
                          element={<RedirectPrefix from="/documentos" to="/gestao/propostas" />}
                        />
                        <Route
                          path="/propostas/*"
                          element={<RedirectPrefix from="/propostas" to="/gestao/propostas" />}
                        />
                        <Route
                          path="/templates/*"
                          element={<RedirectPrefix from="/templates" to="/gestao/templates" />}
                        />
                        <Route
                          path="/timesheet/*"
                          element={<RedirectPrefix from="/timesheet" to="/gestao/timesheet" />}
                        />
                        <Route
                          path="/capacidade/*"
                          element={<RedirectPrefix from="/capacidade" to="/gestao/capacidade" />}
                        />
                        <Route path="/ai/*" element={<RedirectPrefix from="/ai" to="/gestao/ai" />} />
                        <Route
                          path="/fornecedores/*"
                          element={<RedirectPrefix from="/fornecedores" to="/obras/fornecedores" />}
                        />
                        <Route
                          path="/calendario/*"
                          element={<RedirectPrefix from="/calendario" to="/projetos/calendario" />}
                        />
                        <Route path="/disciplinas" element={<Navigate to="/projetos/disciplinas" replace />} />
                        <Route path="/cronograma" element={<Navigate to="/projetos/cronograma" replace />} />
                        <Route path="/mapa" element={<Navigate to="/projetos/mapa" replace />} />
                        <Route
                          path="/relatorios"
                          element={<Navigate to="/gestao/financeiro?tab=relatorios" replace />}
                        />

                        {/* Revisão IA virou aba dentro de Agentes; redireciona links antigos.
                          O gate de owner (ACH-ADM-01) agora vive na própria aba. */}
                        <Route path="/revisao-ia" element={<Navigate to="/agentes?tab=revisao" replace />} />
                        <Route path="/company-setup" element={<CompanySetup />} />
                        <Route path="/profile-setup" element={<ProfileSetup />} />

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

                      <Route
                        path="/rentabilidade"
                        element={<Navigate to="/gestao/financeiro?tab=rentabilidade" replace />}
                      />

                      {/* Portal do Cliente — Autenticado */}
                      <Route path="/portal" element={<Navigate to="/cliente/login" replace />} />
                      <Route path="/cliente/login" element={<ClienteLogin />} />
                      <Route path="/cliente" element={<ClientePrivateRoute />}>
                        <Route path="dashboard" element={<ClienteDashboard />} />
                        <Route path="projeto/:id" element={<ClienteProjetoDetail />} />
                        <Route path="projeto/:id/financeiro" element={<ClienteProjetoDetail />} />
                        <Route path="projeto/:id/entregas" element={<ClienteProjetoDetail />} />
                        <Route path="obra/:id" element={<ClienteObraDetail />} />
                      </Route>

                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Suspense>
                  <SettingsDialog />
                </SettingsModalProvider>
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
