import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Voz e foto do registro pelo escritório: gravação curta descartada, áudio pronto
// com regravar, estado gravando (parar, aviso de limite, erro do microfone),
// fotos comprimidas com limite de 6 e falha de leitura.

type Pronta = { blob: Blob; mimeType: string; duracaoS: number };
const g = vi.hoisted(() => ({
  onPronta: null as null | ((p: Pronta) => void),
  estado: "ocioso",
  segundos: 0,
  erro: null as string | null,
  avisoLimite: false,
  iniciar: vi.fn(),
  parar: vi.fn(),
  cancelar: vi.fn(),
}));
const mutateAsync = vi.hoisted(() => vi.fn());
const comprimir = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => ({ success: vi.fn(), info: vi.fn(), error: vi.fn() }));

vi.mock("@/pages/obras/hooks/useObraRegistros", () => ({
  useCriarRegistro: () => ({ mutateAsync, isPending: false }),
}));
vi.mock("@/hooks/useGravadorAudio", () => ({
  LIMITE_GRAVACAO_S: 180,
  useGravadorAudio: (o: { onPronta: (p: Pronta) => void }) => {
    g.onPronta = o.onPronta;
    return { ...g, niveis: [0.2, 0.5] };
  },
}));
vi.mock("@/lib/comprimirFoto", () => ({ comprimirFoto: (f: File) => comprimir(f) }));
vi.mock("sonner", () => ({ toast }));

let urls = 0;
globalThis.URL.createObjectURL = () => `blob:u${++urls}`;
globalThis.URL.revokeObjectURL = vi.fn();

import { RegistroGravarDialog } from "./RegistroGravarDialog";

function abrir(onEnviado = vi.fn()) {
  const onOpenChange = vi.fn();
  const r = render(<RegistroGravarDialog open onOpenChange={onOpenChange} obraId="obra-1" onEnviado={onEnviado} />);
  return { onOpenChange, onEnviado, ...r };
}
const audio = (duracaoS: number): Pronta => ({ blob: new Blob(["a"]), mimeType: "audio/webm", duracaoS });

function anexar(arquivos: File[]) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  Object.defineProperty(input, "files", { value: arquivos, configurable: true });
  fireEvent.change(input);
}

beforeEach(() => {
  vi.clearAllMocks();
  g.estado = "ocioso";
  g.segundos = 0;
  g.erro = null;
  g.avisoLimite = false;
  comprimir.mockImplementation(async (f: File) => new Blob([f.name]));
  mutateAsync.mockResolvedValue(undefined);
});

