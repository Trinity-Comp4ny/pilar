import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Testes (SPEC 098/104): empresas em teste e em só leitura. Cada ação sensível exige motivo;
// "nível automático" limpa o override (null); excluir exige o nome igual e só sai pela edge.

const h = vi.hoisted(() => ({ rpc: vi.fn(), edgeFetch: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: h.rpc } }));
vi.mock("./api", async (orig) => ({ ...(await orig<typeof import("./api")>()), edgeFetch: h.edgeFetch }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
vi.mock("@/components/PilarPage", () => ({
  PilarPage: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <main>
      <h1>{title}</h1>
      {children}
    </main>
  ),
}));

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

import Testes from "./Testes";

const trial = (over: Record<string, unknown> = {}) => ({
  empresa_id: "e1",
  empresa_nome: "Alfa Engenharia",
  nivel: "prata",
  nivel_override: null,
  nivel_override_motivo: null,
  documento_tipo: "cnpj",
  documento_verificacao: "ok",
  razao_social: "ALFA ENG LTDA",
  razao_social_divergente: false,
  trial_ends_at: new Date(Date.now() + 2 * 86_400_000).toISOString(),
  trial_estendido_motivo: null,
  dias_restantes: 2,
  preservar_dados: false,
  projetos_ativos: 2,
  max_projetos: 3,
  usuarios: 1,
  max_usuarios: null,
  tokens_gastos: 1200,
  tokens_total: 50000,
  ...over,
});

const retencao = (over: Record<string, unknown> = {}) => ({
  empresa_id: "e5",
  empresa_nome: "Zeta Projetos",
  leitura_desde: "2026-09-01T00:00:00Z",
  dias_em_leitura: 88,
  preservar_dados: false,
  aviso_60d_enviado: true,
  aviso_85d_enviado: true,
  ...over,
});

function rpcs(t: unknown[] = [trial()], r: unknown[] = [retencao()]) {
  h.rpc.mockImplementation(async (nome: string) => {
    if (nome === "ultra_admin_listar_trials") return { data: t, error: null };
    if (nome === "ultra_admin_listar_retencao") return { data: r, error: null };
    return { data: null, error: null };
  });
}

function Local() {
  return <p data-testid="local">{useLocation().pathname}</p>;
}

function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<Testes />} />
          <Route path="/ultra-admin/empresas/:id" element={<Local />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

async function abrirAcao(empresa: string, item: string) {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: `Ações de ${empresa}` }));
  await user.click(await screen.findByRole("menuitem", { name: item }));
  return user;
}

beforeEach(() => {
  vi.clearAllMocks();
  rpcs();
});

