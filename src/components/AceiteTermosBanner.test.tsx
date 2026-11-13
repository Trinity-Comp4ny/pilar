import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AceiteTermosBanner, type ModoAceiteTermos } from "./AceiteTermosBanner";
import { TERMS_VERSION } from "@/lib/legalVersions";

/**
 * Reaceite dos Termos v2.0 (cláusula 15): só o administrador aceita, a faixa pode ser
 * adiada até a vigência e, depois dela, a janela só fecha com o aceite gravado.
 */

const { auth, versaoAceita, insert, toastSucesso } = vi.hoisted(() => ({
  auth: { user: null as { id: string } | null, profile: null as { role: string; empresa_id: string } | null },
  versaoAceita: { valor: null as string | null },
  insert: vi.fn(async (..._a: unknown[]) => ({ error: null })),
  toastSucesso: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("sonner", () => ({ toast: { success: toastSucesso, error: vi.fn() } }));
vi.mock("@/integrations/supabase/client", () => {
  const consulta = {
    select: () => consulta,
    eq: () => consulta,
    order: () => consulta,
    limit: () => consulta,
    maybeSingle: async () => ({
      data: versaoAceita.valor ? { terms_version: versaoAceita.valor } : null,
      error: null,
    }),
    insert: (...a: unknown[]) => insert(...a),
  };
  return { supabase: { from: () => consulta } };
});

const ANTES_DA_VIGENCIA = new Date("2026-11-20T12:00:00-03:00");
const DEPOIS_DA_VIGENCIA = new Date("2026-12-11T12:00:00-03:00");

function renderizar(rota = "/inicio", modo?: ModoAceiteTermos) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[rota]}>
        <AceiteTermosBanner modo={modo} />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("AceiteTermosBanner", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(ANTES_DA_VIGENCIA);
    auth.user = { id: "u1" };
    auth.profile = { role: "admin", empresa_id: "e1" };
    versaoAceita.valor = "1.1";
    insert.mockClear();
    toastSucesso.mockClear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("membro da equipe não vê nada: o contrato é com a empresa", async () => {
    auth.profile = { role: "colaborador", empresa_id: "e1" };
    renderizar();
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText(/Atualizamos os Termos/)).not.toBeInTheDocument();
  });

  it("administrador que já aceitou a versão atual não vê nada", async () => {
    versaoAceita.valor = TERMS_VERSION;
    renderizar();
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText(/Atualizamos os Termos/)).not.toBeInTheDocument();
  });

  it("antes da vigência: faixa com aceite gravado como reaceite", async () => {
    const user = userEvent.setup();
    renderizar();
    expect(await screen.findByText(/Atualizamos os Termos de Uso/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Li e aceito" }));
    await waitFor(() =>
      expect(insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: "u1",
          empresa_id: "e1",
          terms_version: TERMS_VERSION,
          source: "reaceite",
        })
      )
    );
    expect(toastSucesso).toHaveBeenCalled();
  });

  it("antes da vigência: 'Agora não' esconde a faixa nesta sessão", async () => {
    const user = userEvent.setup();
    renderizar();
    await user.click(await screen.findByRole("button", { name: "Agora não" }));
    expect(screen.queryByText(/Atualizamos os Termos/)).not.toBeInTheDocument();
    expect(insert).not.toHaveBeenCalled();
  });

  it("depois da vigência: janela sem 'Agora não', mesmo se adiada antes", async () => {
    sessionStorage.setItem("pilar_aceite_termos_adiado", TERMS_VERSION);
    vi.setSystemTime(DEPOIS_DA_VIGENCIA);
    renderizar();
    expect(await screen.findByRole("dialog", { name: "Novos Termos de Uso" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Agora não" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Li e aceito os Termos de Uso" })).toBeInTheDocument();
  });

  it("não aparece na tela de completar o perfil, onde o aceite já é pedido", async () => {
    renderizar("/profile-setup");
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText(/Atualizamos os Termos/)).not.toBeInTheDocument();
  });

  // App renderiza só a janela e o Layout só a faixa, depois do skip link (o 1º Tab é dele).
  it("modo janela: antes da vigência não mostra a faixa", async () => {
    renderizar("/inicio", "janela");
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText(/Atualizamos os Termos/)).not.toBeInTheDocument();
  });

  it("modo janela: depois da vigência mostra a janela", async () => {
    vi.setSystemTime(DEPOIS_DA_VIGENCIA);
    renderizar("/inicio", "janela");
    expect(await screen.findByRole("dialog", { name: "Novos Termos de Uso" })).toBeInTheDocument();
  });

  it("modo faixa: antes da vigência mostra a faixa, depois não abre a janela", async () => {
    const { unmount } = renderizar("/inicio", "faixa");
    expect(await screen.findByText(/Atualizamos os Termos de Uso/)).toBeInTheDocument();
    unmount();

    vi.setSystemTime(DEPOIS_DA_VIGENCIA);
    renderizar("/inicio", "faixa");
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
