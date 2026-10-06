import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./AuthContext";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  single: vi.fn(),
  captureException: vi.fn(),
  onAuthStateChange: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ single: mocks.single }) }) }),
    auth: {
      getSession: mocks.getSession,
      onAuthStateChange: mocks.onAuthStateChange,
      mfa: {
        getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: "aal1", nextLevel: "aal1" } }),
        listFactors: async () => ({ data: { totp: [] } }),
      },
    },
  },
}));
vi.mock("@/lib/monitoring", () => ({ monitoring: { setUser: vi.fn(), captureException: mocks.captureException } }));
vi.mock("@/lib/analytics", () => ({ analytics: { identify: vi.fn(), reset: vi.fn() } }));
vi.mock("@/lib/cookieConsentSync", () => ({ syncConsentForUser: vi.fn() }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
function Probe() {
  const auth = useAuth();
  return <div>{auth.loading ? "loading" : auth.profileError ? "error" : (auth.profile?.id ?? "missing")}</div>;
}
function renderAuth() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>
  );
}
let authChanged: (event: string, session: { user: { id: string } } | null) => void;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
  mocks.onAuthStateChange.mockImplementation((callback) => {
    authChanged = callback;
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  });
});

describe("AuthContext profile loading", () => {
  it("login espera a primeira leitura de profile antes de declarar ausência", async () => {
    const profile = deferred<{ data: null; error: { code: string } }>();
    mocks.single.mockReturnValue(profile.promise);
    renderAuth();
    await screen.findByText("missing");
    act(() => authChanged("SIGNED_IN", { user: { id: "bia" } }));
    expect(screen.getByText("loading")).toBeInTheDocument();
    await waitFor(() => expect(mocks.single).toHaveBeenCalledOnce());
    await act(async () => profile.resolve({ data: null, error: { code: "PGRST116" } }));
    expect(await screen.findByText("missing")).toBeInTheDocument();
  });

  it("falha de rede não é tratada como profile ausente", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: "bia" } } }, error: null });
    const error = new Error("offline");
    mocks.single.mockRejectedValue(error);
    renderAuth();
    expect(await screen.findByText("error")).toBeInTheDocument();
    expect(mocks.captureException).toHaveBeenCalledWith(error, expect.objectContaining({ context: "fetchProfile" }));
  });

  it("resposta atrasada de outra sessão não sobrescreve o profile atual", async () => {
    const stale = deferred<{ data: { id: string }; error: null }>();
    mocks.single.mockReturnValueOnce(stale.promise).mockResolvedValueOnce({ data: { id: "new-user" }, error: null });
    renderAuth();
    await screen.findByText("missing");
    act(() => authChanged("SIGNED_IN", { user: { id: "old-user" } }));
    await waitFor(() => expect(mocks.single).toHaveBeenCalledOnce());
    act(() => authChanged("SIGNED_IN", { user: { id: "new-user" } }));
    expect(await screen.findByText("new-user")).toBeInTheDocument();
    await act(async () => stale.resolve({ data: { id: "old-user" }, error: null }));
    expect(screen.getByText("new-user")).toBeInTheDocument();
  });
});
