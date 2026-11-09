import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ImpersonationBanner } from "./ImpersonationBanner";
import { ImpersonationPicker } from "./ImpersonationPicker";

const h = vi.hoisted(() => ({
  realRole: "admin" as string,
  viewAsRole: null as string | null,
  isImpersonating: false,
  start: vi.fn(),
  stop: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ realRole: h.realRole }) }));
vi.mock("@/contexts/ImpersonationContext", () => ({
  useImpersonation: () => ({
    viewAsRole: h.viewAsRole,
    isImpersonating: h.isImpersonating,
    startImpersonation: h.start,
    stopImpersonation: h.stop,
  }),
}));
// Submenu do Radix não abre de forma confiável no jsdom; a lógica do picker é o que importa aqui.
vi.mock("@/components/ui/dropdown-menu", () => {
  const Passa = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    DropdownMenuSub: Passa,
    DropdownMenuSubTrigger: Passa,
    DropdownMenuSubContent: Passa,
    DropdownMenuPortal: Passa,
    DropdownMenuItem: ({ children, onClick }: { children?: ReactNode; onClick?: () => void }) => (
      <button type="button" role="menuitem" onClick={onClick}>
        {children}
      </button>
    ),
  };
});
vi.mock("sonner", () => ({ toast: { success: h.toastSuccess, error: h.toastError } }));

beforeEach(() => {
  vi.clearAllMocks();
  h.realRole = "admin";
  h.viewAsRole = null;
  h.isImpersonating = false;
  h.start.mockResolvedValue(undefined);
  h.stop.mockResolvedValue(undefined);
});

async function abrirPicker() {
  const user = userEvent.setup();
  render(<ImpersonationPicker />);
  expect(screen.getByText("Ver como...")).toBeInTheDocument();
  return user;
}

describe("ImpersonationPicker", () => {
  it("não aparece para quem não é admin", () => {
    h.realRole = "user";
    const { container } = render(<ImpersonationPicker />);
    expect(container).toBeEmptyDOMElement();
  });

  it("admin só visualiza como usuário e inicia direto", async () => {
    const user = await abrirPicker();
    const itens = await screen.findAllByRole("menuitem");
    expect(itens.map((i) => i.textContent)).not.toContain("Admin");
    await user.click(itens[itens.length - 1]);
    await waitFor(() => expect(h.toastSuccess).toHaveBeenCalled());
    expect(h.start).toHaveBeenCalledWith("user");
  });

  it("falha ao iniciar avisa", async () => {
    h.start.mockRejectedValue(new Error("x"));
    const user = await abrirPicker();
    const itens = await screen.findAllByRole("menuitem");
    await user.click(itens[itens.length - 1]);
    await waitFor(() =>
      expect(h.toastError).toHaveBeenCalledWith("Não foi possível iniciar a visualização", expect.any(Object))
    );
  });

  it("ultra admin com visualização ativa pode sair", async () => {
    h.realRole = "ultra_admin";
    h.viewAsRole = "admin";
    const user = await abrirPicker();
    expect(await screen.findByText("ativo")).toBeInTheDocument();
    await user.click(screen.getByText("Sair da visualização"));
    expect(h.stop).toHaveBeenCalled();
  });
});

describe("ImpersonationBanner", () => {
  it("some sem impersonação", () => {
    const { container } = render(<ImpersonationBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("mostra o papel simulado e sai", async () => {
    h.isImpersonating = true;
    h.viewAsRole = "user";
    render(<ImpersonationBanner />);
    expect(screen.getByRole("status")).toHaveTextContent("Visualizando como");
    await userEvent.setup().click(screen.getByRole("button", { name: /Sair/ }));
    expect(h.stop).toHaveBeenCalled();
  });
});
