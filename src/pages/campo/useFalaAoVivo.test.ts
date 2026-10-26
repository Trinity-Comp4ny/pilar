import { describe, expect, it } from "vitest";
import { falaAoVivoSuportada, montarTextoDaFala } from "./useFalaAoVivo";

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
