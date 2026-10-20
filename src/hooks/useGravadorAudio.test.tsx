import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AVISO_LIMITE_S,
  LIMITE_GRAVACAO_S,
  escolherMimeAudio,
  mensagemDoMicrofone,
  useGravadorAudio,
  type DepsGravador,
} from "./useGravadorAudio";

/** MediaRecorder falso: `stop()` dispara `onstop` como o real, depois de entregar um pedaço. */
class RecorderFalso {
  state: "inactive" | "recording" = "inactive";
  mimeType = "audio/webm";
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  start() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["abc"], { type: this.mimeType }) });
    this.onstop?.();
  }
}

function montarDeps(sobre: Partial<DepsGravador> = {}) {
  const trilhas = { parou: 0 };
  const stream = { getTracks: () => [{ stop: () => trilhas.parou++ }] } as unknown as MediaStream;
  let relogio = 1_000_000;
  const recorder = new RecorderFalso();
  const deps: DepsGravador = {
    getUserMedia: () => Promise.resolve(stream),
    criarRecorder: () => recorder as unknown as MediaRecorder,
    mimeSuportado: (m) => m === "audio/webm",
    agora: () => relogio,
    ...sobre,
  };
  return { deps, recorder, trilhas, avancar: (ms: number) => (relogio += ms) };
}

describe("escolherMimeAudio", () => {
  it("pega o primeiro formato suportado e devolve vazio se nenhum", () => {
    expect(escolherMimeAudio((m) => m === "audio/mp4")).toBe("audio/mp4");
    expect(escolherMimeAudio((m) => m.startsWith("audio/webm"))).toBe("audio/webm;codecs=opus");
    expect(escolherMimeAudio(() => false)).toBe("");
  });
});

describe("mensagemDoMicrofone", () => {
  it("diz o que houve e o que fazer", () => {
    expect(mensagemDoMicrofone({ name: "NotAllowedError" })).toMatch(/Libere o microfone/);
    expect(mensagemDoMicrofone({ name: "NotFoundError" })).toMatch(/não tem microfone/);
    expect(mensagemDoMicrofone(new Error("x"))).toMatch(/Tente de novo/);
  });
});

describe("useGravadorAudio", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("grava, conta o tempo e entrega o áudio ao parar, soltando o microfone", async () => {
    const { deps, trilhas, avancar } = montarDeps();
    const onPronta = vi.fn();
    const { result } = renderHook(() => useGravadorAudio({ onPronta, deps }));

    await act(async () => {
      await result.current.iniciar();
    });
    expect(result.current.estado).toBe("gravando");

    await act(async () => {
      avancar(48_000);
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.segundos).toBe(3);

    act(() => result.current.parar());
    expect(onPronta).toHaveBeenCalledTimes(1);
    const g = onPronta.mock.calls[0][0];
    expect(g.duracaoS).toBe(48);
    expect(g.mimeType).toBe("audio/webm");
    expect(g.blob.size).toBeGreaterThan(0);
    expect(trilhas.parou).toBeGreaterThan(0);
    expect(result.current.estado).toBe("ocioso");
  });

  it("corta sozinho no limite de 3 minutos e avisa antes", async () => {
    const { deps, avancar } = montarDeps();
    const onPronta = vi.fn();
    const { result } = renderHook(() => useGravadorAudio({ onPronta, deps }));
    await act(async () => {
      await result.current.iniciar();
    });
    await act(async () => {
      avancar(AVISO_LIMITE_S * 1000);
      vi.advanceTimersByTime(AVISO_LIMITE_S * 1000);
    });
    expect(result.current.avisoLimite).toBe(true);
    expect(onPronta).not.toHaveBeenCalled();

    await act(async () => {
      avancar((LIMITE_GRAVACAO_S - AVISO_LIMITE_S) * 1000 + 4000);
      vi.advanceTimersByTime((LIMITE_GRAVACAO_S - AVISO_LIMITE_S) * 1000);
    });
    expect(onPronta).toHaveBeenCalledTimes(1);
    expect(onPronta.mock.calls[0][0].duracaoS).toBe(LIMITE_GRAVACAO_S);
  });

  it("cancelar descarta o áudio e solta o microfone", async () => {
    const { deps, trilhas } = montarDeps();
    const onPronta = vi.fn();
    const { result } = renderHook(() => useGravadorAudio({ onPronta, deps }));
    await act(async () => {
      await result.current.iniciar();
    });
    act(() => result.current.cancelar());
    expect(onPronta).not.toHaveBeenCalled();
    expect(trilhas.parou).toBeGreaterThan(0);
    expect(result.current.estado).toBe("ocioso");
  });

  it("microfone negado vira mensagem e volta ao ocioso", async () => {
    const { deps } = montarDeps({ getUserMedia: () => Promise.reject({ name: "NotAllowedError" }) });
    const { result } = renderHook(() => useGravadorAudio({ onPronta: vi.fn(), deps }));
    await act(async () => {
      await result.current.iniciar();
    });
    expect(result.current.estado).toBe("ocioso");
    expect(result.current.erro).toMatch(/Libere o microfone/);
  });

  it("sair da tela no meio da gravação descarta e solta o microfone", async () => {
    const { deps, trilhas } = montarDeps();
    const onPronta = vi.fn();
    const { result, unmount } = renderHook(() => useGravadorAudio({ onPronta, deps }));
    await act(async () => {
      await result.current.iniciar();
    });
    unmount();
    expect(onPronta).not.toHaveBeenCalled();
    expect(trilhas.parou).toBeGreaterThan(0);
  });
});
