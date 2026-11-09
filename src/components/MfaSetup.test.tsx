import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MfaSetup } from "./MfaSetup";

const h = vi.hoisted(() => ({
  factors: [] as { id: string; status: string }[],
  loading: false,
  enrollTotp: vi.fn(),
  unenroll: vi.fn(),
  resetAllFactors: vi.fn(),
  unenrollPending: vi.fn(),
  refresh: vi.fn(),
  verifyTotp: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  backupProps: [] as { autoGenerate?: boolean }[],
}));

vi.mock("@/hooks/useMfa", () => ({
  useMfa: () => ({
    factors: h.factors,
    loading: h.loading,
    enrollTotp: h.enrollTotp,
    unenroll: h.unenroll,
    resetAllFactors: h.resetAllFactors,
    unenrollPending: h.unenrollPending,
    refresh: h.refresh,
    verifyTotp: h.verifyTotp,
  }),
}));
vi.mock("sonner", () => ({ toast: { error: h.toastError, success: h.toastSuccess } }));
vi.mock("@/components/MfaBackupCodes", () => ({
  MfaBackupCodes: (p: { autoGenerate?: boolean }) => {
    h.backupProps.push(p);
    return <div data-testid="backup-codes" data-auto={String(!!p.autoGenerate)} />;
  },
}));

const ENROLL = { factorId: "f-novo", qrCode: "data:image/png;base64,xx", secret: "SECRETKEY" };

function otpInputs() {
  return Array.from(document.querySelectorAll<HTMLInputElement>('input[inputmode="numeric"]'));
}

async function abrirEnroll() {
  const user = userEvent.setup();
  render(<MfaSetup />);
  await user.click(screen.getByRole("button", { name: /Ativar dois fatores/ }));
  await screen.findByText("Configurar autenticação de dois fatores");
  return user;
}

function colar(codigo: string) {
  fireEvent.paste(otpInputs()[0], { clipboardData: { getData: () => codigo } });
}

beforeEach(() => {
  vi.clearAllMocks();
  h.factors = [];
  h.loading = false;
  h.backupProps = [];
  h.resetAllFactors.mockResolvedValue(undefined);
  h.enrollTotp.mockResolvedValue(ENROLL);
  h.unenroll.mockResolvedValue(undefined);
  h.unenrollPending.mockResolvedValue(undefined);
  h.verifyTotp.mockResolvedValue(undefined);
});

