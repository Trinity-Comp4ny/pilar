import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DesbloqueioNivel } from "./DesbloqueioNivel";

const h = vi.hoisted(() => ({
  assinatura: undefined as { status: string } | undefined,
  invoke: vi.fn(),
  rpc: vi.fn(),
  track: vi.fn(),
  openSettings: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: h.invoke }, rpc: h.rpc } }));
vi.mock("@/pages/billing/hooks/useMySubscription", () => ({ useMySubscription: () => ({ data: h.assinatura }) }));
vi.mock("@/contexts/SettingsModalContext", () => ({ useSettingsModal: () => ({ openSettings: h.openSettings }) }));
vi.mock("@/lib/analytics", () => ({ analytics: { track: h.track } }));
vi.mock("sonner", () => ({ toast: { success: h.toastSuccess, error: h.toastError } }));

const onOpenChange = vi.fn();

function renderDialog(props: { isAdmin: boolean; limite?: number | null; recurso?: "projetos" | "obras" | "leads" }) {
  render(
    <DesbloqueioNivel
      open
      onOpenChange={onOpenChange}
      recurso={props.recurso ?? "projetos"}
      limite={props.limite === undefined ? 3 : props.limite}
      isAdmin={props.isAdmin}
    />
  );
  return userEvent.setup();
}

beforeEach(() => {
  vi.clearAllMocks();
  h.assinatura = undefined;
  h.invoke.mockResolvedValue({ data: { status: "verificado" }, error: null });
  h.rpc.mockResolvedValue({ error: null });
});

