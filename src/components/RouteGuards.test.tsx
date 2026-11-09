import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useOutletContext, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { AdminRoute } from "./AdminRoute";
import { FeatureRoute } from "./FeatureRoute";
import { UltraAdminRoute } from "./UltraAdminRoute";
import { ClientePrivateRoute } from "./ClientePrivateRoute";
import { CampoPrivateRoute } from "./CampoPrivateRoute";
import { ImpersonationContext } from "@/contexts/ImpersonationContext";
import type { UserRole } from "@/lib/permissions";

/**
 * Guards de rota com a matriz de permissões REAL (usePermissions + canDo): só
 * o AuthContext e o Supabase são falsos. Uma mudança em permissions.ts que abra
 * /admin para colaborador, por exemplo, reprova aqui.
 */

const { authState, rpc, campoState } = vi.hoisted(() => ({
  authState: {
    loading: false,
    profile: null as null | Record<string, unknown>,
    mfaCurrentLevel: "aal1",
    mfaNextLevel: "aal1",
  },
  rpc: vi.fn(),
  campoState: {
    account: null as null | { must_change_senha?: boolean; nome?: string },
    loading: false,
    error: null as string | null,
  },
}));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => authState }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
vi.mock("@/pages/campo/useCampoAuth", () => ({ useCampoAuth: () => campoState }));
vi.mock("@/pages/cliente/ForcarTrocaSenha", () => ({
  default: ({ onSuccess }: { onSuccess: () => void }) => (
    <button type="button" onClick={onSuccess} data-testid="forcar-troca">
      Trocar senha
    </button>
  ),
}));

function Destino() {
  const loc = useLocation();
  return <div data-testid="destino">{loc.pathname + loc.search}</div>;
}

function ContaPortal() {
  const account = useOutletContext<{ nome: string }>();
  return <div data-testid="portal">{account.nome}</div>;
}

function perfil(role: string, extra: Record<string, unknown> = {}) {
  return { id: "u1", empresa_id: "e1", role, empresas: { features: null }, ...extra };
}

function renderInterno(guard: ReactNode, path: string, wrapper?: (c: ReactNode) => ReactNode) {
  const tree = (
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={guard}>
          <Route path={path} element={<div data-testid="liberado">ok</div>} />
        </Route>
        <Route path="/sem-acesso" element={<Destino />} />
        <Route path="/mfa" element={<Destino />} />
        <Route path="/mfa/setup" element={<Destino />} />
      </Routes>
    </MemoryRouter>
  );
  return render(wrapper ? wrapper(tree) : tree);
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  localStorage.clear();
  authState.loading = false;
  authState.profile = null;
  authState.mfaCurrentLevel = "aal1";
  authState.mfaNextLevel = "aal1";
  campoState.account = null;
  campoState.loading = false;
  campoState.error = null;
});

describe("AdminRoute", () => {
  it.each(["colaborador", "coordenador", "user", "viewer"])("%s é barrado em /admin", (role) => {
    authState.profile = perfil(role);
    renderInterno(<AdminRoute />, "/admin");
    expect(screen.getByTestId("destino")).toHaveTextContent("/sem-acesso?recurso=admin_portal");
    expect(screen.queryByTestId("liberado")).not.toBeInTheDocument();
  });

  it("sem profile (sem empresa/role) é barrado", () => {
    renderInterno(<AdminRoute />, "/admin");
    expect(screen.getByTestId("destino")).toHaveTextContent("/sem-acesso?recurso=admin_portal");
  });

  it.each(["admin", "ultra_admin"])("%s entra em /admin", (role) => {
    authState.profile = perfil(role);
    renderInterno(<AdminRoute />, "/admin");
    expect(screen.getByTestId("liberado")).toBeInTheDocument();
  });

  it("admin simulando colaborador perde o acesso ao /admin", () => {
    authState.profile = perfil("admin");
    renderInterno(<AdminRoute />, "/admin", (c) => (
      <ImpersonationContext.Provider
        value={{
          viewAsRole: "colaborador" as UserRole,
          isImpersonating: true,
          loading: false,
          startImpersonation: vi.fn(),
          stopImpersonation: vi.fn(),
        }}
      >
        {c}
      </ImpersonationContext.Provider>
    ));
    expect(screen.getByTestId("destino")).toHaveTextContent("recurso=admin_portal");
  });

  it("enquanto carrega não decide (nem libera nem redireciona)", () => {
    authState.loading = true;
    renderInterno(<AdminRoute />, "/admin");
    expect(screen.queryByTestId("liberado")).not.toBeInTheDocument();
    expect(screen.queryByTestId("destino")).not.toBeInTheDocument();
  });
});

