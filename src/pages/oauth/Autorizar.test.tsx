import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Autorizar from "./Autorizar";

const { auth, oauth, irPara } = vi.hoisted(() => ({
  auth: {
    loading: false,
    isAuthenticated: true,
    mfaChallengeRequired: false,
    profile: { empresas: { nome: "Escritório Exemplo" } } as unknown,
    user: { email: "dev@local.test" } as unknown,
    signOut: vi.fn(),
  },
  oauth: {
    getAuthorizationDetails: vi.fn(),
    approveAuthorization: vi.fn(),
    denyAuthorization: vi.fn(),
  },
  irPara: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { oauth } } }));
vi.mock("@/hooks/usePageTitle", () => ({ usePageTitle: vi.fn() }));
vi.mock("@/lib/mfaDevBypass", () => ({ mfaDevBypass: () => false }));
vi.mock("@/lib/monitoring", () => ({ monitoring: { captureException: vi.fn() } }));
vi.mock("@/components/motion/EntryVeil", () => ({ EntryVeil: () => <div data-testid="veu" /> }));
vi.mock("@/lib/oauthPendente", async (original) => ({
  ...(await original<typeof import("@/lib/oauthPendente")>()),
  irPara,
}));

const ID = "auth_1234abcd";

function renderPage(url = `/oauth/autorizar?authorization_id=${ID}`) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/oauth/autorizar" element={<Autorizar />} />
        <Route path="/login" element={<div data-testid="login" />} />
        <Route path="/mfa" element={<div data-testid="mfa" />} />
        <Route path="/inicio" element={<div data-testid="inicio" />} />
      </Routes>
    </MemoryRouter>
  );
}

const detalhes = {
  authorization_id: ID,
  redirect_uri: "https://chatgpt.com/connector/oauth/cb",
  client: { id: "c1", name: "ChatGPT", uri: "", logo_uri: "" },
  user: { id: "u1", email: "dev@local.test" },
  scope: "openid email profile",
};

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  auth.loading = false;
  auth.isAuthenticated = true;
  auth.mfaChallengeRequired = false;
  auth.signOut.mockResolvedValue(undefined);
  oauth.getAuthorizationDetails.mockResolvedValue({ data: detalhes, error: null });
});

describe("tela de autorização do conector (SPEC 151)", () => {
  it("mostra quem pede, o escritório, o que pode e o que não pode, e para onde volta", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "Conectar ChatGPT à Pilar" })).toBeInTheDocument();
    expect(screen.getByText("Escritório Exemplo")).toBeInTheDocument();
    expect(screen.getByText("Criar, alterar ou apagar nada na Pilar")).toBeInTheDocument();
    expect(screen.getByText("chatgpt.com")).toBeInTheDocument();
    expect(oauth.getAuthorizationDetails).toHaveBeenCalledWith(ID);
  });

  it("permitir aprova sem redirect automático e volta para o app pelo endereço do Supabase", async () => {
    oauth.approveAuthorization.mockResolvedValue({
      data: { redirect_url: "https://chatgpt.com/connector/oauth/cb?code=abc&state=x" },
      error: null,
    });
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Permitir acesso" }));
    expect(oauth.approveAuthorization).toHaveBeenCalledWith(ID, { skipBrowserRedirect: true });
    await waitFor(() => expect(irPara).toHaveBeenCalledWith("https://chatgpt.com/connector/oauth/cb?code=abc&state=x"));
  });

  it("recusar nega e volta para o app com o erro", async () => {
    oauth.denyAuthorization.mockResolvedValue({
      data: { redirect_url: "https://chatgpt.com/connector/oauth/cb?error=access_denied" },
      error: null,
    });
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Recusar" }));
    expect(oauth.denyAuthorization).toHaveBeenCalledWith(ID, { skipBrowserRedirect: true });
    await waitFor(() =>
      expect(irPara).toHaveBeenCalledWith("https://chatgpt.com/connector/oauth/cb?error=access_denied")
    );
    expect(oauth.approveAuthorization).not.toHaveBeenCalled();
  });

  it("não segue redirect perigoso devolvido na decisão", async () => {
    oauth.approveAuthorization.mockResolvedValue({ data: { redirect_url: "javascript:alert(1)" }, error: null });
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Permitir acesso" }));
    expect(await screen.findByRole("heading", { name: "Não deu para conectar" })).toBeInTheDocument();
    expect(irPara).not.toHaveBeenCalled();
  });

  it("já autorizado antes: volta direto, sem mostrar a tela", async () => {
    oauth.getAuthorizationDetails.mockResolvedValue({
      data: { redirect_url: "https://claude.ai/api/mcp/auth_callback?code=1" },
      error: null,
    });
    renderPage();
    await waitFor(() => expect(irPara).toHaveBeenCalledWith("https://claude.ai/api/mcp/auth_callback?code=1"));
    expect(screen.queryByRole("button", { name: "Permitir acesso" })).not.toBeInTheDocument();
  });

  it("pedido expirado ou inválido mostra o erro", async () => {
    oauth.getAuthorizationDetails.mockResolvedValue({ data: null, error: { message: "not found" } });
    renderPage();
    expect(await screen.findByRole("heading", { name: "Não deu para conectar" })).toBeInTheDocument();
  });

  it("sem authorization_id válido nem consulta o Supabase", () => {
    renderPage("/oauth/autorizar?authorization_id=<x>");
    expect(screen.getByRole("heading", { name: "Não deu para conectar" })).toBeInTheDocument();
    expect(oauth.getAuthorizationDetails).not.toHaveBeenCalled();
  });

  it("sem login guarda o pedido e manda para o login", () => {
    auth.isAuthenticated = false;
    renderPage();
    expect(screen.getByTestId("login")).toBeInTheDocument();
    expect(sessionStorage.getItem("pilar_oauth_autorizacao")).toBe(ID);
    expect(oauth.getAuthorizationDetails).not.toHaveBeenCalled();
  });

  it("falta o segundo fator: guarda o pedido e manda para o MFA", () => {
    auth.mfaChallengeRequired = true;
    renderPage();
    expect(screen.getByTestId("mfa")).toBeInTheDocument();
    expect(sessionStorage.getItem("pilar_oauth_autorizacao")).toBe(ID);
  });

  it("ao assumir o pedido, limpa o pendente (o PrivateRoute não traz de volta)", async () => {
    sessionStorage.setItem("pilar_oauth_autorizacao", ID);
    renderPage();
    await screen.findByRole("button", { name: "Permitir acesso" });
    expect(sessionStorage.getItem("pilar_oauth_autorizacao")).toBeNull();
  });

  it("trocar de conta sai, guarda o pedido e vai para o login", async () => {
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Trocar de conta" }));
    expect(auth.signOut).toHaveBeenCalled();
    expect(await screen.findByTestId("login")).toBeInTheDocument();
    expect(sessionStorage.getItem("pilar_oauth_autorizacao")).toBe(ID);
  });
});
