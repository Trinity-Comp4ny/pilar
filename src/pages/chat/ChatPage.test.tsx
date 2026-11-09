import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ChatMessage, Saldo } from "./useChat";

// Tela dos agentes: saudação no vazio, envio por Enter (Shift+Enter quebra linha), projeto em
// foco, prompt vindo do Início enviado uma vez, cada rascunho no card certo, nova conversa pede
// confirmação quando há algo criado, e a aba de pendências.

const h = vi.hoisted(() => ({
  messages: [] as ChatMessage[],
  loading: false,
  saldo: null as Saldo | null,
  send: vi.fn(),
  stop: vi.fn(),
  reset: vi.fn(),
  pendencias: [] as unknown[],
}));
vi.mock("./useChat", () => ({
  useChat: () => ({
    messages: h.messages,
    send: h.send,
    stop: h.stop,
    loading: h.loading,
    reset: h.reset,
    saldo: h.saldo,
    confirmarDraft: vi.fn(),
    cancelarDraft: vi.fn(),
    desfazer: vi.fn(),
    desfazerFolha: vi.fn(),
    executarAcao: vi.fn(),
    cancelarAcao: vi.fn(),
  }),
}));
vi.mock("@/components/ui/sidebar", () => ({ useSidebar: () => ({ state: "expanded", isMobile: false }) }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ profile: { first_name: "Matheus" } }) }));
vi.mock("@/hooks/useEscopos", () => ({ usePendenciasAgentes: () => ({ data: h.pendencias }) }));
vi.mock("@/integrations/supabase/client", async () => {
  const { createSupabaseFrom } = await import("@/test/supabaseChain");
  return {
    supabase: {
      from: createSupabaseFrom(() => ({
        data: [
          { id: "p1", nome: "Residência Lima" },
          { id: "p2", nome: "Galpão Norte" },
        ],
      })).from,
    },
  };
});
vi.mock("@/components/PageHeader", () => ({
  PageHeader: ({
    title,
    center,
    children,
  }: {
    title: string;
    center?: React.ReactNode;
    children?: React.ReactNode;
  }) => (
    <header>
      <h2>{title}</h2>
      {center}
      {children}
    </header>
  ),
}));
vi.mock("./PendenciasTab", () => ({ PendenciasTab: () => <p>Fila de pendências</p> }));
// Cada card vira um marcador "card:entidade" para conferir o roteamento.
const card = vi.hoisted(
  () => (nome: string) => (p: { draft?: { entidade: string }; entidade?: string; tipo?: string }) =>
    `${nome}:${p.tipo ?? p.entidade ?? p.draft?.entidade ?? ""}`
);
vi.mock("./LeadConfirmationCard", () => ({ LeadConfirmationCard: card("lead") }));
vi.mock("./ProjetoConfirmationCard", () => ({ ProjetoConfirmationCard: card("projeto") }));
vi.mock("./LancamentoCard", () => ({ LancamentoCard: card("lancamento") }));
vi.mock("./CartaoCard", () => ({ CartaoCard: card("cartao") }));
vi.mock("./FolhaCard", () => ({ FolhaCard: card("folha") }));
vi.mock("./SimpleEntityCard", () => ({ SimpleEntityCard: card("simples") }));
vi.mock("./AditivoCard", () => ({ AditivoCard: card("aditivo") }));
vi.mock("./AcaoCard", () => ({ AcaoCard: () => <p>acao</p> }));
const toast = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast }));

Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};
Element.prototype.scrollTo ??= () => {};

import ChatPage from "./index";

function Local() {
  const l = useLocation();
  return <p data-testid="state">{JSON.stringify(l.state)}</p>;
}