describe("FeatureRoute", () => {
  it("colaborador não acessa Equipe (pessoas)", () => {
    authState.profile = perfil("colaborador");
    renderInterno(<FeatureRoute feature="pessoas" />, "/pessoas");
    expect(screen.getByTestId("destino")).toHaveTextContent("/sem-acesso?recurso=pessoas");
  });

  it("colaborador com flag de delegação continua sem acesso (só coordenador pode receber)", () => {
    authState.profile = perfil("colaborador", { equipe_delegado: true });
    renderInterno(<FeatureRoute feature="pessoas" />, "/pessoas");
    expect(screen.getByTestId("destino")).toHaveTextContent("recurso=pessoas");
  });

  it("coordenador sem concessão não acessa metas; com concessão acessa", () => {
    authState.profile = perfil("coordenador");
    const view = renderInterno(<FeatureRoute feature="metas" />, "/metas");
    expect(screen.getByTestId("destino")).toHaveTextContent("recurso=metas");
    view.unmount();
    authState.profile = perfil("coordenador", { metas_delegado: true });
    renderInterno(<FeatureRoute feature="metas" />, "/metas");
    expect(screen.getByTestId("liberado")).toBeInTheDocument();
  });

  it("coordenador com financeiro delegado acessa o financeiro", () => {
    authState.profile = perfil("coordenador", { financeiro_delegado: true });
    renderInterno(<FeatureRoute feature="financeiro" />, "/financeiro");
    expect(screen.getByTestId("liberado")).toBeInTheDocument();
  });

  it("admin acessa Equipe", () => {
    authState.profile = perfil("admin");
    renderInterno(<FeatureRoute feature="pessoas" />, "/pessoas");
    expect(screen.getByTestId("liberado")).toBeInTheDocument();
  });

  it("folha de pagamento é só de admin", () => {
    authState.profile = perfil("coordenador", { financeiro_delegado: true });
    renderInterno(<FeatureRoute feature="financeiro_folha" />, "/folha");
    expect(screen.getByTestId("destino")).toHaveTextContent("recurso=financeiro_folha");
  });
});

describe("UltraAdminRoute", () => {
  it("admin de empresa não entra no ultra-admin", () => {
    authState.profile = perfil("admin");
    authState.mfaCurrentLevel = "aal2";
    renderInterno(<UltraAdminRoute />, "/ultra-admin");
    expect(screen.getByTestId("destino")).toHaveTextContent("/sem-acesso?recurso=ultra_admin");
  });

  it("ultra-admin sem fator cadastrado vai para o setup de MFA", () => {
    authState.profile = perfil("ultra_admin");
    renderInterno(<UltraAdminRoute />, "/ultra-admin");
    expect(screen.getByTestId("destino")).toHaveTextContent("/mfa/setup");
  });

  it("ultra-admin com fator mas sem aal2 vai para o desafio", () => {
    authState.profile = perfil("ultra_admin");
    authState.mfaNextLevel = "aal2";
    renderInterno(<UltraAdminRoute />, "/ultra-admin");
    expect(screen.getByTestId("destino")).toHaveTextContent(/^\/mfa$/);
  });

  it("ultra-admin com aal2 entra", () => {
    authState.profile = perfil("ultra_admin");
    authState.mfaCurrentLevel = "aal2";
    authState.mfaNextLevel = "aal2";
    renderInterno(<UltraAdminRoute />, "/ultra-admin");
    expect(screen.getByTestId("liberado")).toBeInTheDocument();
  });
});

function renderPortal() {
  return render(
    <MemoryRouter initialEntries={["/cliente/dashboard"]}>
      <Routes>
        <Route path="/cliente" element={<ClientePrivateRoute />}>
          <Route path="dashboard" element={<ContaPortal />} />
        </Route>
        <Route path="/cliente/login" element={<LoginPortal />} />
      </Routes>
    </MemoryRouter>
  );
}

