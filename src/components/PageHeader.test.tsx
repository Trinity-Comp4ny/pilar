import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { PageHeader } from "./PageHeader";

// O header depende de contexto de sidebar e permissões; nos testes, mocka os dois.
vi.mock("@/components/ui/sidebar", () => ({
  useSidebar: () => ({ isMobile: false }),
  SidebarTrigger: () => null,
}));

const getButtonPropsMock = vi.fn(() => ({ disabled: false, title: "", "aria-disabled": false }));
vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({ getButtonProps: getButtonPropsMock }),
}));

function renderAt(path: string, ui: React.ReactElement) {
  return render(<MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>);
}

describe("PageHeader", () => {
  beforeEach(() => {
    getButtonPropsMock.mockReset();
    getButtonPropsMock.mockReturnValue({ disabled: false, title: "", "aria-disabled": false });
  });

  it("renderiza só com title (compat com uso antigo)", () => {
    renderAt("/inicio", <PageHeader title="Início" />);
    expect(screen.getByRole("heading", { name: "Início" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("mostra o rótulo do módulo da rota e permite desligar", () => {
    const { unmount } = renderAt("/projetos", <PageHeader title="Projetos" />);
    expect(screen.getByText("Projetos", { selector: "span" })).toBeInTheDocument();
    unmount();

    renderAt("/projetos", <PageHeader title="Sem módulo" moduleLabel={false} />);
    expect(screen.queryByText("Projetos", { selector: "span" })).not.toBeInTheDocument();
  });

  it("busca é controlada pela página", async () => {
    const onChange = vi.fn();
    renderAt(
      "/clientes",
      <PageHeader title="Clientes" search={{ value: "", onChange, placeholder: "Buscar clientes" }} />
    );
    await userEvent.type(screen.getByLabelText("Buscar clientes"), "a");
    expect(onChange).toHaveBeenCalledWith("a");
  });

  it("atalho / foca a busca; ignora quando um input tem foco", () => {
    const onChange = vi.fn();
    renderAt(
      "/clientes",
      <>
        <input aria-label="outro campo" />
        <PageHeader title="Clientes" search={{ value: "", onChange, placeholder: "Buscar clientes" }} />
      </>
    );
    const busca = screen.getByLabelText("Buscar clientes");

    fireEvent.keyDown(window, { key: "/" });
    expect(document.activeElement).toBe(busca);

    const outro = screen.getByLabelText("outro campo");
    outro.focus();
    fireEvent.keyDown(window, { key: "/" });
    expect(document.activeElement).toBe(outro);
  });

  it("Esc limpa a busca", () => {
    const onChange = vi.fn();
    renderAt("/clientes", <PageHeader title="Clientes" search={{ value: "abc", onChange }} />);
    fireEvent.keyDown(screen.getByLabelText("Buscar"), { key: "Escape" });
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("ação primária com feature aplica o gate de permissão", () => {
    getButtonPropsMock.mockReturnValue({ disabled: true, title: "Sem permissão", "aria-disabled": true });
    renderAt(
      "/projetos",
      <PageHeader title="Projetos" primaryAction={{ label: "Novo projeto", onClick: vi.fn(), feature: "projetos" }} />
    );
    const btn = screen.getByRole("button", { name: "Novo projeto" });
    expect(btn).toBeDisabled();
    expect(getButtonPropsMock).toHaveBeenCalledWith("projetos", "edit");
  });

  it("ação primária sem feature dispara onClick", async () => {
    const onClick = vi.fn();
    renderAt("/projetos", <PageHeader title="Projetos" primaryAction={{ label: "Novo projeto", onClick }} />);
    await userEvent.click(screen.getByRole("button", { name: "Novo projeto" }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