describe("RegistroGravarDialog: voz", () => {
  it("começar a gravar chama o gravador; pedindo permissão trava o botão", () => {
    const { rerender } = abrir();
    fireEvent.click(screen.getByRole("button", { name: /Começar a gravar/ }));
    expect(g.iniciar).toHaveBeenCalled();
    g.estado = "pedindo";
    rerender(<RegistroGravarDialog open onOpenChange={vi.fn()} obraId="obra-1" />);
    expect(screen.getByRole("button", { name: /Começar a gravar/ })).toBeDisabled();
  });

  it("gravando: mostra tempo, para e avisa perto do limite; envio travado", () => {
    g.estado = "gravando";
    g.segundos = 65;
    const { rerender } = abrir();
    expect(screen.getByText("Toque para parar")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Parar a gravação" }));
    expect(g.parar).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Enviar registro" })).toBeDisabled();
    g.avisoLimite = true;
    rerender(<RegistroGravarDialog open onOpenChange={vi.fn()} obraId="obra-1" />);
    expect(screen.getByText(/Quase no limite de/)).toBeInTheDocument();
  });

  it("erro do microfone aparece na área de voz", () => {
    g.erro = "Permita o uso do microfone";
    abrir();
    expect(screen.getByText("Permita o uso do microfone")).toBeInTheDocument();
  });

  it("gravação curta demais é descartada com aviso", () => {
    abrir();
    act(() => g.onPronta!(audio(1)));
    expect(toast.info).toHaveBeenCalledWith("Gravação muito curta", expect.anything());
    expect(screen.getByRole("button", { name: "Enviar registro" })).toBeDisabled();
  });

  it("áudio pronto: toca, regrava e envia junto com o texto escrito", async () => {
    const { onEnviado, onOpenChange } = abrir();
    act(() => g.onPronta!(audio(12)));
    expect(screen.getByText(/Áudio de/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Regravar/ }));
    expect(screen.getByRole("button", { name: /Começar a gravar/ })).toBeInTheDocument();

    act(() => g.onPronta!(audio(30)));
    fireEvent.click(screen.getByRole("button", { name: "Texto" }));
    fireEvent.change(screen.getByLabelText("Texto do registro"), { target: { value: "Detalhe" } });
    fireEvent.click(screen.getByRole("button", { name: "Voz" }));
    expect(screen.getByText("Também vai o texto que você escreveu.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Enviar registro" }));
    await waitFor(() => expect(onEnviado).toHaveBeenCalled());
    expect(mutateAsync.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        texto: "Detalhe",
        audio: { blob: expect.any(Blob), mimeType: "audio/webm", duracaoS: 30 },
      })
    );
    expect(toast.success).toHaveBeenCalledWith("Registro enviado", expect.anything());
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(g.cancelar).toHaveBeenCalled();
  });

  it("erro que não é Error mostra a mensagem de conexão", async () => {
    mutateAsync.mockRejectedValueOnce("x");
    abrir();
    act(() => g.onPronta!(audio(5)));
    fireEvent.click(screen.getByRole("button", { name: "Enviar registro" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Sem conexão com o servidor.");
  });
});

describe("RegistroGravarDialog: foto", () => {
  it("adiciona até 6 fotos comprimidas, remove uma e envia", async () => {
    abrir();
    fireEvent.click(screen.getByRole("button", { name: "Foto" }));
    expect(screen.getByRole("button", { name: /Escolher fotos/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Escolher fotos/ }));

    const arquivos = Array.from({ length: 7 }, (_, i) => new File(["x"], `f${i}.jpg`, { type: "image/jpeg" }));
    await act(async () => anexar(arquivos.slice(0, 4)));
    expect(screen.getAllByRole("img")).toHaveLength(4);
    expect(screen.getByRole("button", { name: "Adicionar foto (4 de 6)" })).toBeEnabled();
    await act(async () => anexar(arquivos.slice(4)));
    expect(comprimir).toHaveBeenCalledTimes(6);
    expect(screen.getByRole("button", { name: "Adicionar foto (6 de 6)" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Remover a foto 1" }));
    expect(screen.getAllByRole("img")).toHaveLength(5);
    expect(URL.revokeObjectURL).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Enviar registro" }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    expect(mutateAsync.mock.calls[0][0].fotos).toHaveLength(5);
  });

  it("foto ilegível avisa e não entra; lista vazia não faz nada", async () => {
    comprimir.mockRejectedValueOnce(new Error("heic"));
    abrir();
    fireEvent.click(screen.getByRole("button", { name: "Foto" }));
    await act(async () => anexar([new File(["x"], "a.heic"), new File(["y"], "b.jpg")]));
    expect(toast.error).toHaveBeenCalledWith("Não deu para ler uma das fotos", expect.anything());
    expect(screen.getAllByRole("img")).toHaveLength(1);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, "files", { value: null, configurable: true });
    await act(async () => fireEvent.change(input));
    expect(screen.getAllByRole("img")).toHaveLength(1);
  });

  it("fechar pelo Cancelar limpa fotos e volta ao modo voz", async () => {
    const { onOpenChange } = abrir();
    fireEvent.click(screen.getByRole("button", { name: "Foto" }));
    await act(async () => anexar([new File(["x"], "a.jpg")]));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(g.cancelar).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Começar a gravar/ })).toBeInTheDocument();
  });
});
