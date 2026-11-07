import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import CompanySetup from "./CompanySetup";
import type { ChainQuery, ChainResult } from "@/test/supabaseChain";

const h = vi.hoisted(() => ({
  resolve: vi.fn<(q: ChainQuery) => ChainResult>(),
  calls: [] as ChainQuery[],
  getUser: vi.fn(),
  refreshProfile: vi.fn(),
  profile: { empresas: { nome: "Escritório Seed", cnpj: "" } } as Record<string, unknown> | null,
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", async () => {
  const { createSupabaseFrom } = await import("@/test/supabaseChain");
  const chain = createSupabaseFrom((q) => h.resolve(q));
  h.calls = chain.calls;
  return { supabase: { from: chain.from, auth: { getUser: h.getUser } } };
});
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ profile: h.profile, refreshProfile: h.refreshProfile }),
}));
vi.mock("sonner", () => ({ toast: { error: h.toastError, success: h.toastSuccess } }));
vi.mock("@/hooks/usePageTitle", () => ({ usePageTitle: vi.fn() }));
vi.mock("@/lib/analytics", () => ({ analytics: { track: vi.fn() } }));

const CNPJ_VALIDO = "11222333000181";

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/company-setup"]}>
      <Routes>
        <Route path="/company-setup" element={<CompanySetup />} />
        <Route path="/inicio" element={<div data-testid="inicio" />} />
      </Routes>
    </MemoryRouter>
  );
}

const cnpj = () => screen.getByPlaceholderText("00.000.000/0000-00");
const finalizar = () => screen.getByRole("button", { name: /Finalizar e entrar|Salvando/ });

beforeEach(() => {
  vi.clearAllMocks();
  h.calls.length = 0;
  h.profile = { empresas: { nome: "Escritório Seed", cnpj: "" } };
  h.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  h.refreshProfile.mockResolvedValue(undefined);
  h.resolve.mockImplementation((q) => {
    if (q.table === "profiles") return { data: { empresa_id: "e1" } };
    return { error: null };
  });
});

describe("CompanySetup", () => {
  it("pré-preenche o nome da empresa vindo do cadastro", () => {
    renderPage();
    expect(screen.getByText("Escritório Seed")).toBeInTheDocument();
  });

  it("aplica máscara de CNPJ enquanto digita", async () => {
    renderPage();
    await userEvent.setup().type(cnpj(), CNPJ_VALIDO);
    expect(cnpj()).toHaveValue("11.222.333/0001-81");
  });

  it("CNPJ com dígito verificador errado é recusado", async () => {
    renderPage();
    const user = userEvent.setup();
    await user.type(cnpj(), "11222333000182");
    await user.click(finalizar());
    expect(await screen.findByText("CNPJ inválido")).toBeInTheDocument();
    expect(h.calls.some((c) => c.table === "empresas")).toBe(false);
  });

  it("CNPJ com todos os dígitos iguais é recusado", async () => {
    renderPage();
    const user = userEvent.setup();
    await user.type(cnpj(), "11111111111111");
    await user.click(finalizar());
    expect(await screen.findByText("CNPJ inválido")).toBeInTheDocument();
  });

  it("CNPJ vazio é permitido (preenche depois) e conclui o onboarding", async () => {
    renderPage();
    await userEvent.setup().click(finalizar());
    expect(await screen.findByTestId("inicio")).toBeInTheDocument();
    const up = h.calls.find((c) => c.table === "empresas" && c.op === "update");
    expect(up?.payload).toEqual({ nome: "Escritório Seed", cnpj: "", onboarding_completed: true });
    expect(up?.filters).toContainEqual(["eq", "id", "e1"]);
    expect(h.refreshProfile).toHaveBeenCalled();
  });

  // O nome não é campo editável aqui (vem do cadastro), então o erro de
  // validação não tem onde aparecer: o envio só é bloqueado. Ver relatório.
  it("sem nome da empresa o envio é bloqueado e nada é gravado", async () => {
    h.profile = { empresas: { nome: "", cnpj: "" } };
    renderPage();
    await userEvent.setup().click(finalizar());
    await new Promise((r) => setTimeout(r, 50));
    expect(h.getUser).not.toHaveBeenCalled();
    expect(h.calls.some((c) => c.table === "empresas")).toBe(false);
    expect(screen.queryByTestId("inicio")).not.toBeInTheDocument();
  });

  it("usuário sem empresa vinculada recebe erro e não grava nada", async () => {
    h.resolve.mockImplementation((q) => (q.table === "profiles" ? { data: { empresa_id: null } } : { error: null }));
    renderPage();
    await userEvent.setup().click(finalizar());
    await waitFor(() => expect(h.toastError).toHaveBeenCalledWith("Erro ao salvar", expect.anything()));
    expect(h.calls.some((c) => c.table === "empresas")).toBe(false);
    expect(screen.queryByTestId("inicio")).not.toBeInTheDocument();
  });

  it("RLS negando (não-admin) mostra mensagem segura e mantém o formulário", async () => {
    h.resolve.mockImplementation((q) =>
      q.table === "profiles"
        ? { data: { empresa_id: "e1" } }
        : { error: { message: 'new row violates row-level security policy for table "empresas"' } }
    );
    renderPage();
    const user = userEvent.setup();
    await user.type(cnpj(), CNPJ_VALIDO);
    await user.click(finalizar());
    await waitFor(() =>
      expect(h.toastError).toHaveBeenCalledWith("Erro ao salvar", {
        description: "Você não tem permissão para realizar esta ação.",
      })
    );
    expect(h.refreshProfile).not.toHaveBeenCalled();
    expect(cnpj()).toHaveValue("11.222.333/0001-81");
    expect(finalizar()).toBeEnabled();
  });

  it("desabilita enquanto salva", async () => {
    let liberar: (v: ChainResult) => void = () => {};
    h.resolve.mockImplementation((q) =>
      q.table === "profiles" ? { data: { empresa_id: "e1" } } : (new Promise((r) => (liberar = r)) as never)
    );
    renderPage();
    const user = userEvent.setup();
    await user.click(finalizar());
    expect(await screen.findByRole("button", { name: /Salvando/ })).toBeDisabled();
    liberar({ error: null });
    expect(await screen.findByTestId("inicio")).toBeInTheDocument();
  });
});
