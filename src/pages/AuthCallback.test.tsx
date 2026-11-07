import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AuthCallback from "./AuthCallback";

const { auth, from, update, toastError, marcarLogin } = vi.hoisted(() => {
  const update = vi.fn();
  return {
    auth: { getSession: vi.fn(), onAuthStateChange: vi.fn() },
    update,
    from: vi.fn(() => ({ update })),
    toastError: vi.fn(),
    marcarLogin: vi.fn(),
  };
});

vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth, from } }));
vi.mock("sonner", () => ({ toast: { error: toastError } }));
vi.mock("@/hooks/usePageTitle", () => ({ usePageTitle: vi.fn() }));
vi.mock("@/lib/ultimoLogin", () => ({ marcarLogin }));

const unsubscribe = vi.fn();
const isNull = vi.fn();

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/auth/callback"]}>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/login" element={<div data-testid="login">Login</div>} />
        <Route path="/inicio" element={<div data-testid="inicio">Início</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState({}, "", "/auth/callback");
  auth.getSession.mockResolvedValue({ data: { session: null } });
  auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe } } });
  isNull.mockResolvedValue({ error: null });
  update.mockReturnValue({ eq: () => ({ is: isNull }) });
});

afterEach(() => {
  vi.useRealTimers();
  window.history.replaceState({}, "", "/");
});

describe("AuthCallback", () => {
  it("mostra estado de entrada enquanto espera a sessão", () => {
    renderPage();
    expect(screen.getByText("Entrando...")).toBeInTheDocument();
  });

  it("erro do provedor na query volta ao login sem refletir o texto cru", async () => {
    window.history.replaceState({}, "", "/auth/callback?error=access_denied&error_description=<script>x</script>");
    renderPage();
    expect(await screen.findByTestId("login")).toBeInTheDocument();
    expect(toastError).toHaveBeenCalledWith("Não foi possível entrar", {
      description: "Erro inesperado. Tente novamente.",
    });
    expect(auth.getSession).not.toHaveBeenCalled();
  });

  it("erro no hash (signup fechado) vira mensagem de negócio", async () => {
    window.history.replaceState(
      {},
      "",
      "/auth/callback#error=server_error&error_description=Database+error+saving+new+user"
    );
    renderPage();
    expect(await screen.findByTestId("login")).toBeInTheDocument();
    expect(toastError).toHaveBeenCalledWith("Não foi possível entrar", {
      description: expect.stringContaining("ainda não tem conta"),
    });
  });

  it("sessão pronta do Google marca o método e sincroniza avatar só se ainda vazio", async () => {
    auth.getSession.mockResolvedValue({
      data: {
        session: {
          user: { id: "u1", app_metadata: { provider: "google" }, user_metadata: { picture: "https://g/p.png" } },
        },
      },
    });
    renderPage();
    expect(await screen.findByTestId("inicio")).toBeInTheDocument();
    expect(marcarLogin).toHaveBeenCalledWith("google");
    expect(from).toHaveBeenCalledWith("profiles");
    expect(update).toHaveBeenCalledWith({ avatar_url: "https://g/p.png" });
    expect(isNull).toHaveBeenCalledWith("avatar_url", null);
  });

  it("sessão por email não marca Google nem mexe no avatar", async () => {
    auth.getSession.mockResolvedValue({
      data: { session: { user: { id: "u1", app_metadata: { provider: "email" }, user_metadata: {} } } },
    });
    renderPage();
    expect(await screen.findByTestId("inicio")).toBeInTheDocument();
    expect(marcarLogin).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it("sessão que chega pelo evento de auth conclui o login", async () => {
    renderPage();
    await waitFor(() => expect(auth.getSession).toHaveBeenCalled());
    auth.getSession.mockResolvedValue({
      data: { session: { user: { id: "u1", app_metadata: {}, user_metadata: {} } } },
    });
    const cb = auth.onAuthStateChange.mock.calls[0][0] as (e: string, s: unknown) => void;
    await act(async () => cb("SIGNED_IN", { user: { id: "u1" } }));
    expect(await screen.findByTestId("inicio")).toBeInTheDocument();
  });

  it("link expirado: sem sessão em 10s volta ao login com aviso", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderPage();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(await screen.findByTestId("login")).toBeInTheDocument();
    expect(toastError).toHaveBeenCalledWith("Não foi possível entrar", {
      description: "O link de acesso expirou ou é inválido. Tente entrar novamente.",
    });
  });

  it("limpa a inscrição de auth ao desmontar", () => {
    const view = renderPage();
    view.unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });
});
