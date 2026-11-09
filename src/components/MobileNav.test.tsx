import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { Settings } from "lucide-react";
import { BottomNav } from "./BottomNav";
import { ModuleChipNav } from "./ModuleChipNav";
import { MoreSheet } from "./MoreSheet";

const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  nav: {} as Record<string, unknown>,
  pendencias: [] as unknown[] | undefined,
  visivel: true,
  auth: {
    user: { email: "dev@local.test" } as Record<string, unknown> | null,
    profile: { first_name: "Dev", last_name: "Seed" } as Record<string, unknown> | null,
    signOut: vi.fn(),
  },
  openSettings: vi.fn(),
  perms: { isAdmin: false, isUltraAdmin: false },
  ocultos: false,
  toggle: vi.fn(),
}));

vi.mock("react-router-dom", async (orig) => ({
  ...(await orig<typeof import("react-router-dom")>()),
  useNavigate: () => h.navigate,
}));
vi.mock("@/hooks/useModuleNav", () => ({ useModuleNav: () => h.nav }));
vi.mock("@/hooks/useEscopos", () => ({ usePendenciasAgentes: () => ({ data: h.pendencias }) }));
vi.mock("@/hooks/useBarraVisivel", () => ({ useBarraVisivel: () => h.visivel }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => h.auth }));
vi.mock("@/contexts/SettingsModalContext", () => ({ useSettingsModal: () => ({ openSettings: h.openSettings }) }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => h.perms }));
vi.mock("@/contexts/ValoresOcultosContext", () => ({
  useValoresOcultos: () => ({ ocultos: h.ocultos, toggle: h.toggle }),
}));
vi.mock("@/components/NotificationInbox", () => ({ NotificationInbox: () => <div data-testid="sino" /> }));
vi.mock("@/components/FeedbackDialog", () => ({
  FeedbackDialog: ({ open }: { open: boolean }) => (open ? <div data-testid="feedback-aberto" /> : null),
}));

const selectModule = vi.fn();
const item = (title: string, url: string, disabled = false, dica = "") => ({
  item: { title, url, icon: Settings },
  nav: { disabled, title: dica },
});

beforeEach(() => {
  vi.clearAllMocks();
  h.pendencias = [];
  h.visivel = true;
  h.perms = { isAdmin: false, isUltraAdmin: false };
  h.ocultos = false;
  h.auth = {
    user: { email: "dev@local.test" },
    profile: { first_name: "Dev", last_name: "Seed" },
    signOut: vi.fn().mockResolvedValue(undefined),
  };
  h.nav = {
    routeModule: "projetos",
    currentPath: "/projetos/cronograma",
    currentView: null,
    selectModule,
    moduleGroups: [
      { label: null, entries: [item("Projetos", "/projetos"), item("Cronograma", "/projetos/cronograma")] },
      { label: "Outros", entries: [item("Mapa", "/projetos/mapa", true, "Sem acesso"), item("Clima", "/x", true)] },
    ],
  };
});

describe("BottomNav", () => {
  function renderNav() {
    return render(
      <MemoryRouter initialEntries={["/inicio"]}>
        <BottomNav />
      </MemoryRouter>
    );
  }

  it("mostra os pilares na ordem fixa e marca o ativo", () => {
    renderNav();
    const botoes = screen.getAllByRole("button").map((b) => b.getAttribute("aria-label"));
    expect(botoes).toEqual(["Projetos", "Obras", "Gestão", "Menu"]);
    expect(screen.getByRole("button", { name: "Projetos" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /Início/ })).toHaveClass("bg-brand");
  });

  it("selecionar pilar delega ao useModuleNav", async () => {
    renderNav();
    await userEvent.setup().click(screen.getByRole("button", { name: "Gestão" }));
    expect(selectModule).toHaveBeenCalledWith("gestao");
  });

  it("some ao rolar (barra invisível)", () => {
    h.visivel = false;
    renderNav();
    expect(screen.getByRole("navigation")).toHaveAttribute("data-visivel", "false");
  });

  it("Menu mostra pendências e abre o MoreSheet sob demanda", async () => {
    h.pendencias = [{}, {}];
    renderNav();
    const menu = screen.getByRole("button", { name: "Menu, 2 pendências de agentes" });
    const user = userEvent.setup();
    await user.click(menu);
    expect(await screen.findByText("Agentes")).toBeInTheDocument();
  });
});

