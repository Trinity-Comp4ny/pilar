import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import CompanySetup from "./CompanySetup";
import type { ChainQuery, ChainResult } from "@/test/supabaseChain";

const h = vi.hoisted(() => ({
  resolve: vi.fn<(q: ChainQuery) => ChainResult>(),
  calls: [] as ChainQuery[],
  invoke: vi.fn(),
  refreshProfile: vi.fn(),
  profile: null as Record<string, unknown> | null,
  user: { id: "u1", email: "dono@alfaeng.com.br" } as Record<string, unknown> | null,
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  track: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", async () => {
  const { createSupabaseFrom } = await import("@/test/supabaseChain");
  const chain = createSupabaseFrom((q) => h.resolve(q));
  h.calls = chain.calls;
  return { supabase: { from: chain.from, functions: { invoke: h.invoke } } };
});
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ profile: h.profile, user: h.user, refreshProfile: h.refreshProfile }),
}));
vi.mock("sonner", () => ({ toast: { error: h.toastError, success: h.toastSuccess } }));
vi.mock("@/hooks/usePageTitle", () => ({ usePageTitle: vi.fn() }));
vi.mock("@/lib/analytics", () => ({ analytics: { track: h.track } }));

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

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
const continuar = () => screen.getByRole("button", { name: /Continuar|Salvando/ });
const entrar = () => screen.getByRole("button", { name: /Entrar no Pilar|Convidar e entrar|Entrando/ });
const updates = () => h.calls.filter((c) => c.table === "empresas" && c.op === "update");

async function irParaEtapa3(user: ReturnType<typeof userEvent.setup>) {
  await user.click(continuar());
  expect(await screen.findByRole("heading", { name: "Por onde começar?" })).toBeInTheDocument();
}

vi.setConfig({ testTimeout: 15000 });

beforeEach(() => {
  vi.clearAllMocks();
  h.calls.length = 0;
  h.profile = { empresa_id: "e1", empresas: { nome: "Escritório Seed", cnpj: "" } };
  h.user = { id: "u1", email: "dono@alfaeng.com.br" };
  h.refreshProfile.mockResolvedValue(undefined);
  h.invoke.mockResolvedValue({ data: { success: true }, error: null });
  h.resolve.mockImplementation(() => ({ error: null }));
});