describe("Testes: listas", () => {
  it("mostra trials com uso e tokens, e retenção com prazo e avisos", async () => {
    montar();
    expect(await screen.findByText("Alfa Engenharia")).toBeInTheDocument();
    expect(screen.getByText("2 de 3 · 1")).toBeInTheDocument();
    expect(screen.getByText("Prata")).toBeInTheDocument();
    expect(screen.getByText("Zeta Projetos")).toBeInTheDocument();
    expect(screen.getByText("há 88 dias")).toBeInTheDocument();
    expect(screen.getByText("em 2 dias")).toBeInTheDocument();
    expect(screen.getByText("Último aviso enviado")).toBeInTheDocument();
  });

  it("variações: razão social divergente, nível ajustado, preservada, primeiro aviso, vence hoje", async () => {
    rpcs(
      [
        trial({
          razao_social_divergente: true,
          nivel: "ouro",
          nivel_override: "ouro",
          nivel_override_motivo: "parceiro",
          tokens_total: null,
          max_projetos: null,
        }),
      ],
      [
        retencao({ preservar_dados: true }),
        retencao({
          empresa_id: "e6",
          empresa_nome: "Eta",
          dias_em_leitura: 1,
          aviso_85d_enviado: false,
          aviso_60d_enviado: true,
        }),
        retencao({
          empresa_id: "e7",
          empresa_nome: "Teta",
          dias_em_leitura: 95,
          aviso_85d_enviado: false,
          aviso_60d_enviado: false,
        }),
      ]
    );
    montar();
    expect(await screen.findByLabelText("Nome diferente da Receita")).toBeInTheDocument();
    expect(screen.getByLabelText("Nível ajustado manualmente")).toBeInTheDocument();
    expect(screen.getByText("Ouro")).toBeInTheDocument();
    expect(screen.getByLabelText("Dados preservados")).toBeInTheDocument();
    expect(screen.getByText("Parada (dados preservados)")).toBeInTheDocument();
    expect(screen.getByText("há 1 dia")).toBeInTheDocument();
    expect(screen.getByText("1º aviso enviado")).toBeInTheDocument();
    expect(screen.getByText("Nenhum ainda")).toBeInTheDocument();
    expect(screen.getByText("hoje")).toBeInTheDocument();
  });

  it("vazios e erros de carregamento", async () => {
    h.rpc.mockImplementation(async (nome: string) =>
      nome === "ultra_admin_listar_trials" ? { data: null, error: null } : { data: null, error: new Error("x") }
    );
    montar();
    expect(await screen.findByText("Nenhuma empresa em teste agora")).toBeInTheDocument();
    expect(await screen.findByText("Não foi possível carregar as empresas vencidas")).toBeInTheDocument();
  });

  it("erro nos trials mostra a mensagem própria", async () => {
    h.rpc.mockImplementation(async (nome: string) =>
      nome === "ultra_admin_listar_trials" ? { data: null, error: new Error("x") } : { data: [], error: null }
    );
    montar();
    expect(await screen.findByText("Não foi possível carregar os testes")).toBeInTheDocument();
    expect(await screen.findByText("Nenhuma empresa em só leitura")).toBeInTheDocument();
  });

  it("clicar na linha abre a empresa", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(await screen.findByText("Alfa Engenharia"));
    expect(screen.getByTestId("local")).toHaveTextContent("/ultra-admin/empresas/e1");
  });
});

