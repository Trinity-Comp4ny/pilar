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
const entrar = () => screen.getByRole("button", { name: /Entrar na Pilar|Entrando/ });
const botao = (nome: RegExp | string) => screen.getByRole("button", { name: nome });
const rascunhos = () => h.calls.filter((c) => c.table === "onboarding_respostas" && c.op === "upsert");
const updates = () => h.calls.filter((c) => c.table === "empresas" && c.op === "update");

type Usuario = ReturnType<typeof userEvent.setup>;

/** Confirma o escritório e cai na primeira tela do onboarding inteligente. */
async function irParaWizard(user: Usuario) {
  await user.click(continuar());
  expect(await screen.findByRole("heading", { name: /Oi, Ana\. Vamos deixar o .* pronto\./ })).toBeInTheDocument();
}

vi.setConfig({ testTimeout: 15000 });

beforeEach(() => {
  vi.clearAllMocks();
  h.calls.length = 0;
  h.profile = { empresa_id: "e1", first_name: "Ana", empresas: { nome: "Escritório Seed", cnpj: "" } };
  h.user = { id: "u1", email: "dono@alfaeng.com.br" };
  h.refreshProfile.mockResolvedValue(undefined);
  h.invoke.mockResolvedValue({ data: { success: true }, error: null });
  h.resolve.mockImplementation(() => ({ error: null }));
});

describe("CompanySetup · Confirme seu escritório (etapa 3)", () => {
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
    expect(screen.getByText("Etapa 3 de 4")).toBeInTheDocument();
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
    await irParaWizard(user);
    expect(updates()[0]?.payload).toEqual({
      nome: "Escritório Seed",
      cnpj: null,
      site: "alfaeng.com.br",
      porte: "1-5",
      disciplinas: ["arquitetura"],
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
    expect(screen.queryByRole("heading", { name: /Oi, Ana/ })).not.toBeInTheDocument();
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
    await irParaWizard(user);
    expect(updates()[0]?.payload).toMatchObject({
      endereco: "RUA DAS FLORES, 100 - CENTRO",
      cidade: "BAURU",
      estado: "SP",
      cep: "17010000",
    });
    expect(h.invoke).toHaveBeenCalledWith("verificar-documento", { body: { documento: CNPJ_VALIDO } });
  });

  it("não sobrescreve endereço que o escritório já tem", async () => {
    h.profile = { empresa_id: "e1", first_name: "Ana", empresas: { nome: "Alfa", cidade: "Marília", estado: "SP" } };
    renderPage();
    const user = userEvent.setup();
    await user.type(cnpj(), CNPJ_VALIDO);
    await screen.findByText("ALFA ENGENHARIA LTDA");
    await irParaWizard(user);
    expect(updates()[0]?.payload).not.toHaveProperty("cidade");
    expect(updates()[0]?.payload).not.toHaveProperty("estado");
    expect(updates()[0]?.payload).toMatchObject({ endereco: "RUA DAS FLORES, 100 - CENTRO", cep: "17010000" });
  });
});

