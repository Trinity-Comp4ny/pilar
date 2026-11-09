import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import MfaSetupPage from "./MfaSetupPage";

const h = vi.hoisted(() => ({
  listFactors: vi.fn(),
  enrollTotp: vi.fn(),
  resetAllFactors: vi.fn(),
  verifyTotp: vi.fn(),
  signOut: vi.fn(),
  refreshMfaLevel: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { mfa: { listFactors: h.listFactors } } } }));
vi.mock("@/hooks/useMfa", () => ({
  useMfa: () => ({ enrollTotp: h.enrollTotp, resetAllFactors: h.resetAllFactors, verifyTotp: h.verifyTotp }),
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ signOut: h.signOut, refreshMfaLevel: h.refreshMfaLevel }),
}));
vi.mock("sonner", () => ({ toast: { error: h.toastError, success: h.toastSuccess } }));
vi.mock("@/hooks/usePageTitle", () => ({ usePageTitle: vi.fn() }));
vi.mock("@/components/AuthPromessa", () => ({ AuthPromessa: () => null }));
vi.mock("@/components/MfaHelpModal", () => ({ MfaHelpModal: () => null }));
vi.mock("@/components/MfaBackupCodes", () => ({ MfaBackupCodes: () => <div data-testid="backup-codes" /> }));

const ENROLL = { factorId: "f1", qrCode: "data:image/svg+xml;base64,AAA", secret: "JBSWY3DPEHPK3PXP" };

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/mfa/setup"]}>
      <Routes>
        <Route path="/mfa/setup" element={<MfaSetupPage />} />
        <Route path="/inicio" element={<div data-testid="inicio" />} />
        <Route path="/" element={<div data-testid="landing" />} />
      </Routes>
    </MemoryRouter>
  );
}

async function irAoPasso(n: 3 | 4) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /Já tenho o app instalado/ }));
  await user.click(screen.getByRole("button", { name: /Estou com o app pronto/ }));
  if (n === 4) {
    await user.click(await screen.findByRole("button", { name: /Escanei o QR Code/ }));
  }
  return user;
}

function digitar(code: string) {
  const inputs = screen.getAllByRole("textbox");
  code.split("").forEach((d, i) => fireEvent.change(inputs[i], { target: { value: d } }));
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  h.listFactors.mockResolvedValue({ data: { totp: [] } });
  h.resetAllFactors.mockResolvedValue(undefined);
  h.enrollTotp.mockResolvedValue(ENROLL);
  h.verifyTotp.mockResolvedValue(undefined);
  h.refreshMfaLevel.mockResolvedValue(undefined);
  h.signOut.mockResolvedValue(undefined);
});

