import { Suspense, lazy, useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { monitoring } from "@/lib/monitoring";
import { getSafeErrorMessage, getRawErrorMessage } from "@/lib/safeError";
import { usePageTracking } from "@/hooks/usePageTracking";
import { AuthProvider } from "@/contexts/AuthContext";
import { ImpersonationProvider } from "@/contexts/ImpersonationContext";
import { PageSkeleton } from "@/components/PageSkeleton";
import { PrivateRoute } from "./components/PrivateRoute";
import { ClientePrivateRoute } from "./components/ClientePrivateRoute";
import { CampoPrivateRoute } from "./components/CampoPrivateRoute";
import { AdminRoute } from "./components/AdminRoute";
import { UltraAdminRoute } from "./components/UltraAdminRoute";
import { FeatureRoute } from "./components/FeatureRoute";
import { ImpersonationBanner } from "./components/ImpersonationBanner";
import { TrialBanner } from "./components/TrialBanner";
import { SettingsModalProvider, useSettingsModal, type SettingsSection } from "./contexts/SettingsModalContext";
import { ValoresOcultosProvider } from "./contexts/ValoresOcultosContext";
import { MARKETING_URL, isProductionAppHost } from "./lib/marketingSite";

// Modal de configuracoes: so monta quando o usuario abre. Estatico, arrastava os
// 6 paineis (empresa, pagamento, uso...) pro entry chunk e estourava o budget.
const SettingsDialog = lazy(() =>
  import("./components/settings/SettingsDialog").then((m) => ({ default: m.SettingsDialog }))
);

const Checkout = lazy(() => import("./pages/checkout"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const Inicio = lazy(() => import("./pages/inicio"));
const ComprarTokens = lazy(() => import("./pages/comprar-tokens"));
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
const Timesheet = lazy(() => import("./pages/Timesheet"));
const Chat = lazy(() => import("./pages/chat"));
const Propostas = lazy(() => import("./pages/propostas"));
const ProjetoDetail = lazy(() => import("./pages/projetos/ProjetoDetail"));
const ClienteLogin = lazy(() => import("./pages/cliente/ClienteLogin"));
const CampoLogin = lazy(() => import("./pages/campo/CampoLogin"));
const CampoTrocarSenha = lazy(() => import("./pages/campo/CampoTrocarSenha"));
const CampoHome = lazy(() => import("./pages/campo/CampoHome"));
const CampoRegistrarDia = lazy(() => import("./pages/campo/CampoRegistrarDia"));
const ClienteDashboard = lazy(() => import("./pages/cliente/ClienteDashboard"));
const ClienteObraDetail = lazy(() => import("./pages/cliente/ClienteObraDetail"));
const ClienteProjetoDetail = lazy(() => import("./pages/cliente/ClienteProjetoDetail"));
const NotFound = lazy(() => import("./pages/NotFound"));
const StatusPage = lazy(() => import("./pages/status"));
const Admin = lazy(() => import("./pages/admin"));
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
      onError: (error, variables) => {
        toast.error(getSafeErrorMessage(error));
        // Supabase retorna PostgrestError (objeto plano, não instanceof Error);
        // sem isso o Sentry recebia "[object Object]" e perdia a causa real.
        const raw = getRawErrorMessage(error) || "Erro inesperado";
        monitoring.captureException(error instanceof Error ? error : new Error(raw), {
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
    const raw = getRawErrorMessage(err) || "Erro inesperado";
    monitoring.captureException(err instanceof Error ? err : new Error(raw), {
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

// Conteúdo público (landing, planos, termos, privacidade) vive em
// pilarsoft.com.br (apps/marketing, ADR 0021/0025); estas rotas só existem
// aqui pra quem ainda tem o link antigo salvo.
function ExternalRedirect({ path = "" }: { path?: string }) {
  const navigate = useNavigate();

  useEffect(() => {
    // Fora de app.pilarsoft.com.br (staging, preview, localhost) não existe
    // marketing correspondente: cair no /login local em vez de vazar pro
    // marketing de PRODUÇÃO (ver isProductionAppHost).
    if (!isProductionAppHost()) {
      navigate("/login", { replace: true });
      return;
    }
    window.location.replace(`${MARKETING_URL}${path}`);
  }, [path, navigate]);
  return null;
}

// /profile, /company e /billing viraram abas do SettingsDialog (modal, sem rota
// própria). Link antigo abre a aba certa em vez de cair no NotFound.
function SettingsRedirect({ section }: { section: SettingsSection }) {
  const { openSettings } = useSettingsModal();
  const navigate = useNavigate();

  useEffect(() => {
    openSettings(section);
    navigate("/inicio", { replace: true });
  }, [section, openSettings, navigate]);

  return null;
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
                  <ValoresOcultosProvider>
                    <ImpersonationBanner />
                    <TrialBanner />
                    <Suspense fallback={<PageSkeleton />}>
                      <Routes>
                        <Route path="/" element={<ExternalRedirect />} />
                        <Route path="/planos" element={<ExternalRedirect path="/planos" />} />
                        <Route path="/termos" element={<ExternalRedirect path="/termos" />} />
                        <Route path="/privacidade" element={<ExternalRedirect path="/privacidade" />} />
                        <Route path="/checkout" element={<Checkout />} />
                        <Route path="/login" element={<Login />} />
                        <Route path="/cadastro" element={<Signup />} />
                        <Route path="/auth/callback" element={<AuthCallback />} />
                        <Route path="/forgot-password" element={<ForgotPassword />} />
                        <Route path="/reset-password" element={<PasswordReset />} />
                        <Route path="/status" element={<StatusPage />} />

                        {/* Fora do grupo PrivateRoute de propósito: checkout de compra de
                          tokens é full-bleed (mesmo tratamento visual do /checkout público,
                          SPEC 082), sem a sidebar do app. Guarda de autenticação própria
                          dentro do componente, mesmo padrão de /profile-setup. */}
                        <Route path="/comprar-tokens" element={<ComprarTokens />} />

                        <Route element={<PrivateRoute />}>
                          <Route path="/inicio" element={<Inicio />} />

                          {/* ===== Rotas aninhadas por módulo (ADR 0016) ===== */}

                          {/* Obras (reaberto — ADR 0011, spec 015): fase de execução do projeto. */}
                          <Route element={<FeatureRoute feature="obras" />}>
                            <Route path="/obras" element={<Obras />} />
                            {/* Sub-features do módulo Obras (spec 035): gate próprio,
                              herda o módulo ligado via parent em features.ts. */}
                            <Route element={<FeatureRoute feature="obras_clima" />}>
                              <Route path="/obras/clima" element={<ObraClima />} />
                            </Route>
                            {/* Fornecedor mora no módulo Obra (spec 026). */}
                            <Route element={<FeatureRoute feature="obras_fornecedores" />}>
                              <Route path="/obras/fornecedores" element={<Fornecedores />} />
                              <Route path="/obras/fornecedores/:id" element={<FornecedorDetalhe />} />
                            </Route>
                            <Route path="/obras/:id" element={<ObraDetalhe />} />
                          </Route>

                          {/* Gestão: /gestao abre a primeira aba; cada aba vive em /gestao/*. */}
                          <Route path="/gestao" element={<Navigate to="/gestao/tarefas" replace />} />
                          <Route element={<FeatureRoute feature="meu_trabalho" />}>
                            <Route path="/gestao/tarefas" element={<MeuTrabalho />} />
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
                          {/* Financeiro: gate de módulo da empresa + RLS. Desde o
                          ADR 0029 não há recorte por usuário. */}
                          <Route element={<FeatureRoute feature="financeiro" />}>
                            <Route path="/gestao/financeiro" element={<Financeiro />} />
                          </Route>
                          {/* Equipe (RH: cadastro; salário nunca sai daqui, é mascarado por
                          can_view_folha() em pessoas_safe independente de role): admin sempre
                          vê, coordenador só com concessão explícita (financeiro/equipe/metas). */}
                          <Route element={<FeatureRoute feature="pessoas" />}>
                            <Route path="/gestao/equipe" element={<Pessoas />} />
                          </Route>
                          <Route element={<FeatureRoute feature="metas" />}>
                            <Route path="/gestao/metas" element={<Metas />} />
                          </Route>
                          <Route element={<FeatureRoute feature="timesheet" />}>
                            <Route path="/gestao/timesheet" element={<Timesheet />} />
                          </Route>
                          {/* Projetos (coleção + lentes de recorte; a lente vem do pathname).
                          Estáticas antes de /projetos/:id para o segmento estático vencer. */}
                          <Route element={<FeatureRoute feature="projetos" />}>
                            <Route path="/projetos" element={<Projetos />} />
                            <Route path="/projetos/disciplinas" element={<Projetos />} />
                            <Route path="/projetos/cronograma" element={<Projetos />} />
                            <Route
                              path="/projetos/calendario"
                              element={<Navigate to="/projetos/cronograma" replace />}
                            />
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
                            element={<RedirectPrefix from="/meu-trabalho" to="/gestao/tarefas" />}
                          />
                          <Route
                            path="/gestao/meu-trabalho/*"
                            element={<RedirectPrefix from="/gestao/meu-trabalho" to="/gestao/tarefas" />}
                          />
                          <Route path="/leads/*" element={<RedirectPrefix from="/leads" to="/gestao/leads" />} />
                          <Route
                            path="/clientes/*"
                            element={<RedirectPrefix from="/clientes" to="/gestao/clientes" />}
                          />
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
                            path="/timesheet/*"
                            element={<RedirectPrefix from="/timesheet" to="/gestao/timesheet" />}
                          />
                          <Route
                            path="/fornecedores/*"
                            element={<RedirectPrefix from="/fornecedores" to="/obras/fornecedores" />}
                          />
                          <Route path="/calendario/*" element={<Navigate to="/projetos/cronograma" replace />} />
                          <Route path="/disciplinas" element={<Navigate to="/projetos/disciplinas" replace />} />
                          <Route path="/cronograma" element={<Navigate to="/projetos/cronograma" replace />} />
                          <Route path="/mapa" element={<Navigate to="/projetos/mapa" replace />} />
                          <Route
                            path="/relatorios"
                            element={<Navigate to="/gestao/financeiro?tab=relatorios" replace />}
                          />

                          {/* Revisão IA virou aba dentro de Agentes; redireciona links antigos.
                          O gate de owner (ACH-ADM-01) agora vive na própria aba. */}
                          <Route path="/revisao-ia" element={<Navigate to="/agentes" replace />} />
                          <Route path="/company-setup" element={<CompanySetup />} />
                          <Route path="/profile-setup" element={<ProfileSetup />} />
                          <Route path="/profile" element={<SettingsRedirect section="conta" />} />
                          <Route path="/company" element={<SettingsRedirect section="empresa" />} />
                          <Route path="/billing" element={<SettingsRedirect section="pagamento" />} />

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

                        {/* Portal do Cliente — Autenticado. O splat cobre o portal público
                        por token legado (/portal/:token/*), removido em 2026-05-06:
                        cliente com link antigo salvo cai aqui em vez de 404. */}
                        <Route path="/portal/*" element={<Navigate to="/cliente/login" replace />} />
                        <Route path="/cliente/login" element={<ClienteLogin />} />
                        <Route path="/cliente" element={<ClientePrivateRoute />}>
                          <Route path="dashboard" element={<ClienteDashboard />} />
                          <Route path="projeto/:id" element={<ClienteProjetoDetail />} />
                          <Route path="projeto/:id/financeiro" element={<ClienteProjetoDetail />} />
                          <Route path="projeto/:id/entregas" element={<ClienteProjetoDetail />} />
                          <Route path="obra/:id" element={<ClienteObraDetail />} />
                        </Route>

                        {/* Pilar Campo — app de campo (conta própria, escopo por obra) */}
                        <Route path="/campo/login" element={<CampoLogin />} />
                        <Route path="/campo/senha" element={<CampoTrocarSenha />} />
                        <Route path="/campo" element={<CampoPrivateRoute />}>
                          <Route index element={<CampoHome />} />
                          <Route path="dia" element={<CampoRegistrarDia />} />
                        </Route>

                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </Suspense>
                    <Suspense fallback={null}>
                      <SettingsDialog />
                    </Suspense>
                  </ValoresOcultosProvider>
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
