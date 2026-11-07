import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { EmpresaDetalhe as Empresa } from "./api";
import type { EventoAtividade, Mutacao } from "./hooks";
import type { CustosIa } from "./custos";

// Detalhe da empresa no ultra admin: resumo da cobrança por situação, menu de ações conforme
// status/cobrança, ações sensíveis passando pelo nome digitado, abas na URL e as três abas
// (visão, usuários com as ações da edge e das RPCs de delegação, atividade).

const h = vi.hoisted(() => ({
  empresa: undefined as Empresa | undefined,
  carregando: false,
  atividade: [] as EventoAtividade[],
  mutacoes: [] as Mutacao[],
  custos: undefined as CustosIa | undefined,
  atualizarEmpresa: vi.fn(),
  marcarEmpresaInterna: vi.fn(),
  edgeFetch: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("./hooks", async (orig) => ({
  ...(await orig<typeof import("./hooks")>()),
  useEmpresa: () => ({ data: h.empresa, isLoading: h.carregando }),
  useAtividade: () => ({ data: h.atividade, isLoading: false }),
  useMutacoesEmpresa: () => ({ data: h.mutacoes, isLoading: false }),
  atualizarEmpresa: h.atualizarEmpresa,
  marcarEmpresaInterna: h.marcarEmpresaInterna,
}));
vi.mock("./custos", async (orig) => ({
  ...(await orig<typeof import("./custos")>()),
  useCustosIa: () => ({ data: h.custos, isLoading: false }),
}));
vi.mock("./api", async (orig) => ({ ...(await orig<typeof import("./api")>()), edgeFetch: h.edgeFetch }));
vi.mock("@/lib/supabaseRpc", () => ({ callUntypedRpc: h.rpc }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/monitoring", () => ({ reportInvokeError: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
vi.mock("@/components/PageLayout", () => ({
  PageLayout: ({
    header,
    tabs,
    children,
  }: {
    header: React.ReactNode;
    tabs?: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <main>
      {header}
      {tabs}
      {children}
    </main>
  ),
}));
vi.mock("@/components/PageHeader", () => ({
  PageHeader: ({ title, children }: { title: string; children?: React.ReactNode }) => (
    <header>
      <h1>{title}</h1>
      {children}
    </header>
  ),
}));
// O gerenciador de acesso é coberto nos próprios testes; aqui só importa o que a aba liga nele.
vi.mock("@/components/admin/UsersAccessManager", () => ({
  UsersAccessManager: (p: {
    onInvite: (x: unknown) => Promise<void>;
    onUpdate: (x: unknown) => void;
    onDelete: (id: string) => void;
    onResendInvite: (u: unknown) => void;
    onCancelInvite: (u: unknown) => void;
    onSetFinanceiroDelegado: (id: string, d: boolean) => void;
    onSetEquipeDelegado: (id: string, d: boolean) => void;
    onSetMetasDelegado: (id: string, d: boolean) => void;
  }) => (
    <div>
      <button onClick={() => void p.onInvite({ firstName: "Novo", lastName: "", email: "n@x.co", role: "user" })}>
        convidar
      </button>
      <button onClick={() => p.onUpdate({ id: "u1", role: "coordenador" })}>papel</button>
      <button onClick={() => p.onDelete("u1")}>remover</button>
      <button onClick={() => p.onResendInvite({ inviteId: "c1", email: "c@x.co" })}>reenviar</button>
      <button onClick={() => p.onCancelInvite({ inviteId: "c1" })}>cancelar convite</button>
      <button onClick={() => p.onSetFinanceiroDelegado("u1", true)}>financeiro</button>
      <button onClick={() => p.onSetEquipeDelegado("u1", false)}>equipe</button>
      <button onClick={() => p.onSetMetasDelegado("u1", true)}>metas</button>
    </div>
  ),
}));

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

import EmpresaDetalhe from "./EmpresaDetalhe";

function empresa(over: Partial<Empresa> = {}): Empresa {
  return {
    id: "e1",
    nome: "Alfa",
    cnpj: null,
    status: "active",
    features: {},
    plano: "pro",
    usersCount: 2,
    cobranca: { status: "active", trialEndsAt: null, isPaying: true, convidada: false },
    createdAt: "2026-01-10T00:00:00Z",
    ultimoAcesso: null,
    usuarios: [
      { id: "u1", name: "Ana", email: "ana@alfa.test", role: "admin", lastSignInAt: null },
      { id: "u2", name: "Bia", email: "bia@alfa.test", role: "user" },
      { id: "convite-c1", inviteId: "c1", name: "c@x.co", email: "c@x.co", role: "user", isPending: true },
    ],
    maxProjetosOverride: null,
    maxUsuariosOverride: null,
    planoMaxProjetos: 10,
    planoMaxUsuarios: 5,
    projetosAtivos: 4,
    interna: false,
    perfil: { site: null, porte: null, disciplinas: [], origem: null, comoConheceu: null, objetivoInicial: null },
    ...over,
  };
}

function Local() {
  const l = useLocation();
  return <p data-testid="local">{l.pathname}</p>;
}

function montar(rota = "/ultra-admin/empresas/e1") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[rota]}>
        <Routes>
          <Route path="/ultra-admin/empresas/:id" element={<EmpresaDetalhe />} />
          <Route path="/ultra-admin/empresas" element={<Local />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

async function menu(item: string | RegExp) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Mais ações" }));
  await user.click(await screen.findByRole("menuitem", { name: item }));
  return user;
}

async function confirmarComNome(botao: string, nome = "Alfa") {
  const user = userEvent.setup();
  const dialogo = await screen.findByRole("dialog");
  await user.type(within(dialogo).getByLabelText(/para confirmar/), nome);
  await user.click(within(dialogo).getByRole("button", { name: botao }));
}

beforeEach(() => {
  vi.clearAllMocks();
  h.empresa = empresa();
  h.carregando = false;
  h.atividade = [];
  h.mutacoes = [];
  h.custos = undefined;
  h.atualizarEmpresa.mockResolvedValue({});
  h.marcarEmpresaInterna.mockResolvedValue(undefined);
  h.edgeFetch.mockResolvedValue({});
  h.rpc.mockResolvedValue({ error: null });
});

describe("EmpresaDetalhe: estados", () => {
  it("carregando não mostra a empresa", () => {
    h.carregando = true;
    montar();
    expect(screen.queryByRole("heading", { name: "Alfa" })).not.toBeInTheDocument();
  });

  it("empresa inexistente oferece voltar para a lista", async () => {
    h.empresa = undefined;
    const user = userEvent.setup();
    montar();
    expect(screen.getByText("Empresa não encontrada")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ver empresas" }));
    expect(screen.getByTestId("local")).toHaveTextContent("/ultra-admin/empresas");
  });

  it("pagante: resumo, fatos e convites pendentes contados à parte", () => {
    montar();
    expect(screen.getByRole("heading", { name: "Alfa" })).toBeInTheDocument();
    expect(screen.getByText("Assinatura ativa no Asaas.")).toBeInTheDocument();
    expect(screen.getByText(/\+ 1 convidados/)).toBeInTheDocument();
    expect(screen.getByText("Não informado")).toBeInTheDocument();
    expect(screen.getByText("Ninguém entrou")).toBeInTheDocument();
  });

  it.each([
    [{ cobranca: { status: null, trialEndsAt: null, isPaying: false, convidada: true } }, "Usa o Pilar sem pagar."],
    [
      { cobranca: { status: "expired", trialEndsAt: null, isPaying: false, convidada: false } },
      /Teste vencido: só leitura/,
    ],
    [
      { cobranca: { status: "overdue", trialEndsAt: null, isPaying: true, convidada: false } },
      "Pagamento em atraso no Asaas.",
    ],
    [
      { cobranca: { status: "canceled", trialEndsAt: null, isPaying: false, convidada: false } },
      /A conta está bloqueada/,
    ],
    [{ status: "suspended" }, /Suspensa por aqui/],
    [{ status: "cancelled" }, /Arquivada: ninguém entra/],
    [
      { cobranca: { status: null, trialEndsAt: null, isPaying: false, convidada: false } },
      "Sem assinatura registrada.",
    ],
    [
      {
        cobranca: {
          status: "trialing",
          trialEndsAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
          isPaying: false,
          convidada: false,
        },
      },
      /Sem assinatura no fim, fica só leitura/,
    ],
    [
      {
        cobranca: {
          status: "trialing",
          trialEndsAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
          isPaying: false,
          convidada: false,
        },
      },
      /vira só leitura na próxima verificação/,
    ],
  ] as Array<[Partial<Empresa>, string | RegExp]>)("resumo da cobrança por situação %#", (over, texto) => {
    h.empresa = empresa(over);
    montar();
    expect(screen.getByText(texto)).toBeInTheDocument();
  });
});

describe("EmpresaDetalhe: ações", () => {
  it("editar salva pela edge e avisa", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole("button", { name: "Editar" }));
    const dialogo = await screen.findByRole("dialog");
    await user.clear(within(dialogo).getByLabelText("Nome"));
    await user.type(within(dialogo).getByLabelText("Nome"), "Alfa Nova");
    await user.click(within(dialogo).getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(h.atualizarEmpresa).toHaveBeenCalledWith("e1", expect.objectContaining({ nome: "Alfa Nova" }))
    );
    expect(toast.success).toHaveBeenCalledWith("Empresa atualizada");
  });

  it("suspender exige o nome e manda confirm_name", async () => {
    montar();
    await menu(/Suspender acesso/);
    await confirmarComNome("Suspender");
    await waitFor(() =>
      expect(h.atualizarEmpresa).toHaveBeenCalledWith("e1", { status: "suspended", confirm_name: "Alfa" })
    );
    expect(toast.success).toHaveBeenCalledWith("Empresa suspensa");
  });

  it("arquivar manda status cancelled", async () => {
    montar();
    await menu(/Arquivar/);
    await confirmarComNome("Arquivar");
    await waitFor(() =>
      expect(h.atualizarEmpresa).toHaveBeenCalledWith("e1", { status: "cancelled", confirm_name: "Alfa" })
    );
    expect(toast.success).toHaveBeenCalledWith("Empresa arquivada");
  });

  it("marcar como empresa de teste e desfazer", async () => {
    montar();
    await menu(/Marcar como empresa de teste/);
    await waitFor(() => expect(h.marcarEmpresaInterna).toHaveBeenCalledWith("e1", true));
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("fora dos números do Time"));
  });

  it("empresa interna oferece voltar a contar", async () => {
    h.empresa = empresa({ interna: true });
    montar();
    await menu(/Contar nos números do Time/);
    await waitFor(() => expect(h.marcarEmpresaInterna).toHaveBeenCalledWith("e1", false));
    expect(toast.success).toHaveBeenCalledWith("Voltou a contar nos números do Time");
  });

  it("arquivada: reativar pelo atalho e excluir de vez volta para a lista", async () => {
    h.empresa = empresa({ status: "cancelled" });
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole("button", { name: "Reativar" }));
    await waitFor(() =>
      expect(h.atualizarEmpresa).toHaveBeenCalledWith("e1", { status: "active", confirm_name: undefined })
    );
    expect(toast.success).toHaveBeenCalledWith("Empresa reativada");

    await user.click(screen.getByRole("button", { name: "Excluir de vez" }));
    const dialogo = await screen.findByRole("dialog");
    await user.type(within(dialogo).getByLabelText("Motivo"), "pedido do cliente");
    await confirmarComNome("Excluir empresa");
    await waitFor(() =>
      expect(h.edgeFetch).toHaveBeenCalledWith("ultra-admin-empresas", {
        method: "DELETE",
        body: { empresa_id: "e1", confirm_name: "Alfa", motivo: "pedido do cliente" },
      })
    );
    expect(await screen.findByTestId("local")).toHaveTextContent("/ultra-admin/empresas");
  });

  it("suspensa: menu mostra reativar e arquivar", async () => {
    h.empresa = empresa({ status: "suspended" });
    montar();
    await menu(/Reativar/);
    await waitFor(() =>
      expect(h.atualizarEmpresa).toHaveBeenCalledWith("e1", { status: "active", confirm_name: undefined })
    );
  });

  it("arquivada: excluir de vez também pelo menu", async () => {
    h.empresa = empresa({ status: "cancelled" });
    montar();
    await menu(/Excluir de vez/);
    expect(await screen.findByText("Excluir Alfa de vez?")).toBeInTheDocument();
  });

  it("convidada: começar a cobrar com prazo", async () => {
    h.empresa = empresa({ cobranca: { status: null, trialEndsAt: null, isPaying: false, convidada: true } });
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole("button", { name: "Começar a cobrar" }));
    const dialogo = await screen.findByRole("dialog");
    await user.clear(within(dialogo).getByLabelText(/Prazo para assinar/));
    await user.type(within(dialogo).getByLabelText(/Prazo para assinar/), "14");
    await confirmarComNome("Começar a cobrar");
    await waitFor(() =>
      expect(h.atualizarEmpresa).toHaveBeenCalledWith("e1", {
        converter_pagante: { dias_prazo: 14, confirm_name: "Alfa" },
      })
    );
    expect(toast.success).toHaveBeenCalledWith("Cobrança iniciada: 14 dias para assinar");
  });

  it("convidada também pode começar a cobrar pelo menu", async () => {
    h.empresa = empresa({ cobranca: { status: null, trialEndsAt: null, isPaying: false, convidada: true } });
    montar();
    await menu("Começar a cobrar");
    expect(await screen.findByText("Começar a cobrar Alfa?")).toBeInTheDocument();
  });

  it("em teste: tornar convidada pelo atalho", async () => {
    h.empresa = empresa({
      cobranca: {
        status: "trialing",
        trialEndsAt: new Date(Date.now() + 86_400_000 * 2).toISOString(),
        isPaying: false,
        convidada: false,
      },
    });
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole("button", { name: "Tornar convidada" }));
    await confirmarComNome("Tornar convidada");
    await waitFor(() =>
      expect(h.atualizarEmpresa).toHaveBeenCalledWith("e1", { marcar_convidada: { confirm_name: "Alfa" } })
    );
  });

  it("não pagante pode virar convidada pelo menu", async () => {
    h.empresa = empresa({ cobranca: { status: null, trialEndsAt: null, isPaying: false, convidada: false } });
    montar();
    await menu("Tornar convidada");
    expect(await screen.findByText("Tornar Alfa convidada?")).toBeInTheDocument();
  });

  it("falha numa ação avisa o erro e mantém o diálogo", async () => {
    h.atualizarEmpresa.mockRejectedValue(new Error("nome não confere"));
    montar();
    await menu(/Suspender acesso/);
    await confirmarComNome("Suspender");
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Não foi possível mudar o status", expect.anything()));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("EmpresaDetalhe: abas", () => {
  it("visão: IA do mês, admins ativos e últimas ações; 'Ver tudo' abre a atividade", async () => {
    h.custos = {
      porEmpresa: [
        {
          empresaId: "e1",
          empresaNome: "Alfa",
          planoNome: "Pro",
          chamadas: 4,
          tokensTotal: 1200,
          custo: 2,
          receita: 400,
          margem: 398,
          tokensHoje: 0,
          mediaAnteriorGasto: 0,
          anomaliaGasto: false,
        },
      ],
      porAgente: [],
      totais: { custo: 2, receita: 400, chamadas: 4, tokens: 1200, anomalias: 0 },
    };
    h.atividade = [
      {
        id: "a1",
        quando: new Date().toISOString(),
        ator: "m@pilar",
        frase: "editou a empresa Alfa",
        detalhe: null,
        tipo: "empresa",
        empresaId: "e1",
        link: null,
      },
    ];
    h.mutacoes = [
      {
        id: "m1",
        ator: null,
        action: "company_features_change",
        tabela: "company_features",
        quando: new Date(Date.now() - 1000).toISOString(),
      },
    ];
    const user = userEvent.setup();
    montar();
    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(screen.queryByText("Bia")).not.toBeInTheDocument();
    expect(screen.getByText(/R\$\s?0,50/)).toBeInTheDocument();
    expect(screen.getAllByText("editou a empresa Alfa").length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "Ver tudo" }));
    // Atividade junta a auditoria (com o nome antes do @) e as mutações de dados.
    expect(await screen.findByText("mudou as funcionalidades da empresa")).toBeInTheDocument();
    expect(screen.getByText("m")).toBeInTheDocument();
  });

  it("visão sem IA, sem admin e sem atividade mostra os vazios", () => {
    h.empresa = empresa({ usuarios: [] });
    montar();
    expect(screen.getByText("Nenhuma chamada de IA neste mês.")).toBeInTheDocument();
    expect(screen.getByText(/Nenhum admin ativo/)).toBeInTheDocument();
    expect(screen.getByText("Nada registrado ainda.")).toBeInTheDocument();
  });

  it("atividade vazia pela URL", () => {
    montar("/ultra-admin/empresas/e1?tab=atividade");
    expect(screen.getByText("Nada registrado nesta empresa")).toBeInTheDocument();
  });

  it("usuários: cada ação vai para a edge ou RPC certa com a empresa", async () => {
    const user = userEvent.setup();
    montar("/ultra-admin/empresas/e1?tab=usuarios");
    await user.click(screen.getByRole("button", { name: "convidar" }));
    await waitFor(() =>
      expect(h.edgeFetch).toHaveBeenCalledWith("ultra-admin-usuarios", {
        body: { empresa_id: "e1", email: "n@x.co", nome: "Novo", role: "user" },
      })
    );
    await user.click(screen.getByRole("button", { name: "papel" }));
    await user.click(screen.getByRole("button", { name: "remover" }));
    await user.click(screen.getByRole("button", { name: "reenviar" }));
    await user.click(screen.getByRole("button", { name: "cancelar convite" }));
    await waitFor(() => expect(h.edgeFetch).toHaveBeenCalledTimes(5));
    expect(h.edgeFetch).toHaveBeenCalledWith("ultra-admin-usuarios", {
      method: "PUT",
      body: { user_id: "u1", role: "coordenador", empresa_id: "e1" },
    });
    expect(h.edgeFetch).toHaveBeenCalledWith("ultra-admin-usuarios", {
      method: "DELETE",
      body: { user_id: "u1", empresa_id: "e1" },
    });
    expect(h.edgeFetch).toHaveBeenCalledWith("ultra-admin-usuarios", {
      method: "POST",
      body: { resend: true, convite_id: "c1" },
    });
    expect(h.edgeFetch).toHaveBeenCalledWith("ultra-admin-usuarios", {
      method: "DELETE",
      body: { convite_id: "c1", empresa_id: "e1" },
    });
    expect(toast.success).toHaveBeenCalledWith("Convite reenviado para c@x.co");

    await user.click(screen.getByRole("button", { name: "financeiro" }));
    await user.click(screen.getByRole("button", { name: "equipe" }));
    await user.click(screen.getByRole("button", { name: "metas" }));
    await waitFor(() => expect(h.rpc).toHaveBeenCalledTimes(3));
    expect(h.rpc).toHaveBeenCalledWith("set_financeiro_delegado", { p_user_id: "u1", p_delegado: true });
    expect(h.rpc).toHaveBeenCalledWith("set_equipe_delegado", { p_user_id: "u1", p_delegado: false });
    expect(toast.success).toHaveBeenCalledWith("Acesso revogado");
  });

  it("delegação recusada pela RPC avisa o erro", async () => {
    h.rpc.mockResolvedValue({ error: new Error("sem permissão") });
    const user = userEvent.setup();
    montar("/ultra-admin/empresas/e1?tab=usuarios");
    await user.click(screen.getByRole("button", { name: "metas" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Não foi possível salvar", expect.anything()));
  });

  it("trocar de aba pelos botões de seção", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole("tab", { name: /Atividade/ }));
    expect(await screen.findByText("Nada registrado nesta empresa")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: /Visão geral/ }));
    expect(await screen.findByText("IA no mês")).toBeInTheDocument();
  });
});
