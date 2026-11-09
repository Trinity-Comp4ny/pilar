import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ArquivosDoRegistro } from "./ArquivosDoRegistro";

const buscar = vi.fn();
vi.mock("./buscarArquivosDoRegistro", () => ({ buscarArquivosDoRegistro: (id: string) => buscar(id) }));

const montar = (p: Partial<Parameters<typeof ArquivosDoRegistro>[0]> = {}) =>
  render(<ArquivosDoRegistro registroId="r1" temAudio duracaoS={42} fotos={2} {...p} />);

describe("ArquivosDoRegistro", () => {
  beforeEach(() => buscar.mockReset());

  it("não busca nada até a pessoa tocar", () => {
    montar();
    expect(buscar).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Ouvir (0:42)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver as 2 fotos" })).toBeInTheDocument();
  });

  it("Ouvir busca as URLs e toca o áudio", async () => {
    buscar.mockResolvedValue({ audioUrl: "https://x/a.webm", fotos: [] });
    montar({ fotos: 0 });
    fireEvent.click(screen.getByRole("button", { name: "Ouvir (0:42)" }));
    const audio = await screen.findByLabelText("Seu áudio");
    expect(audio).toHaveAttribute("src", "https://x/a.webm");
    expect(buscar).toHaveBeenCalledWith("r1");
  });

  it("Ver fotos mostra as imagens e reaproveita a busca ao abrir o áudio", async () => {
    buscar.mockResolvedValue({ audioUrl: "https://x/a.webm", fotos: ["https://x/1.jpg", "https://x/2.jpg"] });
    montar();
    fireEvent.click(screen.getByRole("button", { name: "Ver as 2 fotos" }));
    await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(2));
    fireEvent.click(screen.getByRole("button", { name: "Ouvir (0:42)" }));
    await screen.findByLabelText("Seu áudio");
    expect(buscar).toHaveBeenCalledTimes(1);
  });

  it("tocar de novo fecha", async () => {
    buscar.mockResolvedValue({ audioUrl: null, fotos: ["https://x/1.jpg"] });
    montar({ temAudio: false, fotos: 1 });
    fireEvent.click(screen.getByRole("button", { name: "Ver a foto" }));
    await screen.findByRole("img");
    fireEvent.click(screen.getByRole("button", { name: "Fechar fotos" }));
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("erro mostra o que fazer e deixa tentar de novo", async () => {
    buscar.mockRejectedValueOnce(new Error("Não deu para abrir agora. Confira o sinal e tente de novo."));
    montar({ fotos: 0 });
    fireEvent.click(screen.getByRole("button", { name: "Ouvir (0:42)" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Confira o sinal");
    buscar.mockResolvedValueOnce({ audioUrl: "https://x/a.webm", fotos: [] });
    fireEvent.click(screen.getByRole("button", { name: "Ouvir (0:42)" }));
    await screen.findByLabelText("Seu áudio");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("áudio já apagado pela retenção avisa em vez de tocar", async () => {
    buscar.mockResolvedValue({ audioUrl: null, fotos: [] });
    montar({ fotos: 0 });
    fireEvent.click(screen.getByRole("button", { name: "Ouvir (0:42)" }));
    expect(await screen.findByText("O áudio deste registro já não está guardado.")).toBeInTheDocument();
  });
});