function LoginPortal() {
  const loc = useLocation();
  return <div data-testid="login-portal">{(loc.state as { reason?: string } | null)?.reason ?? "sem-motivo"}</div>;
}

describe("ClientePrivateRoute (portal do cliente)", () => {
  it("sem token vai para o login do portal sem motivo", async () => {
    renderPortal();
    expect(await screen.findByTestId("login-portal")).toHaveTextContent("sem-motivo");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("token inválido/expirado limpa o token e avisa sessão expirada", async () => {
    sessionStorage.setItem("pilar_portal_token", "velho");
    rpc.mockResolvedValue({ data: null, error: null });
    renderPortal();
    expect(await screen.findByTestId("login-portal")).toHaveTextContent("expired");
    expect(sessionStorage.getItem("pilar_portal_token")).toBeNull();
  });

  it("erro de servidor também derruba a sessão (fail-closed)", async () => {
    sessionStorage.setItem("pilar_portal_token", "tok");
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    renderPortal();
    expect(await screen.findByTestId("login-portal")).toHaveTextContent("expired");
    expect(sessionStorage.getItem("pilar_portal_token")).toBeNull();
  });

  it("sessão válida rotaciona o token e entrega a conta às rotas filhas", async () => {
    sessionStorage.setItem("pilar_portal_token", "tok");
    rpc.mockResolvedValue({
      data: { id: "c1", cliente_id: "cl", empresa_id: "e1", nome: "Cliente Seed", email: "c@x.com", new_token: "tok2" },
      error: null,
    });
    renderPortal();
    expect(await screen.findByTestId("portal")).toHaveTextContent("Cliente Seed");
    expect(rpc).toHaveBeenCalledWith("portal_verify_session", { p_token: "tok" });
    expect(sessionStorage.getItem("pilar_portal_token")).toBe("tok2");
  });

  it("senha temporária bloqueia o portal até trocar", async () => {
    sessionStorage.setItem("pilar_portal_token", "tok");
    rpc.mockResolvedValueOnce({
      data: {
        id: "c1",
        cliente_id: "cl",
        empresa_id: "e1",
        nome: "Cliente",
        email: "c@x.com",
        must_change_password: true,
      },
      error: null,
    });
    renderPortal();
    const trocar = await screen.findByTestId("forcar-troca");
    expect(screen.queryByTestId("portal")).not.toBeInTheDocument();
    rpc.mockResolvedValueOnce({
      data: { id: "c1", cliente_id: "cl", empresa_id: "e1", nome: "Cliente", email: "c@x.com" },
      error: null,
    });
    trocar.click();
    expect(await screen.findByTestId("portal")).toBeInTheDocument();
  });
});

describe("CampoPrivateRoute", () => {
  function renderCampo() {
    return render(
      <MemoryRouter initialEntries={["/campo"]}>
        <Routes>
          <Route path="/campo" element={<CampoPrivateRoute />}>
            <Route index element={<div data-testid="campo-home">home</div>} />
          </Route>
          <Route path="/campo/login" element={<div data-testid="campo-login" />} />
          <Route path="/campo/senha" element={<div data-testid="campo-senha" />} />
        </Routes>
      </MemoryRouter>
    );
  }

  it("carregando mostra o véu do Campo", () => {
    campoState.loading = true;
    renderCampo();
    expect(screen.getByRole("status")).toHaveTextContent("Abrindo o Pilar Campo");
  });

  it("sem sessão vai para o login do Campo", () => {
    renderCampo();
    expect(screen.getByTestId("campo-login")).toBeInTheDocument();
  });

  it("erro de sessão vai para o login mesmo com conta em cache", () => {
    campoState.account = { nome: "x" };
    campoState.error = "session_expired";
    renderCampo();
    expect(screen.getByTestId("campo-login")).toBeInTheDocument();
  });

  it("senha provisória força a troca", () => {
    campoState.account = { must_change_senha: true };
    renderCampo();
    expect(screen.getByTestId("campo-senha")).toBeInTheDocument();
  });

  it("conta válida entra", () => {
    campoState.account = { must_change_senha: false };
    renderCampo();
    expect(screen.getByTestId("campo-home")).toBeInTheDocument();
  });
});
