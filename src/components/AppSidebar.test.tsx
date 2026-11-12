import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { Settings } from "lucide-react";
import { MODULES } from "@/lib/modules";
import { AppSidebar } from "./AppSidebar";

const h = vi.hoisted(() => ({
  sidebar: { state: "expanded", isMobile: false, toggleSidebar: vi.fn(), setOpen: vi.fn() },
  navigate: vi.fn(),
  auth: {
    user: { email: "dev@local.test", user_metadata: { nome: "Meta Nome" } } as Record<string, unknown> | null,
    profile: { first_name: "Dev", last_name: "Seed" } as Record<string, unknown> | null,
    signOut: vi.fn(),
  },
  openSettings: vi.fn(),
  settingsOpen: false,
  perms: { isAdmin: false, isUltraAdmin: false },
  ocultos: false,
  toggleOcultos: vi.fn(),
  pendencias: [] as unknown[] | undefined,
  novidadesDestaque: false,
  feedbackNovos: 0,
  nav: {} as Record<string, unknown>,
  feedbackOpen: vi.fn(),
}));

vi.mock("react-router-dom", async (orig) => ({
  ...(await orig<typeof import("react-router-dom")>()),
  useNavigate: () => h.navigate,
}));
vi.mock("@/components/ui/sidebar", () => ({ useSidebar: () => h.sidebar }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => h.auth }));
vi.mock("@/contexts/SettingsModalContext", () => ({
  useSettingsModal: () => ({ openSettings: h.openSettings, isOpen: h.settingsOpen }),
}));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => h.perms }));
vi.mock("@/contexts/ValoresOcultosContext", () => ({
  useValoresOcultos: () => ({ ocultos: h.ocultos, toggle: h.toggleOcultos }),
}));
vi.mock("@/hooks/useEscopos", () => ({ usePendenciasAgentes: () => ({ data: h.pendencias }) }));
vi.mock("@/hooks/useFeedbackNovosCount", () => ({ useFeedbackNovosCount: () => ({ data: h.feedbackNovos }) }));
vi.mock("@/hooks/useNovidades", () => ({
  useNovidades: () => ({ pendentes: { comFluxo: [], temDestaque: h.novidadesDestaque } }),
}));
vi.mock("@/hooks/useModuleNav", () => ({ useModuleNav: () => h.nav }));
vi.mock("@/components/ImpersonationPicker", () => ({ ImpersonationPicker: () => null }));
vi.mock("@/components/NotificationInbox", () => ({ NotificationInbox: () => <div data-testid="sino" /> }));
vi.mock("@/components/FeedbackDialog", () => ({
  FeedbackDialog: ({ open }: { open: boolean }) => (open ? <div data-testid="feedback-aberto" /> : null),
}));
vi.mock("@/components/Logo", () => ({ Logo: () => <span>logo</span> }));

const selectModule = vi.fn();

function navPadrao(over: Record<string, unknown> = {}) {
  return {
    currentPath: "/gestao/tarefas",
    currentView: null,
    routeModule: "gestao",
    activeModule: "gestao",
    visibleModules: ["gestao", "projetos", "obras"],
    empresaItems: [
      { item: { title: "Agentes", url: "/agentes", icon: Settings }, nav: { disabled: false, title: "" } },
    ],
    moduleGroups: [
      {
        label: "Empresa",
        entries: [
          { item: { title: "Tarefas", url: "/gestao/tarefas", icon: Settings }, nav: { disabled: false, title: "" } },
          {
            item: { title: "Financeiro", url: "/gestao/financeiro", icon: Settings },
            nav: { disabled: true, title: "Sem acesso ao financeiro" },
          },
          {
            item: { title: "Metas", url: "/gestao/metas", icon: Settings },
            nav: { disabled: true, title: "" },
          },
        ],
      },
      {
        label: null,
        entries: [
          {
            item: { title: "Lista", url: "/gestao/tarefas?view=lista", icon: Settings, badge: "novo" },
            nav: { disabled: false, title: "" },
          },
          {
            item: { title: "Futuro", url: "/gestao/futuro", icon: Settings, badge: "em breve" },
            nav: { disabled: false, title: "" },
          },
        ],
      },
    ],
    selectModule,
    ...over,
  };
}

function renderSidebar(rota = "/") {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <AppSidebar />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  h.sidebar = { state: "expanded", isMobile: false, toggleSidebar: vi.fn(), setOpen: vi.fn() };
  h.auth = {
    user: { email: "dev@local.test", user_metadata: { nome: "Meta Nome" } },
    profile: { first_name: "Dev", last_name: "Seed" },
    signOut: vi.fn().mockResolvedValue(undefined),
  };
  h.settingsOpen = false;
  h.perms = { isAdmin: false, isUltraAdmin: false };
  h.ocultos = false;
  h.pendencias = [];
  h.novidadesDestaque = false;
  h.feedbackNovos = 0;
  h.nav = navPadrao();
});

