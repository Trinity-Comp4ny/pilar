import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import type { GravacaoPronta } from "@/hooks/useGravadorAudio";
import type { FilaRegistroItem } from "./campoRegistroFila";
import type { CampoAccount } from "./useCampoAuth";

// Gravar no Pilar Campo: aviso do áudio guardado na primeira vez, gravação curta sem foto
// não vira registro, o registro sai com as fotos tiradas e a tela nunca espera o envio.

const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), info: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const sync = vi.hoisted(() => ({ registrar: vi.fn() }));
vi.mock("./useCampoSync", () => ({ useCampoSync: () => sync }));

const fala = vi.hoisted(() => ({ texto: "" }));
vi.mock("./useFalaAoVivo", () => ({ useFalaAoVivo: () => ({ texto: fala.texto, suportada: true }) }));

const comprimir = vi.hoisted(() => ({ fn: vi.fn() }));
vi.mock("@/lib/comprimirFoto", () => ({ comprimirFoto: (f: File) => comprimir.fn(f) }));

type Estado = "ocioso" | "pedindo" | "gravando";
const grav = vi.hoisted(() => ({
  estado: "ocioso" as Estado,
  erro: null as string | null,
  avisoLimite: false,
  segundos: 0,
  onPronta: null as null | ((g: GravacaoPronta) => void),
  iniciar: vi.fn(),
  parar: vi.fn(),
  cancelar: vi.fn(),
}));
vi.mock("@/hooks/useGravadorAudio", () => ({
  LIMITE_GRAVACAO_S: 180,
  useGravadorAudio: ({ onPronta }: { onPronta: (g: GravacaoPronta) => void }) => {
    grav.onPronta = onPronta;
    return {
      estado: grav.estado,
      segundos: grav.segundos,
      niveis: [0.2, 0.5],
      erro: grav.erro,
      avisoLimite: grav.avisoLimite,
      iniciar: grav.iniciar,
      parar: grav.parar,
      cancelar: grav.cancelar,
    };
  },
}));

import CampoGravar from "./CampoGravar";

const conta: CampoAccount = {
  account_id: "acc-1",
  obra_id: "obra-1",
  empresa_id: "emp-1",
  nome: "Zé da Obra",
  must_change_senha: false,
};
const CHAVE_ACEITE = "pilar_campo_aceite_audio:acc-1";

function montar() {
  return render(
    <MemoryRouter initialEntries={["/campo/gravar"]}>
      <Routes>
        <Route element={<Outlet context={{ account: conta }} />}>
          <Route path="/campo/gravar" element={<CampoGravar />} />
          <Route path="/campo" element={<p>Home do campo</p>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

const gravacao = (duracaoS: number): GravacaoPronta => ({
  blob: new Blob(["a"], { type: "audio/webm" }),
  mimeType: "audio/webm",
  duracaoS,
});

function escolherFoto(nome = "f.jpg") {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [new File(["x"], nome, { type: "image/jpeg" })] } });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  grav.estado = "ocioso";
  grav.erro = null;
  grav.avisoLimite = false;
  grav.segundos = 0;
  grav.onPronta = null;
  fala.texto = "";
  sync.registrar.mockResolvedValue(undefined);
  comprimir.fn.mockImplementation(async () => new Blob(["jpg"], { type: "image/jpeg" }));
  let n = 0;
  URL.createObjectURL = vi.fn(() => `blob:preview-${++n}`);
  URL.revokeObjectURL = vi.fn();
});