describe("DesbloqueioNivel › período de teste, admin", () => {
  it("valida o documento e confirma", async () => {
    const user = renderDialog({ isAdmin: true });
    expect(screen.getByText(/o limite de 3 projetos ativos do período de teste/)).toBeInTheDocument();
    const input = screen.getByLabelText("CNPJ ou CPF");
    await user.type(input, "11222333000180");
    expect(screen.getByText("Documento inválido.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar documento" })).toBeDisabled();
    await user.clear(input);
    await user.type(input, "11222333000181");
    expect(input).toHaveValue("11.222.333/0001-81");
    await user.click(screen.getByRole("button", { name: "Confirmar documento" }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(h.invoke).toHaveBeenCalledWith("verificar-documento", { body: { documento: "11222333000181" } });
    expect(h.track).toHaveBeenCalledWith("trial_nivel_subiu", { recurso: "projetos", status: "verificado" });
    expect(h.toastSuccess).toHaveBeenCalledWith("Documento confirmado", {
      description: "Sua empresa já tem mais capacidade. Tente criar de novo.",
    });
    expect(h.track).not.toHaveBeenCalledWith("trial_desbloqueio_abandonado", expect.anything());
  });

  it("CPF pendente avisa que vai reconfirmar", async () => {
    h.invoke.mockResolvedValue({ data: { status: "pendente" }, error: null });
    const user = renderDialog({ isAdmin: true, limite: null, recurso: "obras" });
    expect(screen.getByText(/o limite de obras ativas do período de teste/)).toBeInTheDocument();
    await user.type(screen.getByLabelText("CNPJ ou CPF"), "52998224725");
    await user.click(screen.getByRole("button", { name: "Confirmar documento" }));
    await waitFor(() =>
      expect(h.toastSuccess).toHaveBeenCalledWith("Documento confirmado", {
        description: "Vamos reconfirmar em breve; sua capacidade já subiu enquanto isso.",
      })
    );
  });

  it("sem status no retorno registra como verificado", async () => {
    h.invoke.mockResolvedValue({ data: null, error: null });
    const user = renderDialog({ isAdmin: true });
    await user.type(screen.getByLabelText("CNPJ ou CPF"), "52998224725");
    await user.click(screen.getByRole("button", { name: "Confirmar documento" }));
    await waitFor(() =>
      expect(h.track).toHaveBeenCalledWith("trial_nivel_subiu", { recurso: "projetos", status: "verificado" })
    );
  });

  it("erro da edge function ou do corpo avisa e mantém aberto", async () => {
    h.invoke.mockResolvedValueOnce({ data: { error: "Documento de outra empresa" }, error: null });
    const user = renderDialog({ isAdmin: true });
    await user.type(screen.getByLabelText("CNPJ ou CPF"), "52998224725");
    await user.click(screen.getByRole("button", { name: "Confirmar documento" }));
    await waitFor(() =>
      expect(h.toastError).toHaveBeenCalledWith("Não foi possível confirmar o documento", {
        description: "Documento de outra empresa",
      })
    );

    h.invoke.mockResolvedValueOnce({ data: null, error: new Error("non-2xx") });
    await user.click(screen.getByRole("button", { name: "Confirmar documento" }));
    await waitFor(() => expect(h.toastError).toHaveBeenCalledTimes(2));
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("erro que não é Error usa mensagem padrão", async () => {
    h.invoke.mockRejectedValue("x");
    const user = renderDialog({ isAdmin: true });
    await user.type(screen.getByLabelText("CNPJ ou CPF"), "52998224725");
    await user.click(screen.getByRole("button", { name: "Confirmar documento" }));
    await waitFor(() =>
      expect(h.toastError).toHaveBeenCalledWith("Não foi possível confirmar o documento", {
        description: "Tente novamente",
      })
    );
  });

  it("fechar sem concluir registra abandono", async () => {
    const user = renderDialog({ isAdmin: true });
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(h.track).toHaveBeenCalledWith("trial_desbloqueio_abandonado", { recurso: "projetos", via: "documento" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe("DesbloqueioNivel › período de teste, não-admin", () => {
  it("avisa o administrador", async () => {
    const user = renderDialog({ isAdmin: false, recurso: "leads" });
    expect(screen.getByText(/o limite de 3 leads ativos do período de teste/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Avisar administrador" }));
    await waitFor(() => expect(h.toastSuccess).toHaveBeenCalledWith("Administrador avisado", expect.any(Object)));
    expect(h.rpc).toHaveBeenCalledWith("avisar_admin_capacidade", { p_recurso: "leads" });
    expect(h.track).toHaveBeenCalledWith("trial_admin_avisado", { recurso: "leads" });
  });

  it("erro ao avisar e fechar sem avisar", async () => {
    h.rpc.mockResolvedValue({ error: new Error("sem admin") });
    const user = renderDialog({ isAdmin: false });
    await user.click(screen.getByRole("button", { name: "Avisar administrador" }));
    await waitFor(() =>
      expect(h.toastError).toHaveBeenCalledWith("Não foi possível avisar o administrador", {
        description: "sem admin",
      })
    );
    h.rpc.mockRejectedValue("x");
    await user.click(screen.getByRole("button", { name: "Avisar administrador" }));
    await waitFor(() =>
      expect(h.toastError).toHaveBeenLastCalledWith("Não foi possível avisar o administrador", {
        description: "Tente novamente",
      })
    );
    await user.click(screen.getByRole("button", { name: "Fechar" }));
    expect(h.track).toHaveBeenCalledWith("trial_desbloqueio_abandonado", { recurso: "projetos", via: "avisar_admin" });
  });
});

describe("DesbloqueioNivel › plano ativo", () => {
  beforeEach(() => {
    h.assinatura = { status: "active" };
  });

  it("admin vai para os planos", async () => {
    const user = renderDialog({ isAdmin: true });
    expect(screen.getByText(/o limite de 3 projetos ativos do seu plano/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ver planos" }));
    expect(h.track).toHaveBeenCalledWith("plano_limite_ver_planos", { recurso: "projetos", limite: 3 });
    expect(h.openSettings).toHaveBeenCalledWith("pagamento");
  });

  it("não-admin avisa o admin com texto do plano", () => {
    renderDialog({ isAdmin: false, limite: null });
    expect(screen.getByText("Você atingiu um limite do plano")).toBeInTheDocument();
    expect(screen.getByText(/o limite de projetos ativos do seu plano. Só um administrador/)).toBeInTheDocument();
  });
});