describe("AppSidebar", () => {
  it("não renderiza no mobile", () => {
    h.sidebar.isMobile = true;
    const { container } = renderSidebar();
    expect(container).toBeEmptyDOMElement();
  });

  it("mostra trilho, painel do módulo e itens desabilitados com dica", () => {
    renderSidebar();
    expect(screen.getByRole("navigation", { name: "Módulos" })).toBeInTheDocument();
    const painel = screen.getByRole("navigation", { name: `Menu de ${MODULES.gestao.label}` });
    expect(within(painel).getByText("Empresa")).toBeInTheDocument();
    expect(within(painel).getByText("Financeiro").parentElement).toHaveAttribute("title", "Sem acesso ao financeiro");
    expect(within(painel).getByText("Metas").parentElement).toHaveAttribute("title", "Metas");
    expect(within(painel).getByText("Novo")).toBeInTheDocument();
    expect(within(painel).getByText("Em breve")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gestão" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByTestId("sino")).toBeInTheDocument();
  });

  it("selecionar módulo com painel recolhido reabre o painel", async () => {
    h.sidebar.state = "collapsed";
    renderSidebar();
    expect(screen.queryByRole("navigation", { name: /Menu de/ })).not.toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Expandir menu" }));
    expect(h.sidebar.toggleSidebar).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Projetos" }));
    expect(h.sidebar.setOpen).toHaveBeenCalledWith(true);
    expect(selectModule).toHaveBeenCalledWith("projetos");
  });

  it("selecionar módulo com painel aberto não mexe no painel", async () => {
    renderSidebar();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Obras" }));
    expect(h.sidebar.setOpen).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Recolher menu" }));
    expect(h.sidebar.toggleSidebar).toHaveBeenCalled();
  });

  it("contador de pendências dos agentes no trilho", () => {
    h.pendencias = [{}, {}, {}];
    renderSidebar();
    expect(screen.getByRole("link", { name: "Agentes, 3 pendências" })).toBeInTheDocument();
  });

  it("sem itens transversais não mostra o separador nem Agentes", () => {
    h.nav = navPadrao({ empresaItems: [] });
    renderSidebar();
    expect(screen.queryByText("Agentes")).not.toBeInTheDocument();
  });

  it("menu do usuário: configurações, feedback, valores e logout", async () => {
    const user = userEvent.setup();
    renderSidebar();
    const trigger = screen.getByRole("button", { name: "Menu do usuário" });
    expect(trigger).toHaveAttribute("title", "Dev Seed");

    await user.click(trigger);
    expect(await screen.findByText("dev@local.test")).toBeInTheDocument();
    expect(screen.queryByText("Portal Admin")).not.toBeInTheDocument();
    await user.click(screen.getByText("Dev Seed"));
    expect(h.openSettings).toHaveBeenCalledWith("conta");

    await user.click(trigger);
    await user.click(await screen.findByText("Ocultar valores financeiros"));
    expect(h.toggleOcultos).toHaveBeenCalled();

    await user.keyboard("{Escape}");
    await user.click(trigger);
    await user.click(await screen.findByText("Feedback"));
    expect(screen.getByTestId("feedback-aberto")).toBeInTheDocument();

    await user.click(trigger);
    await user.click(await screen.findByText("Log out"));
    expect(h.auth.signOut).toHaveBeenCalled();
    await vi.waitFor(() => expect(h.navigate).toHaveBeenCalledWith("/login"));
  });

  it("Novidades no menu do usuário, com ponto quando há algo novo (SPEC 152)", async () => {
    h.novidadesDestaque = true;
    const user = userEvent.setup();
    renderSidebar();
    const trigger = screen.getByRole("button", { name: "Menu do usuário, há novidades no Pilar" });
    await user.click(trigger);
    expect(await screen.findByLabelText("Há novidades")).toBeInTheDocument();
    await user.click(screen.getByText("Novidades"));
    expect(h.navigate).toHaveBeenCalledWith("/novidades");
  });

  it("admin vê o Portal Admin; valores ocultos mostra a opção inversa", async () => {
    h.perms = { isAdmin: true, isUltraAdmin: false };
    h.ocultos = true;
    h.settingsOpen = true;
    const user = userEvent.setup();
    renderSidebar();
    await user.click(screen.getByRole("button", { name: "Menu do usuário" }));
    expect(await screen.findByText("Mostrar valores financeiros")).toBeInTheDocument();
    await user.click(screen.getByText("Portal Admin"));
    expect(h.navigate).toHaveBeenCalledWith("/admin");
  });

  it("nome cai para metadata, e-mail e 'Usuário'", () => {
    h.auth.profile = null;
    const { unmount } = renderSidebar();
    expect(screen.getByRole("button", { name: "Menu do usuário" })).toHaveAttribute("title", "Meta Nome");
    unmount();

    h.auth.user = { email: "so@email.test" };
    const r2 = renderSidebar();
    expect(screen.getByRole("button", { name: "Menu do usuário" })).toHaveAttribute("title", "so@email.test");
    r2.unmount();

    h.auth.profile = { first_name: "", last_name: null };
    h.auth.user = null;
    renderSidebar();
    expect(screen.getByRole("button", { name: "Menu do usuário" })).toHaveAttribute("title", "Usuário");
  });

  describe("ultra admin", () => {
    beforeEach(() => {
      h.perms = { isAdmin: true, isUltraAdmin: true };
      h.feedbackNovos = 4;
    });

    it("fora do portal: item Ultra com aviso de feedback novo", async () => {
      h.sidebar.state = "collapsed";
      renderSidebar();
      const link = screen.getByRole("link", { name: "Portal ultra admin, 4 feedbacks novos" });
      await userEvent.setup().click(link);
      expect(h.sidebar.setOpen).toHaveBeenCalledWith(true);
    });

    it("dentro do portal: painel troca para as seções do portal", () => {
      h.nav = navPadrao({ currentPath: "/ultra-admin/feedback", routeModule: null });
      renderSidebar("/ultra-admin/feedback");
      const painel = screen.getByRole("navigation", { name: "Menu do portal ultra admin" });
      expect(within(painel).getByRole("link", { name: /Feedback/ })).toHaveAttribute("aria-current", "page");
      expect(within(painel).getByText("4")).toBeInTheDocument();
      expect(within(painel).getByText("Plataforma")).toBeInTheDocument();
    });

    it("sem feedback novo o rótulo é simples", () => {
      h.feedbackNovos = 0;
      renderSidebar();
      expect(screen.getByRole("link", { name: "Portal ultra admin" })).toBeInTheDocument();
    });
  });
});