describe("Testes: ações", () => {
  it("estender exige motivo e manda o fim do dia em horário de Brasília", async () => {
    montar();
    const user = await abrirAcao("Alfa Engenharia", "Estender o teste");
    const dialogo = await screen.findByRole("dialog");
    const estender = within(dialogo).getByRole("button", { name: "Estender" });
    expect(estender).toBeDisabled();
    await user.type(within(dialogo).getByLabelText("Motivo"), "  negociação  ");
    await user.click(estender);
    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith("ultra_admin_estender_trial", expect.anything()));
    const args = h.rpc.mock.calls.find((c) => c[0] === "ultra_admin_estender_trial")![1];
    expect(args.p_motivo).toBe("negociação");
    expect(args.p_novo_trial_ends_at).toMatch(/^\d{4}-\d{2}-\d{2}T23:59:59-03:00$/);
    expect(toast.success).toHaveBeenCalledWith("Teste estendido");
  });

  it("mudar nível: manual exige motivo; automático limpa o override com null", async () => {
    rpcs([trial({ nivel_override: "ouro", nivel_override_motivo: "parceiro" })]);
    montar();
    const user = await abrirAcao("Alfa Engenharia", "Mudar o nível");
    const dialogo = await screen.findByRole("dialog");
    const motivo = within(dialogo).getByLabelText("Motivo");
    expect(motivo).toHaveValue("parceiro");
    await user.clear(motivo);
    expect(within(dialogo).getByRole("button", { name: "Salvar" })).toBeDisabled();
    await user.type(motivo, "design partner");
    await user.click(within(dialogo).getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(h.rpc).toHaveBeenCalledWith("ultra_admin_definir_nivel_override", {
        p_empresa_id: "e1",
        p_nivel: "ouro",
        p_motivo: "design partner",
      })
    );
    expect(toast.success).toHaveBeenCalledWith("Nível atualizado");
  });

  it("nível sem override abre em automático e salva null sem pedir motivo", async () => {
    montar();
    const user = await abrirAcao("Alfa Engenharia", "Mudar o nível");
    const dialogo = await screen.findByRole("dialog");
    expect(within(dialogo).queryByLabelText("Motivo")).not.toBeInTheDocument();
    await user.click(within(dialogo).getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(h.rpc).toHaveBeenCalledWith("ultra_admin_definir_nivel_override", {
        p_empresa_id: "e1",
        p_nivel: null,
        p_motivo: null,
      })
    );
  });

  it("falha ao mudar o nível avisa e mantém o diálogo", async () => {
    const base = h.rpc.getMockImplementation()!;
    h.rpc.mockImplementation(async (nome: string, a?: unknown) =>
      nome === "ultra_admin_definir_nivel_override" ? { error: new Error("sem MFA") } : base(nome, a)
    );
    montar();
    const user = await abrirAcao("Alfa Engenharia", "Mudar o nível");
    const dialogo = await screen.findByRole("dialog");
    await user.click(within(dialogo).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Não foi possível mudar o nível", expect.anything()));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("preservar dados pede motivo e alterna conforme o estado atual", async () => {
    montar();
    const user = await abrirAcao("Zeta Projetos", "Preservar dados");
    const dialogo = await screen.findByRole("dialog");
    expect(within(dialogo).getByText("Preservar os dados de Zeta Projetos?")).toBeInTheDocument();
    const preservar = within(dialogo).getByRole("button", { name: "Preservar" });
    expect(preservar).toBeDisabled();
    await user.type(within(dialogo).getByLabelText("Motivo"), "negociação avançada");
    await user.click(preservar);
    await waitFor(() =>
      expect(h.rpc).toHaveBeenCalledWith("ultra_admin_marcar_preservar_dados", {
        p_empresa_id: "e5",
        p_preservar: true,
        p_motivo: "negociação avançada",
      })
    );
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("Dados preservados"));
  });

  it("remover preservação desliga e avisa", async () => {
    rpcs([trial({ preservar_dados: true })], []);
    montar();
    const user = await abrirAcao("Alfa Engenharia", "Remover preservação de dados");
    const dialogo = await screen.findByRole("dialog");
    await user.type(within(dialogo).getByLabelText("Motivo"), "fechou");
    await user.click(within(dialogo).getByRole("button", { name: "Remover" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Preservação removida"));
    expect(h.rpc).toHaveBeenCalledWith(
      "ultra_admin_marcar_preservar_dados",
      expect.objectContaining({ p_preservar: false })
    );
  });

  it("excluir exige motivo e o nome exato; chama a edge com DELETE", async () => {
    h.edgeFetch.mockResolvedValue({});
    montar();
    const user = await abrirAcao("Zeta Projetos", "Excluir agora");
    const dialogo = await screen.findByRole("dialog");
    const excluir = within(dialogo).getByRole("button", { name: "Excluir empresa" });
    await user.type(within(dialogo).getByLabelText("Motivo"), "conta de teste");
    await user.type(within(dialogo).getByLabelText(/para confirmar/), "zeta projetos");
    expect(excluir).toBeDisabled();
    await user.clear(within(dialogo).getByLabelText(/para confirmar/));
    await user.type(within(dialogo).getByLabelText(/para confirmar/), "Zeta Projetos");
    await user.click(excluir);
    await waitFor(() =>
      expect(h.edgeFetch).toHaveBeenCalledWith("ultra-admin-empresas", {
        method: "DELETE",
        body: { empresa_id: "e5", confirm_name: "Zeta Projetos", motivo: "conta de teste" },
      })
    );
    expect(toast.success).toHaveBeenCalledWith("Empresa excluída");
  });

  it("falha ao excluir avisa o erro", async () => {
    h.edgeFetch.mockRejectedValue(new Error("Nome não confere"));
    montar();
    const user = await abrirAcao("Zeta Projetos", "Excluir agora");
    const dialogo = await screen.findByRole("dialog");
    await user.type(within(dialogo).getByLabelText("Motivo"), "x");
    await user.type(within(dialogo).getByLabelText(/para confirmar/), "Zeta Projetos");
    await user.click(within(dialogo).getByRole("button", { name: "Excluir empresa" }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Não foi possível excluir a empresa", expect.anything())
    );
  });

  it("empresa preservada não pode ser excluída agora", async () => {
    rpcs([], [retencao({ preservar_dados: true })]);
    const user = userEvent.setup();
    montar();
    await user.click(await screen.findByRole("button", { name: "Ações de Zeta Projetos" }));
    expect(await screen.findByRole("menuitem", { name: "Excluir agora" })).toHaveAttribute("data-disabled");
  });
});
