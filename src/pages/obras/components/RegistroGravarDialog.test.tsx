import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RegistroGravarDialog } from "./RegistroGravarDialog";

const mutateAsync = vi.fn();
vi.mock("@/pages/obras/hooks/useObraRegistros", () => ({
  useCriarRegistro: () => ({ mutateAsync, isPending: false }),
}));
vi.mock("@/hooks/useGravadorAudio", () => ({
  LIMITE_GRAVACAO_S: 180,
  useGravadorAudio: () => ({
    estado: "ocioso",
    segundos: 0,
    niveis: new Array(19).fill(0.1),
    erro: null,
    avisoLimite: false,
    iniciar: vi.fn(),
    parar: vi.fn(),
    cancelar: vi.fn(),
  }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() } }));

const abrir = (onOpenChange = vi.fn()) => {
  render(<RegistroGravarDialog open onOpenChange={onOpenChange} obraId="obra-1" />);
  return onOpenChange;
};

describe("RegistroGravarDialog", () => {
  beforeEach(() => mutateAsync.mockReset());

  it("começa no modo voz e só envia com algum conteúdo", () => {
    abrir();
    expect(screen.getByRole("button", { name: /Começar a gravar/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar registro" })).toBeDisabled();
  });

  it("registro de texto envia obra, data e texto e fecha", async () => {
    mutateAsync.mockResolvedValue(undefined);
    const onOpenChange = abrir();
    fireEvent.click(screen.getByRole("button", { name: "Texto" }));
    fireEvent.change(screen.getByLabelText("Texto do registro"), { target: { value: "  Laje concretada  " } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar registro" }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledOnce());
    const enviado = mutateAsync.mock.calls[0][0];
    expect(enviado.texto).toBe("Laje concretada");
    expect(enviado.fotos).toEqual([]);
    expect(enviado.audio).toBeUndefined();
    expect(enviado.data).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(enviado.clientId).toMatch(/^[0-9a-f-]{36}$/);
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("erro de envio fica na tela com o próximo passo e o texto continua lá", async () => {
    mutateAsync.mockRejectedValueOnce(new Error("Sem conexão com o servidor"));
    abrir();
    fireEvent.click(screen.getByRole("button", { name: "Texto" }));
    fireEvent.change(screen.getByLabelText("Texto do registro"), { target: { value: "Chuva à tarde" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar registro" }));

    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent("Sem conexão com o servidor. Toque em Enviar registro para tentar de novo.");
    expect(screen.getByLabelText("Texto do registro")).toHaveValue("Chuva à tarde");
  });

  it("reenvio depois do erro usa o mesmo client_id, então a edge não duplica", async () => {
    mutateAsync.mockRejectedValueOnce(new Error("falhou")).mockResolvedValueOnce(undefined);
    abrir();
    fireEvent.click(screen.getByRole("button", { name: "Texto" }));
    fireEvent.change(screen.getByLabelText("Texto do registro"), { target: { value: "Cimento acabou" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar registro" }));
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Enviar registro" }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(2));
    expect(mutateAsync.mock.calls[1][0].clientId).toBe(mutateAsync.mock.calls[0][0].clientId);
  });
});