describe("MfaSetup", () => {
  it("mostra só o indicador enquanto carrega", () => {
    h.loading = true;
    const { container } = render(<MfaSetup />);
    expect(screen.queryByText("Desativada")).not.toBeInTheDocument();
    expect(container.firstChild).not.toBeNull();
  });

  it("sem fator verificado: desativada, sem códigos de recuperação", () => {
    h.factors = [{ id: "pend", status: "unverified" }];
    render(<MfaSetup />);
    expect(screen.getByText("Desativada")).toBeInTheDocument();
    expect(screen.getByText(/O login pede só a senha/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Como funciona/ })).toBeInTheDocument();
    expect(screen.queryByTestId("backup-codes")).not.toBeInTheDocument();
  });

  it("ativa: limpa fatores, inscreve e verifica o código colado", async () => {
    await abrirEnroll();
    expect(h.resetAllFactors).toHaveBeenCalled();
    expect(h.enrollTotp).toHaveBeenCalledWith("Authenticator");
    expect(screen.getByAltText("QR Code MFA")).toHaveAttribute("src", ENROLL.qrCode);
    expect(screen.getByText("SECRETKEY")).toBeInTheDocument();

    colar("12a3456789");
    await waitFor(() => expect(h.verifyTotp).toHaveBeenCalledWith("f-novo", "123456"));
    expect(h.toastSuccess).toHaveBeenCalledWith("Autenticação em dois fatores ativada");
    await waitFor(() => expect(h.refresh).toHaveBeenCalled());
    expect(h.unenroll).not.toHaveBeenCalled();
  });

  it("depois de ativar, os códigos de recuperação são gerados automaticamente", async () => {
    await abrirEnroll();
    // O refresh "traz" o fator verificado.
    h.refresh.mockImplementation(() => {
      h.factors = [{ id: "f-novo", status: "verified" }];
    });
    colar("123456");
    await waitFor(() => expect(h.refresh).toHaveBeenCalled());
    // força re-render com os fatores novos
    await userEvent.setup().click(screen.getByRole("button", { name: /Ajuda/ }));
    expect(await screen.findByTestId("backup-codes")).toHaveAttribute("data-auto", "true");
  });

  it("código errado: avisa, limpa os campos e permite tentar de novo", async () => {
    h.verifyTotp.mockRejectedValueOnce(new Error("Invalid TOTP code entered"));
    await abrirEnroll();
    colar("111111");
    await waitFor(() => expect(h.toastError).toHaveBeenCalledWith("Código inválido", expect.any(Object)));
    await waitFor(() => expect(otpInputs()[0].value).toBe(""));
    colar("222222");
    await waitFor(() => expect(h.verifyTotp).toHaveBeenLastCalledWith("f-novo", "222222"));
  });

  it("digitação dígito a dígito avança e só verifica com 6 dígitos", async () => {
    const user = await abrirEnroll();
    const inputs = otpInputs();
    for (let i = 0; i < 5; i++) fireEvent.change(otpInputs()[i], { target: { value: String(i + 1) } });
    expect(h.verifyTotp).not.toHaveBeenCalled();
    expect(inputs[0].value).toBe("1");
    // letras são descartadas
    fireEvent.change(otpInputs()[5], { target: { value: "x" } });
    expect(h.verifyTotp).not.toHaveBeenCalled();
    fireEvent.change(otpInputs()[5], { target: { value: "6" } });
    await waitFor(() => expect(h.verifyTotp).toHaveBeenCalledWith("f-novo", "123456"));
    void user;
  });

  it("backspace e setas navegam entre os campos", async () => {
    await abrirEnroll();
    const inputs = otpInputs();
    fireEvent.change(inputs[0], { target: { value: "1" } });
    fireEvent.change(otpInputs()[1], { target: { value: "2" } });
    // apaga o dígito do campo atual
    fireEvent.keyDown(otpInputs()[1], { key: "Backspace" });
    expect(otpInputs()[1].value).toBe("");
    // campo vazio: volta e apaga o anterior
    fireEvent.keyDown(otpInputs()[1], { key: "Backspace" });
    expect(otpInputs()[0].value).toBe("");
    expect(document.activeElement).toBe(otpInputs()[0]);
    fireEvent.keyDown(otpInputs()[0], { key: "Backspace" });
    fireEvent.keyDown(otpInputs()[0], { key: "ArrowRight" });
    expect(document.activeElement).toBe(otpInputs()[1]);
    fireEvent.keyDown(otpInputs()[1], { key: "ArrowLeft" });
    expect(document.activeElement).toBe(otpInputs()[0]);
    fireEvent.keyDown(otpInputs()[0], { key: "ArrowLeft" });
    fireEvent.keyDown(otpInputs()[5], { key: "ArrowRight" });
    fireEvent.keyDown(otpInputs()[0], { key: "Enter" });
    expect(h.verifyTotp).not.toHaveBeenCalled();
  });

  it("copia a chave manual e avisa quando a cópia falha", async () => {
    const user = await abrirEnroll();
    const writeText = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("negado"));
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await user.click(screen.getByRole("button", { name: "Copiar chave" }));
    expect(writeText).toHaveBeenCalledWith("SECRETKEY");
    await user.click(screen.getByRole("button", { name: "Copiar chave" }));
    await waitFor(() => expect(h.toastError).toHaveBeenCalledWith("Não foi possível copiar"));
  });

  it("cancelar fecha o modal e recarrega os fatores", async () => {
    const user = await abrirEnroll();
    await user.click(screen.getByRole("button", { name: /Ajuda/ }));
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByText("Configurar autenticação de dois fatores")).not.toBeInTheDocument());
    expect(h.refresh).toHaveBeenCalled();
  });

  it("falha ao ativar mostra o erro traduzido", async () => {
    h.enrollTotp.mockRejectedValueOnce(new Error("boom"));
    const user = userEvent.setup();
    render(<MfaSetup />);
    await user.click(screen.getByRole("button", { name: /Ativar dois fatores/ }));
    await waitFor(() => expect(h.toastError).toHaveBeenCalledWith("Não foi possível ativar", expect.any(Object)));
    expect(screen.queryByText("Configurar autenticação de dois fatores")).not.toBeInTheDocument();
  });

  describe("com fator verificado", () => {
    beforeEach(() => {
      h.factors = [{ id: "f-antigo", status: "verified" }];
    });

    it("mostra ativa e os códigos sem geração automática", () => {
      render(<MfaSetup />);
      expect(screen.getByText("Ativa")).toBeInTheDocument();
      expect(screen.getByTestId("backup-codes")).toHaveAttribute("data-auto", "false");
    });

    it("desativar pede confirmação e remove o fator", async () => {
      const user = userEvent.setup();
      render(<MfaSetup />);
      await user.click(screen.getByRole("button", { name: /Desativar/ }));
      await user.click(await screen.findByRole("button", { name: "Desativar" }));
      await waitFor(() => expect(h.unenroll).toHaveBeenCalledWith("f-antigo"));
      expect(h.toastSuccess).toHaveBeenCalledWith("Autenticação em dois fatores desativada");
    });

    it("erro ao desativar é avisado", async () => {
      h.unenroll.mockRejectedValueOnce(new Error("x"));
      const user = userEvent.setup();
      render(<MfaSetup />);
      await user.click(screen.getByRole("button", { name: /Desativar/ }));
      await user.click(await screen.findByRole("button", { name: "Desativar" }));
      await waitFor(() => expect(h.toastError).toHaveBeenCalledWith("Não foi possível desativar", expect.any(Object)));
    });

    it("cancelar a desativação não remove nada", async () => {
      const user = userEvent.setup();
      render(<MfaSetup />);
      await user.click(screen.getByRole("button", { name: /Desativar/ }));
      await user.click(await screen.findByRole("button", { name: "Cancelar" }));
      expect(h.unenroll).not.toHaveBeenCalled();
    });

    it("trocar autenticador: só remove o antigo após verificar o novo", async () => {
      const user = userEvent.setup();
      render(<MfaSetup />);
      await user.click(screen.getByRole("button", { name: /Trocar autenticador/ }));
      await user.click(await screen.findByRole("button", { name: "Continuar" }));
      await screen.findByText("Configurar autenticação de dois fatores");
      expect(h.unenrollPending).toHaveBeenCalled();
      expect(h.enrollTotp.mock.calls[0][0]).toMatch(/^Authenticator-\d+$/);
      expect(h.unenroll).not.toHaveBeenCalled();

      h.unenroll.mockRejectedValueOnce(new Error("já removido"));
      colar("654321");
      await waitFor(() => expect(h.unenroll).toHaveBeenCalledWith("f-antigo"));
      await waitFor(() => expect(h.refresh).toHaveBeenCalled());
    });

    it("falha ao trocar autenticador é avisada", async () => {
      h.unenrollPending.mockRejectedValueOnce(new Error("x"));
      const user = userEvent.setup();
      render(<MfaSetup />);
      await user.click(screen.getByRole("button", { name: /Trocar autenticador/ }));
      await user.click(await screen.findByRole("button", { name: "Continuar" }));
      await waitFor(() =>
        expect(h.toastError).toHaveBeenCalledWith("Falha ao trocar autenticador", expect.any(Object))
      );
    });
  });
});
