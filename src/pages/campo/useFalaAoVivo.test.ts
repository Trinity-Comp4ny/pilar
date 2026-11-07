import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { falaAoVivoSuportada, montarTextoDaFala, useFalaAoVivo } from "./useFalaAoVivo";

const comFala = { webkitSpeechRecognition: class {} } as unknown as Window;
const semFala = {} as unknown as Window;

describe("falaAoVivoSuportada", () => {
  it("liga quando o navegador tem reconhecimento de fala", () => {
    expect(falaAoVivoSuportada(comFala, "Mozilla/5.0 (Linux; Android 14) Chrome/130")).toBe(true);
  });

  it("fica desligada sem a API", () => {
    expect(falaAoVivoSuportada(semFala, "Mozilla/5.0 Chrome/130")).toBe(false);
  });

  it("fica desligada no iPhone e no iPad, para não calar a gravação", () => {
    expect(falaAoVivoSuportada(comFala, "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe(false);
    expect(falaAoVivoSuportada(comFala, "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)")).toBe(false);
  });
});

describe("montarTextoDaFala", () => {
  it("junta resultados finais e o parcial", () => {
    const r = [
      { isFinal: true, 0: { transcript: "chegou o pessoal da elétrica " } },
      { isFinal: false, 0: { transcript: "cinco deles" } },
    ];
    expect(montarTextoDaFala(r)).toBe("chegou o pessoal da elétrica cinco deles");
  });

  it("sem resultado devolve vazio", () => {
    expect(montarTextoDaFala([])).toBe("");
  });
});

describe("useFalaAoVivo", () => {
  type Rec = {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    onresult: ((e: { resultIndex: number; results: { isFinal: boolean; 0: { transcript: string } }[] }) => void) | null;
    onend: (() => void) | null;
    onerror: (() => void) | null;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
  };
  let instancias: Rec[] = [];
  let falharAoCriar = false;
  let falharAoParar = false;

  class ReconhecimentoFalso {
    lang = "";
    continuous = false;
    interimResults = false;
    onresult = null;
    onend = null;
    onerror = null;
    start = vi.fn();
    stop = vi.fn(() => {
      if (falharAoParar) throw new Error("já parado");
    });
    constructor() {
      if (falharAoCriar) throw new Error("sem microfone");
      instancias.push(this as unknown as Rec);
    }
  }

  const fala = (rec: Rec, ...partes: string[]) =>
    act(() => {
      rec.onresult?.({ resultIndex: 0, results: partes.map((t) => ({ isFinal: true, 0: { transcript: t } })) });
    });

  beforeEach(() => {
    instancias = [];
    falharAoCriar = false;
    falharAoParar = false;
    vi.stubGlobal("webkitSpeechRecognition", ReconhecimentoFalso);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("inativo não liga o reconhecimento", () => {
    const { result } = renderHook(() => useFalaAoVivo(false));
    expect(result.current).toEqual({ texto: "", suportada: true });
    expect(instancias).toHaveLength(0);
  });

  it("sem a API não é suportada e não faz nada", () => {
    vi.unstubAllGlobals();
    const { result } = renderHook(() => useFalaAoVivo(true));
    expect(result.current.suportada).toBe(false);
  });

  it("mostra o texto ao vivo, reinicia após silêncio acumulando e limpa ao parar", () => {
    const { result, rerender } = renderHook(({ ativo }) => useFalaAoVivo(ativo), { initialProps: { ativo: true } });
    const [primeira] = instancias;
    expect(primeira).toMatchObject({ lang: "pt-BR", continuous: true, interimResults: true });
    expect(primeira.start).toHaveBeenCalled();
    primeira.onerror?.();

    fala(primeira, "chegou o pessoal ", "da elétrica");
    expect(result.current.texto).toBe("chegou o pessoal da elétrica");

    // Silêncio: o navegador encerra e o hook abre outra sessão, guardando o anterior.
    act(() => primeira.onend?.());
    expect(instancias).toHaveLength(2);
    fala(instancias[1], "cinco deles");
    expect(result.current.texto).toBe("chegou o pessoal da elétrica cinco deles");

    rerender({ ativo: false });
    expect(instancias[1].stop).toHaveBeenCalled();
    expect(instancias[1].onend).toBeNull();
    expect(result.current.texto).toBe("");
  });

  it("falha ao criar o reconhecimento só desliga a prévia", () => {
    falharAoCriar = true;
    const { result, unmount } = renderHook(() => useFalaAoVivo(true));
    expect(result.current.texto).toBe("");
    unmount();
  });

  it("parar um reconhecimento já parado não quebra", () => {
    falharAoParar = true;
    const { unmount } = renderHook(() => useFalaAoVivo(true));
    expect(() => unmount()).not.toThrow();
  });
});