function montar(state?: unknown) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[{ pathname: "/agentes", state }]}>
        <Routes>
          <Route
            path="/agentes"
            element={
              <>
                <ChatPage />
                <Local />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const draft = (entidade: string, status = "pendente") => ({
  runId: `r-${entidade}`,
  entidade,
  campos: {},
  custoCreditos: 1,
  status,
});

beforeEach(() => {
  vi.clearAllMocks();
  h.messages = [];
  h.loading = false;
  h.saldo = null;
  h.pendencias = [];
});

describe("ChatPage", () => {
  it("vazio: saudação com o primeiro nome e envio por Enter", async () => {
    const user = userEvent.setup();
    montar();
    expect(screen.getByRole("heading", { name: /(Bom dia|Boa tarde|Boa noite), Matheus/ })).toBeInTheDocument();
    const caixa = screen.getByLabelText("Mensagem para os agentes");
    expect(screen.getByRole("button", { name: "Enviar" })).toBeDisabled();
    await user.type(caixa, "Quanto entrou{Shift>}{Enter}{/Shift}este mês?");
    expect(h.send).not.toHaveBeenCalled();
    await user.type(caixa, "{Enter}");
    expect(h.send).toHaveBeenCalledWith("Quanto entrou\neste mês?", undefined);
    expect(caixa).toHaveValue("");
  });

  it("projeto em foco vai junto no envio e pode ser removido", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole("combobox", { name: "Escolher projeto em foco" }));
    await user.click(await screen.findByRole("option", { name: "Galpão Norte" }));
    const caixa = screen.getByPlaceholderText("Pergunte sobre Galpão Norte…");
    await user.type(caixa, "qual o prazo?");
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    expect(h.send).toHaveBeenCalledWith("qual o prazo?", "p2");
    await user.click(screen.getByRole("button", { name: "Remover projeto em foco" }));
    expect(screen.getByPlaceholderText("Pergunte alguma coisa…")).toBeInTheDocument();
  });

  it("prompt vindo do Início é enviado uma vez e o state é limpo", async () => {
    montar({ prompt: "  resumo do mês  " });
    await waitFor(() => expect(h.send).toHaveBeenCalledWith("resumo do mês"));
    expect(h.send).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("null"));
  });

  it("cada rascunho abre o card da entidade; resposta mostra o agente sem emoji", () => {
    h.messages = [
      { id: "1", role: "user", content: "oi" },
      {
        id: "2",
        role: "assistant",
        content: "Você tem **3** projetos",
        agentes: [{ agente: "projetos", agente_label: "📁 Projetos" }],
      },
      { id: "3", role: "assistant", content: "Falhou", erro: true },
      ...["projeto", "receita", "despesa", "cartao", "folha", "cliente", "aditivo", "lead"].map((e, i) => ({
        id: `d${i}`,
        role: "assistant" as const,
        content: "",
        draft: draft(e) as ChatMessage["draft"],
      })),
      {
        id: "a",
        role: "assistant",
        content: "",
        acao: { operacao: "quitar", runId: "x", custoCreditos: 1, status: "pendente" },
      },
    ];
    h.saldo = { tokens_plano: 1000, tokens_comprado: 0, tokens_restantes: 800 };
    montar();
    expect(screen.getByText("Projetos")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Falhou")).toBeInTheDocument();
    for (const t of [
      "projeto:projeto",
      "lancamento:receita",
      "lancamento:despesa",
      "cartao:cartao",
      "folha:folha",
      "simples:cliente",
      "aditivo:aditivo",
      "lead:lead",
      "acao",
    ]) {
      expect(screen.getByText(t)).toBeInTheDocument();
    }
  });

  it("carregando mostra o status e o botão de parar", async () => {
    const user = userEvent.setup();
    h.loading = true;
    h.messages = [{ id: "1", role: "user", content: "oi" }];
    montar();
    expect(screen.getByRole("status")).toHaveTextContent("agentes trabalhando");
    await user.click(screen.getByRole("button", { name: "Parar geração" }));
    expect(h.stop).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Nova conversa/ })).toBeDisabled();
  });

  it("nova conversa sem nada criado reseta direto", async () => {
    h.messages = [{ id: "1", role: "user", content: "oi" }];
    montar();
    await userEvent.click(screen.getByRole("button", { name: /Nova conversa/ }));
    expect(h.reset).toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
  });

  it("nova conversa com algo criado pede confirmação", async () => {
    h.messages = [{ id: "1", role: "assistant", content: "", draft: draft("lead", "criado") as ChatMessage["draft"] }];
    montar();
    await userEvent.click(screen.getByRole("button", { name: /Nova conversa/ }));
    expect(h.reset).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(
      "Começar uma nova conversa?",
      expect.objectContaining({ action: expect.objectContaining({ label: "Nova conversa", onClick: h.reset }) })
    );
  });

  it("aba de pendências mostra a contagem e a fila", async () => {
    h.pendencias = [{}, {}];
    montar();
    const abas = screen.getAllByRole("button", { name: /Pendências/ });
    expect(abas[0]).toHaveTextContent("2");
    await userEvent.click(abas[0]);
    expect(screen.getByText("Fila de pendências")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Nova conversa/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getAllByRole("button", { name: "Conversar" })[0]);
    expect(screen.getByLabelText("Mensagem para os agentes")).toBeInTheDocument();
  });
});

describe("ChatPage: rolagem da conversa", () => {
  it("longe do fim mostra 'descer'; clicar rola até a última mensagem e esconde o botão", async () => {
    const user = userEvent.setup();
    h.messages = [
      { id: "1", role: "user", content: "oi" },
      { id: "2", role: "assistant", content: "olá" },
    ];
    montar();
    const area = screen.getByText("olá").closest(".overflow-y-auto") as HTMLDivElement;
    const scrollTo = vi.fn();
    area.scrollTo = scrollTo as unknown as typeof area.scrollTo;
    Object.defineProperty(area, "scrollHeight", { value: 2000, configurable: true });
    Object.defineProperty(area, "clientHeight", { value: 500, configurable: true });

    area.scrollTop = 1450; // perto do fim: sem botão
    fireEvent.scroll(area);
    expect(screen.queryByRole("button", { name: "Descer para a mensagem mais recente" })).not.toBeInTheDocument();

    area.scrollTop = 100; // longe do fim
    fireEvent.scroll(area);
    await user.click(screen.getByRole("button", { name: "Descer para a mensagem mais recente" }));
    expect(scrollTo).toHaveBeenCalledWith({ top: 2000, behavior: "smooth" });
    expect(screen.queryByRole("button", { name: "Descer para a mensagem mais recente" })).not.toBeInTheDocument();
  });
});
