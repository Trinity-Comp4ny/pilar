import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AceiteAnaliseBanner } from "./AceiteAnaliseBanner";

const { auth, conta, setConsent, cookie } = vi.hoisted(() => ({
  auth: { user: null as { id: string } | null },
  conta: { valor: null as boolean | null },
  setConsent: vi.fn(async (..._a: unknown[]) => undefined),
  cookie: { valor: null as { analytics: boolean } | null },
}));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/cookieConsent", () => ({
  CONSENT_CHANGED_EVENT: "pilar:cookie-consent-changed",
  getCookieConsent: () => cookie.valor,
}));
vi.mock("@/lib/cookieConsentSync", () => ({
  fetchLatestConsent: async () => conta.valor,
  setAnalyticsConsent: (...a: unknown[]) => setConsent(...a),
}));

function renderizar(rota = "/inicio") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[rota]}>
        <AceiteAnaliseBanner />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("AceiteAnaliseBanner", () => {
  beforeEach(() => {
    auth.user = { id: "u1" };
    conta.valor = null;
    cookie.valor = null;
    setConsent.mockClear();
  });

  it("pergunta a quem ainda não decidiu, no navegador nem na conta", async () => {
    renderizar();
    expect(await screen.findByText("Podemos medir como você usa a Pilar?")).toBeInTheDocument();
  });

  it("aceitar grava true na conta", async () => {
    renderizar();
    await userEvent.click(await screen.findByRole("button", { name: "Aceitar" }));
    await waitFor(() => expect(setConsent).toHaveBeenCalledWith("u1", true));
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  });

  it("recusar grava false na conta", async () => {
    renderizar();
    await userEvent.click(await screen.findByRole("button", { name: "Recusar" }));
    await waitFor(() => expect(setConsent).toHaveBeenCalledWith("u1", false));
  });

  it.each([
    ["decisão no navegador", () => (cookie.valor = { analytics: false })],
    ["decisão na conta (outro aparelho)", () => (conta.valor = true)],
    ["sem sessão", () => (auth.user = null)],
  ])("não aparece com %s", async (_n, preparar) => {
    preparar();
    renderizar();
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("não aparece em telas de entrada", async () => {
    renderizar("/mfa");
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