describe("CompanySetup · Seu escritório (etapa 2)", () => {
  it("pré-preenche o que o ultra-admin anotou na criação", () => {
    h.profile = {
      empresa_id: "e1",
      empresas: { nome: "Alfa", cnpj: CNPJ_VALIDO, site: "alfa.com.br", porte: "6-15", disciplinas: ["estrutural"] },
    };
    renderPage();
    expect(screen.getByDisplayValue("Alfa")).toBeInTheDocument();
    expect(cnpj()).toHaveValue("11.222.333/0001-81");
    expect(screen.getByDisplayValue("alfa.com.br")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "6 a 15" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("button", { name: "Estrutural" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Configuração inicial · Etapa 2 de 3")).toBeInTheDocument();
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
    await user.click(continuar());
    expect(await screen.findByText("CNPJ inválido")).toBeInTheDocument();
    expect(updates()).toHaveLength(0);
  });

  it("sem nome do escritório não avança", async () => {
    h.profile = { empresa_id: "e1", empresas: { nome: "", cnpj: "" } };
    renderPage();
    await userEvent.setup().click(continuar());
    expect(await screen.findByText("Nome é obrigatório")).toBeInTheDocument();
    expect(updates()).toHaveLength(0);
  });

  it("sugere o site pelo domínio do e-mail e grava o perfil sem concluir o onboarding", async () => {
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Usar alfaeng.com.br" }));
    await user.click(screen.getByRole("radio", { name: "1 a 5 pessoas" }));
    await user.click(screen.getByRole("button", { name: "Arquitetura" }));
    await user.click(screen.getByRole("radio", { name: "ChatGPT ou outra IA" }));
    await irParaEtapa3(user);
    expect(updates()[0]?.payload).toEqual({
      nome: "Escritório Seed",
      cnpj: null,
      site: "alfaeng.com.br",
      porte: "1-5",
      disciplinas: ["arquitetura"],
      como_conheceu: "ia",
    });
    expect(updates()[0]?.filters).toContainEqual(["eq", "id", "e1"]);
  });

  it("e-mail pessoal não gera sugestão de site", () => {
    h.user = { id: "u1", email: "dono@gmail.com" };
    renderPage();
    expect(screen.queryByRole("button", { name: /Usar / })).not.toBeInTheDocument();
  });

  it("RLS negando mostra mensagem segura e fica na etapa", async () => {
    h.resolve.mockImplementation(() => ({
      error: { message: 'new row violates row-level security policy for table "empresas"' },
    }));
    renderPage();
    await userEvent.setup().click(continuar());
    await waitFor(() =>
      expect(h.toastError).toHaveBeenCalledWith("Erro ao salvar", {
        description: "Você não tem permissão para realizar esta ação.",
      })
    );
    expect(screen.queryByRole("heading", { name: "Por onde começar?" })).not.toBeInTheDocument();
  });

  it("usuário sem empresa vinculada recebe erro e não grava nada", async () => {
    h.profile = { empresa_id: null, empresas: { nome: "Seed" } };
    renderPage();
    await userEvent.setup().click(continuar());
    await waitFor(() => expect(h.toastError).toHaveBeenCalledWith("Empresa não encontrada"));
    expect(updates()).toHaveLength(0);
  });
});

describe("CompanySetup · consulta do CNPJ na Receita (SPEC 149)", () => {
  const RECEITA = {
    status: "ok",
    razao_social: "ALFA ENGENHARIA LTDA",
    situacao_cadastral: "ATIVA",
    nome_fantasia: "ALFA",
    endereco: { logradouro: "RUA DAS FLORES, 100 - CENTRO", cidade: "BAURU", uf: "SP", cep: "17010000" },
  };

  beforeEach(() => {
    h.invoke.mockImplementation((fn: string, opts: { body: Record<string, unknown> }) =>
      Promise.resolve(
        fn === "verificar-documento" && opts.body.apenas_consultar
          ? { data: RECEITA, error: null }
          : { data: { success: true }, error: null }
      )
    );
  });

  it("CNPJ válido mostra razão social, situação e cidade da Receita", async () => {
    renderPage();
    await userEvent.setup().type(cnpj(), CNPJ_VALIDO);
    expect(await screen.findByText("ALFA ENGENHARIA LTDA")).toBeInTheDocument();
    expect(screen.getByText(/Situação ativa · ALFA · BAURU\/SP/)).toBeInTheDocument();
    expect(h.invoke).toHaveBeenCalledWith("verificar-documento", {
      body: { documento: CNPJ_VALIDO, apenas_consultar: true },
    });
  });

  it("CNPJ incompleto ou inválido não consulta", async () => {
    renderPage();
    await userEvent.setup().type(cnpj(), "11222333000182");
    await new Promise((r) => setTimeout(r, 500));
    expect(h.invoke).not.toHaveBeenCalled();
  });

  it("Receita fora do ar avisa sem travar", async () => {
    h.invoke.mockResolvedValue({ data: { status: "indisponivel" }, error: null });
    renderPage();
    await userEvent.setup().type(cnpj(), CNPJ_VALIDO);
    expect(await screen.findByText(/A Receita não respondeu agora/)).toBeInTheDocument();
  });

  it("ao continuar, preenche o endereço vazio e registra o CNPJ como verificado", async () => {
    renderPage();
    const user = userEvent.setup();
    await user.type(cnpj(), CNPJ_VALIDO);
    await screen.findByText("ALFA ENGENHARIA LTDA");
    await irParaEtapa3(user);
    expect(updates()[0]?.payload).toMatchObject({
      endereco: "RUA DAS FLORES, 100 - CENTRO",
      cidade: "BAURU",
      estado: "SP",
      cep: "17010000",
    });
    expect(h.invoke).toHaveBeenCalledWith("verificar-documento", { body: { documento: CNPJ_VALIDO } });
  });

  it("não sobrescreve endereço que o escritório já tem", async () => {
    h.profile = { empresa_id: "e1", empresas: { nome: "Alfa", cidade: "Marília", estado: "SP" } };
    renderPage();
    const user = userEvent.setup();
    await user.type(cnpj(), CNPJ_VALIDO);
    await screen.findByText("ALFA ENGENHARIA LTDA");
    await irParaEtapa3(user);
    expect(updates()[0]?.payload).not.toHaveProperty("cidade");
    expect(updates()[0]?.payload).not.toHaveProperty("estado");
    expect(updates()[0]?.payload).toMatchObject({ endereco: "RUA DAS FLORES, 100 - CENTRO", cep: "17010000" });
  });
});

describe("CompanySetup · Por onde começar (etapa 3)", () => {
  it("os três pilares aparecem com o mesmo peso", async () => {
    renderPage();
    await irParaEtapa3(userEvent.setup());
    expect(screen.getAllByRole("radio").map((r) => r.textContent)).toEqual([
      expect.stringContaining("Gestão"),
      expect.stringContaining("Projetos"),
      expect.stringContaining("Obras"),
    ]);
  });

  it("grava o pilar escolhido, conclui o onboarding e entra sem convidar ninguém", async () => {
    renderPage();
    const user = userEvent.setup();
    await irParaEtapa3(user);
    await user.click(screen.getByRole("radio", { name: /Obras/ }));
    await user.click(entrar());
    expect(await screen.findByTestId("inicio")).toBeInTheDocument();
    expect(updates()[1]?.payload).toEqual({ objetivo_inicial: "obras", onboarding_completed: true });
    expect(h.invoke).not.toHaveBeenCalled();
    expect(h.refreshProfile).toHaveBeenCalled();
    expect(h.track).toHaveBeenCalledWith("onboarding_objetivo_escolhido", { objetivo: "obras" });
  });

  it("pular a escolha também conclui", async () => {
    renderPage();
    const user = userEvent.setup();
    await irParaEtapa3(user);
    await user.click(entrar());
    expect(await screen.findByTestId("inicio")).toBeInTheDocument();
    expect(updates()[1]?.payload).toEqual({ objetivo_inicial: null, onboarding_completed: true });
  });

  it("convida os colegas informados pela mesma função do painel de usuários", async () => {
    renderPage();
    const user = userEvent.setup();
    await irParaEtapa3(user);
    await user.type(screen.getByLabelText("E-mail do colega 1"), "Bia@AlfaEng.com.br");
    await user.click(entrar());
    expect(await screen.findByTestId("inicio")).toBeInTheDocument();
    expect(h.invoke).toHaveBeenCalledTimes(1);
    expect(h.invoke).toHaveBeenCalledWith("invite-user", {
      body: { email: "bia@alfaeng.com.br", nome: "", role: "user" },
    });
  });

  it("e-mail de colega inválido trava o botão", async () => {
    renderPage();
    const user = userEvent.setup();
    await irParaEtapa3(user);
    await user.type(screen.getByLabelText("E-mail do colega 1"), "bia@");
    expect(entrar()).toBeDisabled();
  });

  it("convite que falha não impede a entrada", async () => {
    h.invoke.mockResolvedValue({ data: null, error: new Error("Limite de usuários") });
    renderPage();
    const user = userEvent.setup();
    await irParaEtapa3(user);
    await user.type(screen.getByLabelText("E-mail do colega 1"), "bia@alfaeng.com.br");
    await user.click(entrar());
    expect(await screen.findByTestId("inicio")).toBeInTheDocument();
    expect(h.toastError).toHaveBeenCalledWith("Convite para bia@alfaeng.com.br não saiu", expect.anything());
  });
});
