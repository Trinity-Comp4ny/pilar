import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./AuthContext";
import { STORAGE_KEYS } from "@/constants";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  single: vi.fn(),
  signOut: vi.fn(),
  getAAL: vi.fn(),
  listFactors: vi.fn(),
  captureException: vi.fn(),
  setUser: vi.fn(),
  reset: vi.fn(),
  onAuthStateChange: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ single: mocks.single }) }) }),
    auth: {
      getSession: mocks.getSession,
      signOut: mocks.signOut,
      onAuthStateChange: mocks.onAuthStateChange,
      mfa: { getAuthenticatorAssuranceLevel: mocks.getAAL, listFactors: mocks.listFactors },
    },
  },
}));
vi.mock("@/lib/monitoring", () => ({
  monitoring: { setUser: mocks.setUser, captureException: mocks.captureException },
}));
vi.mock("@/lib/analytics", () => ({ analytics: { identify: vi.fn(), reset: mocks.reset } }));
vi.mock("@/lib/cookieConsentSync", () => ({ syncConsentForUser: vi.fn() }));

function Probe() {
  const a = useAuth();
  if (a.loading) return <div>loading</div>;
  return (
    <div>
      <span data-testid="auth">{a.isAuthenticated ? "in" : "out"}</span>
      <span data-testid="profile">{a.profile?.id ?? "none"}</span>
      <span data-testid="profile-error">{String(a.profileError)}</span>
      <span data-testid="mfa">{a.mfaChallengeRequired ? "challenge" : "ok"}</span>
      <span data-testid="factor">{String(a.hasVerifiedMfaFactor)}</span>
      <button onClick={() => void a.signOut()}>sair</button>
    </div>
  );
}

let queryClient: QueryClient;
function renderAuth() {
  queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>
  );
}

const sessao = { user: { id: "bia" } };

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  document.cookie = "pilar_logged_hint=; path=/; max-age=0";
  mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
  mocks.single.mockResolvedValue({ data: { id: "bia", empresa_id: "e1", role: "admin" }, error: null });
  mocks.getAAL.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal1" } });
  mocks.listFactors.mockResolvedValue({ data: { totp: [] } });
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
});

describe("AuthContext: sessão, MFA e saída", () => {
  it("useAuth fora do provider falha alto", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow("useAuth must be used within an AuthProvider");
    spy.mockRestore();
  });

  it("sem sessão: não autenticado, sem profile e sem cookie de dica", async () => {
    renderAuth();
    expect(await screen.findByTestId("auth")).toHaveTextContent("out");
    expect(screen.getByTestId("profile")).toHaveTextContent("none");
    expect(mocks.single).not.toHaveBeenCalled();
    expect(document.cookie).not.toContain("pilar_logged_hint=1");
  });

  it("erro ao ler a sessão é reportado e trata como deslogado (fail-closed)", async () => {
    const err = new Error("storage corrompido");
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: err });
    renderAuth();
    expect(await screen.findByTestId("auth")).toHaveTextContent("out");
    expect(mocks.captureException).toHaveBeenCalledWith(err, { context: "auth-session-init" });
  });

  it("com sessão: carrega profile e telemetria só recebe id/empresa/role", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: sessao }, error: null });
    mocks.single.mockResolvedValue({
      data: { id: "bia", empresa_id: "e1", role: "admin", email: "bia@x.com", contato: "11999" },
      error: null,
    });
    renderAuth();
    expect(await screen.findByTestId("profile")).toHaveTextContent("bia");
    expect(screen.getByTestId("auth")).toHaveTextContent("in");
    expect(mocks.setUser).toHaveBeenCalledWith({ id: "bia", empresa_id: "e1", role: "admin" });
    expect(document.cookie).toContain("pilar_logged_hint=1");
  });

  it("erro de banco que não é 'sem linhas' marca profileError (sem loading infinito)", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: sessao }, error: null });
    mocks.single.mockResolvedValue({ data: null, error: { code: "42501", message: "permission denied" } });
    renderAuth();
    expect(await screen.findByTestId("profile-error")).toHaveTextContent("true");
    expect(mocks.captureException).toHaveBeenCalledWith(
      expect.objectContaining({ code: "42501" }),
      expect.objectContaining({ context: "fetchProfile" })
    );
  });

  it("fator TOTP verificado em aal1 exige desafio MFA", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: sessao }, error: null });
    mocks.getAAL.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal2" } });
    mocks.listFactors.mockResolvedValue({ data: { totp: [{ id: "f", status: "verified" }] } });
    renderAuth();
    expect(await screen.findByTestId("mfa")).toHaveTextContent("challenge");
    expect(screen.getByTestId("factor")).toHaveTextContent("true");
  });

  it("aal2 já atingido não pede desafio", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: sessao }, error: null });
    mocks.getAAL.mockResolvedValue({ data: { currentLevel: "aal2", nextLevel: "aal2" } });
    renderAuth();
    expect(await screen.findByTestId("mfa")).toHaveTextContent("ok");
  });

  it("signOut limpa sessão, storage sensível, cache do react-query e telemetria", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: sessao }, error: null });
    renderAuth();
    await screen.findByTestId("profile");
    localStorage.setItem(STORAGE_KEYS.AUTH, "x");
    localStorage.setItem(STORAGE_KEYS.USER_NAME, "Bia");
    localStorage.setItem(STORAGE_KEYS.REMEMBER_ME, "1");
    localStorage.setItem(STORAGE_KEYS.CHAT_SNAPSHOT, "conversa");
    queryClient.setQueryData(["dado-sensivel"], { valor: 1 });

    await act(async () => screen.getByRole("button", { name: "sair" }).click());

    await waitFor(() => expect(screen.getByTestId("auth")).toHaveTextContent("out"));
    expect(mocks.signOut).toHaveBeenCalled();
    expect(screen.getByTestId("profile")).toHaveTextContent("none");
    expect(localStorage.getItem(STORAGE_KEYS.AUTH)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.USER_NAME)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.REMEMBER_ME)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.CHAT_SNAPSHOT)).toBeNull();
    expect(queryClient.getQueryData(["dado-sensivel"])).toBeUndefined();
    expect(mocks.setUser).toHaveBeenLastCalledWith(null);
    expect(mocks.reset).toHaveBeenCalled();
  });

  it("evento SIGNED_OUT derruba a sessão e apaga o cookie de dica", async () => {
    let cb: (e: string, s: unknown) => void = () => {};
    mocks.onAuthStateChange.mockImplementation((fn) => {
      cb = fn;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    mocks.getSession.mockResolvedValue({ data: { session: sessao }, error: null });
    renderAuth();
    expect(await screen.findByTestId("auth")).toHaveTextContent("in");
    act(() => cb("SIGNED_OUT", null));
    expect(await screen.findByTestId("auth")).toHaveTextContent("out");
    expect(screen.getByTestId("profile")).toHaveTextContent("none");
    expect(document.cookie).not.toContain("pilar_logged_hint=1");
  });

  it("token do portal do cliente não autentica o app interno", async () => {
    sessionStorage.setItem("pilar_portal_token", "token-do-portal");
    renderAuth();
    expect(await screen.findByTestId("auth")).toHaveTextContent("out");
    sessionStorage.clear();
  });
});