describe("CampoGravar: aviso do áudio", () => {
  it("primeira vez mostra o aviso e não grava antes do aceite", () => {
    montar();
    expect(screen.getByText("O áudio fica guardado")).toBeInTheDocument();
    expect(grav.iniciar).not.toHaveBeenCalled();
  });

  it("aceitar guarda no aparelho e começa a gravar", async () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: "Entendi, gravar" }));
    await waitFor(() => expect(grav.iniciar).toHaveBeenCalledTimes(1));
    expect(localStorage.getItem(CHAVE_ACEITE)).toBe("1");
  });

  it("voltar no aviso devolve para a home sem gravar", async () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(await screen.findByText("Home do campo")).toBeInTheDocument();
    expect(grav.iniciar).not.toHaveBeenCalled();
  });

  it("aceite já dado começa a gravar ao abrir, uma vez só", () => {
    localStorage.setItem(CHAVE_ACEITE, "1");
    const { rerender } = montar();
    rerender(
      <MemoryRouter initialEntries={["/campo/gravar"]}>
        <Routes>
          <Route element={<Outlet context={{ account: conta }} />}>
            <Route path="/campo/gravar" element={<CampoGravar />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    expect(screen.queryByText("O áudio fica guardado")).not.toBeInTheDocument();
    expect(grav.iniciar).toHaveBeenCalledTimes(1);
  });

  it("localStorage indisponível: trata como não aceito e não quebra", () => {
    const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    montar();
    expect(screen.getByText("O áudio fica guardado")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Entendi, gravar" }));
    expect(grav.iniciar).toHaveBeenCalled();
    get.mockRestore();
    set.mockRestore();
  });
});

describe("CampoGravar: gravando", () => {
  beforeEach(() => localStorage.setItem(CHAVE_ACEITE, "1"));

  it("mostra estado e libera o botão de parar só gravando", () => {
    grav.estado = "pedindo";
    const { unmount } = montar();
    expect(screen.getByText("Abrindo o microfone")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Parar e enviar" })).toBeDisabled();
    unmount();

    grav.estado = "gravando";
    grav.segundos = 65;
    montar();
    expect(screen.getByText("Gravando")).toBeInTheDocument();
    expect(screen.getByText("1:05")).toBeInTheDocument();
    expect(screen.getByText(/Fale normalmente/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Parar e enviar" }));
    expect(grav.parar).toHaveBeenCalled();
  });

  it("mostra a fala ao vivo quando há texto reconhecido", () => {
    grav.estado = "gravando";
    fala.texto = "Concretamos a laje";
    montar();
    expect(screen.getByText("Concretamos a laje")).toBeInTheDocument();
  });

  it("perto do limite troca a dica pelo aviso", () => {
    grav.estado = "gravando";
    grav.avisoLimite = true;
    montar();
    expect(screen.getByRole("status")).toHaveTextContent("Falta pouco");
  });

  it("erro do microfone permite tentar de novo", () => {
    grav.erro = "Microfone bloqueado";
    montar();
    expect(screen.getByRole("alert")).toHaveTextContent("Microfone bloqueado");
    grav.iniciar.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(grav.iniciar).toHaveBeenCalledTimes(1);
  });

  it("cancelar descarta a gravação e volta", async () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar gravação" }));
    expect(grav.cancelar).toHaveBeenCalled();
    expect(await screen.findByText("Home do campo")).toBeInTheDocument();
  });
});

describe("CampoGravar: salvar", () => {
  beforeEach(() => localStorage.setItem(CHAVE_ACEITE, "1"));

  it("gravação curta sem foto não vira registro", async () => {
    montar();
    await act(async () => grav.onPronta!(gravacao(1)));
    expect(sync.registrar).not.toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalledWith("Gravação muito curta", expect.anything());
    expect(await screen.findByText("Home do campo")).toBeInTheDocument();
  });

  it("gravação válida vira registro com aceite de áudio e volta para a home", async () => {
    montar();
    await act(async () => grav.onPronta!(gravacao(12)));
    expect(sync.registrar).toHaveBeenCalledTimes(1);
    const item = sync.registrar.mock.calls[0][0] as FilaRegistroItem;
    expect(item.aceiteAudio).toBe(true);
    expect(item.audio).toMatchObject({ mimeType: "audio/webm", duracaoS: 12 });
    expect(item.fotos).toEqual([]);
    expect(item.data).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(toast.success).toHaveBeenCalledWith("Registro salvo", expect.anything());
    expect(await screen.findByText("Home do campo")).toBeInTheDocument();
  });

  it("gravação curta com foto ainda é salva (a foto é o registro)", async () => {
    montar();
    escolherFoto();
    expect(await screen.findByAltText("Foto 1 deste registro")).toBeInTheDocument();
    await act(async () => grav.onPronta!(gravacao(1)));
    const item = sync.registrar.mock.calls[0][0] as FilaRegistroItem;
    expect(item.fotos).toHaveLength(1);
    expect(item.fotos[0].contentType).toBe("image/jpeg");
  });

  it("remover foto revoga o preview e tira do registro", async () => {
    montar();
    escolherFoto("a.jpg");
    await screen.findByAltText("Foto 1 deste registro");
    escolherFoto("b.jpg");
    await screen.findByAltText("Foto 2 deste registro");
    fireEvent.click(screen.getByRole("button", { name: "Remover foto 1" }));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview-1");
    expect(screen.queryByAltText("Foto 2 deste registro")).not.toBeInTheDocument();
    await act(async () => grav.onPronta!(gravacao(10)));
    expect((sync.registrar.mock.calls[0][0] as FilaRegistroItem).fotos).toHaveLength(1);
  });

  it("foto que não comprime avisa e não entra no registro", async () => {
    comprimir.fn.mockRejectedValueOnce(new Error("heic"));
    montar();
    escolherFoto();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Não deu para usar essa foto", expect.anything()));
    expect(screen.queryByAltText("Foto 1 deste registro")).not.toBeInTheDocument();
  });

  it("input sem arquivo é ignorado", () => {
    montar();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [] } });
    expect(comprimir.fn).not.toHaveBeenCalled();
  });

  it("com 6 fotos o botão de câmera trava", async () => {
    montar();
    for (let i = 1; i <= 6; i++) {
      escolherFoto(`f${i}.jpg`);
      await screen.findByAltText(`Foto ${i} deste registro`);
    }
    expect(screen.getByRole("button", { name: "Tirar uma foto para este registro" })).toBeDisabled();
  });

  it("ao sair da tela revoga os previews das fotos", async () => {
    const { unmount } = montar();
    escolherFoto();
    await screen.findByAltText("Foto 1 deste registro");
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview-1");
  });
});