describe("ModuleChipNav", () => {
  it("rota sem módulo não mostra a faixa", () => {
    h.nav = { ...h.nav, routeModule: null };
    const { container } = render(
      <MemoryRouter>
        <ModuleChipNav />
      </MemoryRouter>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("chips do módulo com ativo, desabilitados e centraliza o ativo", () => {
    const { container } = render(
      <MemoryRouter>
        <ModuleChipNav />
      </MemoryRouter>
    );
    expect(screen.getByRole("link", { name: "Cronograma" })).toHaveClass("bg-brand");
    expect(screen.getByRole("link", { name: "Projetos" })).not.toHaveClass("bg-brand");
    expect(screen.getByText("Mapa")).toHaveAttribute("title", "Sem acesso");
    expect(screen.getByText("Clima")).toHaveAttribute("title", "Clima");
    expect(container.querySelectorAll("[aria-hidden]").length).toBe(1);
  });
});

describe("MoreSheet", () => {
  const onOpenChange = vi.fn();
  function renderSheet() {
    render(
      <MemoryRouter>
        <MoreSheet open onOpenChange={onOpenChange} />
      </MemoryRouter>
    );
    return userEvent.setup();
  }

  it("conta abre configurações e fecha o sheet", async () => {
    const user = renderSheet();
    expect(screen.getByText("dev@local.test")).toBeInTheDocument();
    await user.click(screen.getByText("Dev Seed"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(h.openSettings).toHaveBeenCalledWith("conta");
  });

  it("agentes com contador e navegação", async () => {
    h.pendencias = [{}];
    const user = renderSheet();
    await user.click(screen.getByRole("button", { name: /Agentes/ }));
    expect(h.navigate).toHaveBeenCalledWith("/agentes");
  });

  it("feedback e valores financeiros", async () => {
    const user = renderSheet();
    await user.click(screen.getByRole("button", { name: "Ocultar valores financeiros" }));
    expect(h.toggle).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Feedback" }));
    expect(screen.getByTestId("feedback-aberto")).toBeInTheDocument();
  });

  it("admin vê Portal Admin", async () => {
    h.perms = { isAdmin: true, isUltraAdmin: false };
    h.ocultos = true;
    const user = renderSheet();
    expect(screen.getByRole("button", { name: "Mostrar valores financeiros" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Portal Admin" }));
    expect(h.navigate).toHaveBeenCalledWith("/admin");
  });

  it("ultra admin vê Portal Ultra", async () => {
    h.perms = { isAdmin: true, isUltraAdmin: true };
    const user = renderSheet();
    expect(screen.queryByRole("button", { name: "Portal Admin" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Portal Ultra" }));
    expect(h.navigate).toHaveBeenCalledWith("/ultra-admin");
  });

  it("sair encerra a sessão e vai ao login", async () => {
    const user = renderSheet();
    await user.click(screen.getByRole("button", { name: "Sair" }));
    await vi.waitFor(() => expect(h.navigate).toHaveBeenCalledWith("/login"));
  });

  it("nome cai para metadata e depois 'Usuário'", () => {
    h.auth.profile = null;
    h.auth.user = { user_metadata: { nome: "Nome Meta" } };
    const { unmount } = render(
      <MemoryRouter>
        <MoreSheet open onOpenChange={onOpenChange} />
      </MemoryRouter>
    );
    expect(screen.getByText("Nome Meta")).toBeInTheDocument();
    unmount();
    h.auth.user = null;
    render(
      <MemoryRouter>
        <MoreSheet open onOpenChange={onOpenChange} />
      </MemoryRouter>
    );
    expect(screen.getByText("Usuário")).toBeInTheDocument();
  });
});