describe("CompanySetup · onboarding inteligente (etapa 4, SPEC 165)", () => {
  it("depois do escritório vem a tela de boas-vindas, com a barra na etapa 4 de 4", async () => {
    renderPage();
    await irParaWizard(userEvent.setup());
    expect(screen.getByText("Etapa 4 de 4")).toBeInTheDocument();
    expect(screen.getByText("Pergunta 1 de 7")).toBeInTheDocument();
    expect(h.refreshProfile).not.toHaveBeenCalled();
  });

  it("dor, aprofundamento, operação e ferramentas viram rascunho e o plano é concluído", async () => {
    renderPage();
    const user = userEvent.setup();
    await irParaWizard(user);
    await user.click(botao(/Começar/));

    await user.click(await screen.findByRole("button", { name: "Estouro de prazo e de cronograma" }));
    await user.click(screen.getByRole("button", { name: "Não sei quem está fazendo o quê" }));
    await user.type(screen.getByLabelText(/Conta com suas palavras/), "Perdemos prazo toda semana");
    await user.click(botao("Continuar"));

    // A primeira dor marcada é a principal e define a pergunta de aprofundamento.
    expect(
      await screen.findByRole("heading", { name: "Como você acompanha o prazo das entregas hoje?" })
    ).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Cobrando no WhatsApp" }));
    await user.click(botao("Continuar"));

    expect(await screen.findByRole("heading", { name: /quantos projetos vocês tocam/i })).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "6 a 15" }));
    await user.click(botao("Continuar"));

    // Espelho: a resposta anterior aparece na pergunta seguinte.
    expect(
      await screen.findByRole("heading", { name: "Com 6 a 15 projetos ativos, o que sustenta isso hoje?" })
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Planilhas (Excel, Google)" }));
    await user.click(botao("Continuar"));

    expect(await screen.findByRole("heading", { name: "Prazo de cada entrega sob controle" })).toBeInTheDocument();
    await user.click(botao(/Ver meu plano/));

    expect(await screen.findByRole("heading", { name: "Seu plano, Ana" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Cadastre um cliente"),
        expect.stringContaining("Abra seu primeiro projeto"),
      ])
    );
    await user.click(entrar());

    expect(await screen.findByTestId("inicio")).toBeInTheDocument();
    expect(updates()[1]?.payload).toEqual({ objetivo_inicial: "projetos", onboarding_completed: true });
    const ultimo = rascunhos().at(-1)?.payload as Record<string, unknown>;
    expect(ultimo).toMatchObject({
      user_id: "u1",
      empresa_id: "e1",
      dores: ["prazos", "equipe"],
      dor_principal: "prazos",
      texto_livre: "Perdemos prazo toda semana",
      contexto: {
        aprofundamento: { dor: "prazos", resposta: "whatsapp" },
        projetosAtivos: "6-15",
        ferramentas: ["planilhas"],
      },
    });
    expect(ultimo.concluido_em).toEqual(expect.any(String));
    expect(h.track).toHaveBeenCalledWith("onboarding_dor_escolhida", {
      dores: ["prazos", "equipe"],
      principal: "prazos",
      tem_texto: true,
    });
    expect(h.track).toHaveBeenCalledWith(
      "onboarding_plano_gerado",
      expect.objectContaining({ passos: expect.any(Array) })
    );
    expect(h.track).toHaveBeenCalledWith("onboarding_objetivo_escolhido", { objetivo: "projetos" });
    expect(h.refreshProfile).toHaveBeenCalled();
  });

  it("pular tudo ainda gera um plano padrão e conclui", async () => {
    renderPage();
    const user = userEvent.setup();
    await irParaWizard(user);
    await user.click(botao(/Começar/));
    await user.click(botao("Pular")); // dores: sem dor, a pergunta de aprofundamento some
    expect(await screen.findByRole("heading", { name: /quantos projetos vocês tocam/i })).toBeInTheDocument();
    await user.click(botao("Pular"));
    await user.click(botao("Pular"));
    await user.click(botao(/Ver meu plano/));
    await user.click(entrar());
    expect(await screen.findByTestId("inicio")).toBeInTheDocument();
    expect(updates()[1]?.payload).toEqual({ objetivo_inicial: "gestao", onboarding_completed: true });
  });

  it("no máximo 3 dores", async () => {
    renderPage();
    const user = userEvent.setup();
    await irParaWizard(user);
    await user.click(botao(/Começar/));
    for (const nome of [
      "Estouro de prazo e de cronograma",
      "Não sei quem está fazendo o quê",
      "Proposta lenta ou sem padrão",
    ]) {
      await user.click(await screen.findByRole("button", { name: nome }));
    }
    expect(screen.getByRole("button", { name: "Controle de obra: diário, medição, fornecedor" })).toBeDisabled();
  });

  it("falha ao guardar o rascunho avisa, mas não trava a pessoa", async () => {
    h.resolve.mockImplementation((q) =>
      q.table === "onboarding_respostas" && q.op === "upsert" ? { error: { message: "boom" } } : { error: null }
    );
    renderPage();
    const user = userEvent.setup();
    await irParaWizard(user);
    await user.click(botao(/Começar/));
    expect(await screen.findByRole("heading", { name: "O que mais pesa no escritório hoje?" })).toBeInTheDocument();
    await waitFor(() =>
      expect(h.toastError).toHaveBeenCalledWith("Não foi possível guardar suas respostas agora", expect.anything())
    );
  });

  it("quem fechou a aba volta de onde parou, sem refazer o escritório", async () => {
    h.resolve.mockImplementation((q) =>
      q.table === "onboarding_respostas" && q.op === "select"
        ? {
            data: {
              dores: ["prazos"],
              dor_principal: "prazos",
              texto_livre: null,
              contexto: {},
              etapa_atual: 4,
              concluido_em: null,
            },
          }
        : { error: null }
    );
    renderPage();
    expect(await screen.findByRole("heading", { name: /quantos projetos vocês tocam/i })).toBeInTheDocument();
    expect(screen.getByText("Pergunta 4 de 7")).toBeInTheDocument();
  });
});
