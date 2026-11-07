import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MfaBackupCodes } from "./MfaBackupCodes";

const h = vi.hoisted(() => ({
  rpc: vi.fn(),
  capture: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/lib/supabaseRpc", () => ({ callUntypedRpc: h.rpc }));
vi.mock("@/lib/monitoring", () => ({ monitoring: { captureException: h.capture } }));
vi.mock("sonner", () => ({ toast: { error: h.toastError, success: h.toastSuccess } }));

const CODES = ["aaaa-1111", "bbbb-2222", "cccc-3333"];

function mockRpc(remaining: { data: unknown; error: unknown }, generate?: { data: unknown; error: unknown }) {
  h.rpc.mockImplementation(async (fn: string) => {
    if (fn === "mfa_backup_codes_remaining") return remaining;
    return generate ?? { data: CODES, error: null };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("MfaBackupCodes", () => {
  it("mostra a contagem restante no plural e no singular", async () => {
    mockRpc({ data: 5, error: null });
    const { unmount } = render(<MfaBackupCodes />);
    expect(await screen.findByText("5 códigos restantes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Gerar novos/ })).toBeInTheDocument();
    unmount();

    mockRpc({ data: 1, error: null });
    render(<MfaBackupCodes />);
    expect(await screen.findByText("1 código restante")).toBeInTheDocument();
  });

  it("erro na contagem cai em zero sem gerar sozinho", async () => {
    mockRpc({ data: null, error: { message: "x" } });
    render(<MfaBackupCodes />);
    expect(await screen.findByText("0 códigos restantes")).toBeInTheDocument();
    expect(h.rpc).toHaveBeenCalledTimes(1);
  });

  it("sem códigos: gera direto, sem confirmação, e copia", async () => {
    mockRpc({ data: 0, error: null });
    const user = userEvent.setup();
    render(<MfaBackupCodes />);
    expect(await screen.findByText("Nenhum disponível")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Gerar códigos/ }));
    expect(await screen.findByText("Salve estes códigos agora")).toBeInTheDocument();
    expect(screen.getByText("bbbb-2222")).toBeInTheDocument();
    expect(h.toastSuccess).toHaveBeenCalledWith("Códigos gerados");

    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await user.click(screen.getByRole("button", { name: /Copiar todos/ }));
    expect(writeText).toHaveBeenCalledWith(CODES.join("\n"));
    expect(await screen.findByRole("button", { name: /Copiado/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Fechar" }));
    expect(await screen.findByText("3 códigos restantes")).toBeInTheDocument();
  });

  it("falha ao copiar é avisada", async () => {
    mockRpc({ data: 0, error: null });
    const user = userEvent.setup();
    render(<MfaBackupCodes />);
    await user.click(await screen.findByRole("button", { name: /Gerar códigos/ }));
    await screen.findByText("Salve estes códigos agora");
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockRejectedValue(new Error("negado")) },
      configurable: true,
    });
    await user.click(screen.getByRole("button", { name: /Copiar todos/ }));
    await waitFor(() => expect(h.toastError).toHaveBeenCalledWith("Falha ao copiar"));
  });

  it("com códigos restantes, gerar novos pede confirmação", async () => {
    mockRpc({ data: 4, error: null });
    const user = userEvent.setup();
    render(<MfaBackupCodes />);
    await user.click(await screen.findByRole("button", { name: /Gerar novos/ }));
    expect(await screen.findByText("Gerar novos códigos?")).toBeInTheDocument();
    expect(h.rpc).toHaveBeenCalledTimes(1);
    const botoes = screen.getAllByRole("button", { name: "Gerar novos" });
    await user.click(botoes[botoes.length - 1]);
    expect(await screen.findByText("Salve estes códigos agora")).toBeInTheDocument();
  });

  it("erro ao gerar reporta ao monitoring e avisa", async () => {
    mockRpc({ data: 0, error: null }, { data: null, error: new Error("aal2 required") });
    const user = userEvent.setup();
    render(<MfaBackupCodes />);
    await user.click(await screen.findByRole("button", { name: /Gerar códigos/ }));
    await waitFor(() => expect(h.toastError).toHaveBeenCalledWith("Erro ao gerar", expect.any(Object)));
    expect(h.capture).toHaveBeenCalledWith(expect.any(Error), { context: "generateBackupCodes" });
  });

  it("autoGenerate gera sozinho quando não há códigos", async () => {
    mockRpc({ data: 0, error: null });
    render(<MfaBackupCodes autoGenerate />);
    expect(await screen.findByText("Salve estes códigos agora")).toBeInTheDocument();
    expect(h.toastSuccess).not.toHaveBeenCalled();
  });

  it("autoGenerate com resposta vazia não quebra", async () => {
    mockRpc({ data: 0, error: null }, { data: null, error: null });
    render(<MfaBackupCodes autoGenerate />);
    expect(await screen.findByText("Salve estes códigos agora")).toBeInTheDocument();
  });

  it("autoGenerate não gera quando ainda há códigos", async () => {
    mockRpc({ data: 2, error: null });
    render(<MfaBackupCodes autoGenerate />);
    expect(await screen.findByText("2 códigos restantes")).toBeInTheDocument();
    expect(h.rpc).toHaveBeenCalledTimes(1);
  });

  it("autoGenerate com erro reporta", async () => {
    mockRpc({ data: 0, error: null }, { data: null, error: new Error("falhou") });
    render(<MfaBackupCodes autoGenerate />);
    await waitFor(() => expect(h.capture).toHaveBeenCalled());
    expect(await screen.findByText("Nenhum disponível")).toBeInTheDocument();
  });

  it("desmontar antes da resposta não atualiza estado", async () => {
    let resolver: (v: unknown) => void = () => {};
    h.rpc.mockImplementation(() => new Promise((r) => (resolver = r)));
    const { unmount } = render(<MfaBackupCodes autoGenerate />);
    unmount();
    resolver({ data: 0, error: null });
    await Promise.resolve();
    expect(h.rpc).toHaveBeenCalledTimes(1);
  });
});
