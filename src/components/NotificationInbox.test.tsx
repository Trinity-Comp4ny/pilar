import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { NotificationInbox } from "./NotificationInbox";

type N = {
  id: string;
  titulo: string;
  mensagem?: string | null;
  categoria: string;
  severidade: string;
  link?: string | null;
  lido_em: string | null;
  created_at: string;
};

const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  itens: [] as N[],
  contagem: undefined as
    { total: number; porCategoria: Record<string, number>; porTipoPortal: Record<string, number> } | undefined,
  useNotificacoes: vi.fn(),
  marcarLida: vi.fn(),
  marcarTodas: vi.fn(),
  arquivar: vi.fn(),
  arquivarTodas: vi.fn(),
  realtime: vi.fn(),
  favicon: vi.fn(),
  isUltraAdmin: false,
}));

vi.mock("react-router-dom", async (orig) => ({
  ...(await orig<typeof import("react-router-dom")>()),
  useNavigate: () => h.navigate,
}));
vi.mock("@/hooks/useNotificacoes", () => ({
  useNotificacoes: (...a: unknown[]) => (h.useNotificacoes(...a), { data: h.itens }),
  useNotificacoesNaoLidas: () => ({ data: h.contagem }),
  useNotificacoesRealtime: h.realtime,
  useMarcarLida: () => ({ mutate: h.marcarLida }),
  useMarcarTodasLidas: () => ({ mutate: h.marcarTodas }),
  useArquivar: () => ({ mutate: h.arquivar }),
  useArquivarTodas: () => ({ mutate: h.arquivarTodas }),
}));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ isUltraAdmin: h.isUltraAdmin }) }));
vi.mock("@/lib/favicon", () => ({ setFaviconBadge: h.favicon }));
vi.mock("@/pages/notificacoes/PreferenciasDialog", () => ({
  PreferenciasDialog: ({ open }: { open: boolean }) => (open ? <div data-testid="prefs" /> : null),
}));

function Local() {
  const loc = useLocation();
  return <span data-testid="local">{loc.search}</span>;
}

function renderInbox(rota = "/inicio") {
  render(
    <MemoryRouter initialEntries={[rota]}>
      <NotificationInbox />
      <Local />
    </MemoryRouter>
  );
  return userEvent.setup();
}

const agora = new Date().toISOString();
const NAO_LIDA: N = {
  id: "n1",
  titulo: "Tarefa atribuída",
  mensagem: "Revisar planta",
  categoria: "tarefa",
  severidade: "info",
  link: "/gestao/tarefas/1",
  lido_em: null,
  created_at: agora,
};
const LIDA_SEM_LINK: N = {
  id: "n2",
  titulo: "Aviso antigo",
  categoria: "financeiro",
  severidade: "warning",
  link: "  ",
  lido_em: agora,
  created_at: agora,
};

beforeEach(() => {
  vi.clearAllMocks();
  h.itens = [NAO_LIDA, LIDA_SEM_LINK];
  h.contagem = { total: 3, porCategoria: { tarefa: 2, sistema: 1 }, porTipoPortal: { problema: 1 } };
  h.isUltraAdmin = false;
});

async function abrirSino(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /^Notificações/ }));
}