describe("MfaSetupPage", () => {
  it("quem já tem 2FA verificado é mandado ao início sem recriar fator", async () => {
    h.listFactors.mockResolvedValue({ data: { totp: [{ id: "x", status: "verified" }] } });
    renderPage();
    expect(await screen.findByTestId("inicio")).toBeInTheDocument();
    expect(h.resetAllFactors).not.toHaveBeenCalled();
    expect(h.enrollTotp).not.toHaveBeenCalled();
  });

  it("mostra QR e chave manual no passo 3", async () => {
    renderPage();
    await irAoPasso(3);
    expect(await screen.findByAltText("QR Code MFA")).toHaveAttribute("src", ENROLL.qrCode);
    expect(screen.getByText(ENROLL.secret)).toBeInTheDocument();
    expect(h.resetAllFactors).toHaveBeenCalledBefore(h.enrollTotp);
  });

  it("falha ao gerar o QR mostra erro traduzido e permite tentar de novo", async () => {
    h.enrollTotp.mockRejectedValueOnce(new Error("A factor with the friendly name Authenticator already exists"));
    renderPage();
    const user = await irAoPasso(3);
    expect(await screen.findByText("Autenticador já cadastrado. Aguarde enquanto reiniciamos.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Tentar novamente/ }));
    expect(await screen.findByAltText("QR Code MFA")).toBeInTheDocument();
    expect(h.enrollTotp).toHaveBeenCalledTimes(2);
  });

  it("recarregar a página não reaproveita segredo salvo: limpa o fator pendente e gera um novo", async () => {
    // Sobra de uma versão antiga, que guardava o segredo no sessionStorage.
    sessionStorage.setItem("mfa_setup_enrollment", JSON.stringify({ ...ENROLL, secret: "SEGREDOANTIGO" }));
    // Fator TOTP não verificado deixado pelo setup interrompido.
    h.listFactors.mockResolvedValue({ data: { totp: [{ id: "f-velho", status: "unverified" }] } });
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    renderPage();
    await irAoPasso(3);
    expect(await screen.findByText(ENROLL.secret)).toBeInTheDocument();
    expect(screen.queryByText("SEGREDOANTIGO")).not.toBeInTheDocument();
    expect(h.resetAllFactors).toHaveBeenCalledBefore(h.enrollTotp);
    expect(h.enrollTotp).toHaveBeenCalledOnce();
    expect(sessionStorage.getItem("mfa_setup_enrollment")).toBeNull();
    expect(setItem).not.toHaveBeenCalled();
    expect(JSON.stringify({ ...sessionStorage })).not.toContain(ENROLL.secret);
    setItem.mockRestore();
  });

  it("código errado avisa, limpa os dígitos e permite nova tentativa", async () => {
    h.verifyTotp.mockRejectedValueOnce(new Error("Invalid TOTP code entered"));
    renderPage();
    await irAoPasso(4);
    digitar("000000");
    await waitFor(() =>
      expect(h.toastError).toHaveBeenCalledWith("Código inválido", {
        description: "Código incorreto. Tente novamente.",
      })
    );
    await waitFor(() => screen.getAllByRole("textbox").forEach((i) => expect(i).toHaveValue("")));
    expect(screen.queryByTestId("backup-codes")).not.toBeInTheDocument();
    digitar("123456");
    expect(await screen.findByTestId("backup-codes")).toBeInTheDocument();
    expect(h.verifyTotp).toHaveBeenCalledTimes(2);
  });

  it("botão Confirmar fica desabilitado com menos de 6 dígitos", async () => {
    renderPage();
    await irAoPasso(4);
    digitar("123");
    expect(screen.getByRole("button", { name: /Confirmar e acessar/ })).toBeDisabled();
    expect(h.verifyTotp).not.toHaveBeenCalled();
  });

  it("código certo leva aos códigos de recuperação antes de liberar o app", async () => {
    renderPage();
    const user = await irAoPasso(4);
    digitar("123456");
    expect(await screen.findByTestId("backup-codes")).toBeInTheDocument();
    expect(h.verifyTotp).toHaveBeenCalledWith("f1", "123456");
    expect(h.refreshMfaLevel).toHaveBeenCalled();
    expect(sessionStorage.getItem("mfa_setup_enrollment")).toBeNull();
    expect(screen.queryByTestId("inicio")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Já salvei/ }));
    expect(await screen.findByTestId("inicio")).toBeInTheDocument();
  });

  it("colar o código preenche os 6 dígitos (só números)", async () => {
    renderPage();
    await irAoPasso(4);
    fireEvent.paste(screen.getAllByRole("textbox")[0], { clipboardData: { getData: () => "12a3 456" } });
    await waitFor(() => expect(h.verifyTotp).toHaveBeenCalledWith("f1", "123456"));
  });

  it("Sair encerra a sessão", async () => {
    renderPage();
    await userEvent.setup().click(screen.getByRole("button", { name: "Sair" }));
    expect(await screen.findByTestId("landing")).toBeInTheDocument();
    expect(h.signOut).toHaveBeenCalled();
  });
  it("teclado no código: Backspace apaga e volta, setas navegam", async () => {
    renderPage();
    await irAoPasso(4);
    const inputs = () => screen.getAllByRole("textbox") as HTMLInputElement[];
    digitar("12");
    expect(inputs()[1]).toHaveValue("2");
    // Backspace com dígito: apaga no lugar.
    fireEvent.keyDown(inputs()[1], { key: "Backspace" });
    expect(inputs()[1]).toHaveValue("");
    // Backspace em campo vazio: apaga o anterior e volta o foco.
    fireEvent.keyDown(inputs()[1], { key: "Backspace" });
    expect(inputs()[0]).toHaveValue("");
    expect(document.activeElement).toBe(inputs()[0]);
    // No primeiro campo vazio não faz nada.
    fireEvent.keyDown(inputs()[0], { key: "Backspace" });
    fireEvent.keyDown(inputs()[0], { key: "ArrowRight" });
    expect(document.activeElement).toBe(inputs()[1]);
    fireEvent.keyDown(inputs()[1], { key: "ArrowLeft" });
    expect(document.activeElement).toBe(inputs()[0]);
    fireEvent.keyDown(inputs()[0], { key: "ArrowLeft" });
    fireEvent.keyDown(inputs()[5], { key: "ArrowRight" });
    expect(h.verifyTotp).not.toHaveBeenCalled();
  });

  it("copiar a chave manual confirma e volta ao ícone; falha avisa", async () => {
    const writeText = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("negado"));
    // O userEvent troca o clipboard pelo dele: o stub entra depois e o clique vai por fireEvent.
    renderPage();
    await irAoPasso(3);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    fireEvent.click(await screen.findByRole("button", { name: "Copiar chave" }));
    expect(writeText).toHaveBeenCalledWith(ENROLL.secret);
    expect(await screen.findByRole("button", { name: "Copiado" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Copiar chave" })).toBeInTheDocument(), {
      timeout: 3000,
    });
    fireEvent.click(screen.getByRole("button", { name: "Copiar chave" }));
    await waitFor(() => expect(h.toastError).toHaveBeenCalledWith("Não foi possível copiar"));
  });

  it("voltar entre os passos", async () => {
    renderPage();
    const user = await irAoPasso(4);
    await user.click(screen.getByRole("button", { name: /Voltar para o QR Code/ }));
    await user.click(await screen.findByRole("button", { name: "← Voltar" }));
    expect(screen.getByRole("button", { name: /Estou com o app pronto/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "← Voltar" }));
    expect(screen.getByRole("button", { name: /Já tenho o app instalado/ })).toBeInTheDocument();
  });
});