describe("NotificationInbox", () => {
  it("sem não lidas: rótulo simples e favicon sem badge", () => {
    h.contagem = undefined;
    renderInbox();
    expect(screen.getByRole("button", { name: "Notificações" })).toBeInTheDocument();
    expect(h.favicon).toHaveBeenCalledWith(false);
    expect(h.realtime).toHaveBeenCalled();
  });

  it("com não lidas: contagem no rótulo e badge no favicon", async () => {
    const user = renderInbox();
    expect(screen.getByRole("button", { name: "Notificações, 3 não lidas" })).toBeInTheDocument();
    expect(h.favicon).toHaveBeenCalledWith(true);
    await abrirSino(user);
    expect(await screen.findByText("Inbox 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tarefas, 2 não lidas" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Portal/ })).not.toBeInTheDocument();
  });

  it("abrir não lida marca como lida e navega", async () => {
    const user = renderInbox();
    await abrirSino(user);
    await user.click(await screen.findByText("Tarefa atribuída"));
    expect(h.marcarLida).toHaveBeenCalledWith("n1");
    expect(h.navigate).toHaveBeenCalledWith("/gestao/tarefas/1");
  });

  it("abrir lida sem link não navega nem marca", async () => {
    const user = renderInbox();
    await abrirSino(user);
    await user.click(await screen.findByText("Aviso antigo"));
    expect(h.marcarLida).not.toHaveBeenCalled();
    expect(h.navigate).not.toHaveBeenCalled();
  });

  it("arquivar um item não abre o item", async () => {
    const user = renderInbox();
    await abrirSino(user);
    await user.click((await screen.findAllByRole("button", { name: "Arquivar" }))[0]);
    expect(h.arquivar).toHaveBeenCalledWith("n1");
    expect(h.navigate).not.toHaveBeenCalled();
  });

  it("ações em massa usam o filtro ativo", async () => {
    const user = renderInbox();
    await abrirSino(user);
    await user.click(await screen.findByRole("button", { name: /Marcar todas como lidas/ }));
    expect(h.marcarTodas).toHaveBeenCalledWith({ categoria: null, tipo: null });
    await user.click(screen.getByRole("button", { name: "Tarefas, 2 não lidas" }));
    await user.click(screen.getByRole("button", { name: /Arquivar todas/ }));
    expect(h.arquivarTodas).toHaveBeenCalledWith({ categoria: "tarefa", tipo: null });
  });

  it("categoria sem não lidas desabilita marcar todas", async () => {
    const user = renderInbox();
    await abrirSino(user);
    await user.click(await screen.findByRole("button", { name: "Obras" }));
    expect(screen.getByRole("button", { name: /Marcar todas como lidas/ })).toBeDisabled();
    // clicar de novo volta para Todas
    await user.click(screen.getByRole("button", { name: "Obras" }));
    expect(screen.getByRole("button", { name: "Todas" })).toHaveAttribute("aria-pressed", "true");
  });

  it("listas vazias têm mensagem por aba e categoria", async () => {
    h.itens = [];
    const user = renderInbox();
    await abrirSino(user);
    expect(await screen.findByText("Tudo em dia. Nada por aqui.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Arquivar todas/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Projetos" }));
    expect(screen.getByText("Tudo em dia em projetos.")).toBeInTheDocument();
    await user.click(screen.getByText("Arquivadas"));
    expect(screen.getByText("Nada arquivado em projetos.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Todas" }));
    expect(screen.getByText("Nada arquivado.")).toBeInTheDocument();
    expect(h.useNotificacoes).toHaveBeenLastCalledWith("archive", 50, { categoria: null, tipo: null });
    await user.click(screen.getByText(/^Inbox/));
  });

  it("aba arquivadas não oferece arquivar nem contagem nas categorias", async () => {
    const user = renderInbox();
    await abrirSino(user);
    await user.click(await screen.findByText("Arquivadas"));
    expect(screen.queryByRole("button", { name: "Arquivar" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tarefas" })).toBeInTheDocument();
  });

  it("engrenagem abre as preferências", async () => {
    const user = renderInbox();
    await abrirSino(user);
    await user.click(await screen.findByRole("button", { name: "Preferências de notificação" }));
    expect(screen.getByTestId("prefs")).toBeInTheDocument();
  });

  it("?abrir=preferencias-notificacao abre as preferências e limpa o parâmetro", () => {
    renderInbox("/inicio?abrir=preferencias-notificacao&x=1");
    expect(screen.getByTestId("prefs")).toBeInTheDocument();
    expect(screen.getByTestId("local")).toHaveTextContent("?x=1");
  });

  it("ultra admin filtra avisos do portal por tipo", async () => {
    h.isUltraAdmin = true;
    const user = renderInbox();
    await abrirSino(user);
    await user.click(await screen.findByRole("button", { name: "Portal, 1 não lidas" }));
    const grupo = screen.getByRole("group", { name: "Filtrar por tipo de aviso" });
    await user.click(within(grupo).getByRole("button", { name: "Problemas, 1 não lidas" }));
    expect(h.useNotificacoes).toHaveBeenLastCalledWith("inbox", 50, { categoria: "sistema", tipo: "problema" });
    expect(screen.getByRole("button", { name: /Marcar todas como lidas/ })).toBeEnabled();
    await user.click(within(grupo).getByRole("button", { name: "Sugestões" }));
    expect(screen.getByRole("button", { name: /Marcar todas como lidas/ })).toBeDisabled();
    await user.click(within(grupo).getByRole("button", { name: "Sugestões" }));
    await user.click(within(grupo).getByRole("button", { name: "Todos" }));
    expect(h.useNotificacoes).toHaveBeenLastCalledWith("inbox", 50, { categoria: "sistema", tipo: null });
  });
});
