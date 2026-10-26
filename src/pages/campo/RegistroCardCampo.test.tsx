import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PERGUNTA_EFETIVO, PERGUNTA_SEM_FALA } from "@/lib/registrosObra";
import { RegistroCardCampo } from "./RegistroCardCampo";
import type { RegistroView } from "./registrosView";

const base: RegistroView = {
  chave: "c1",
  id: "s1",
  data: "2026-10-19",
  criadoEm: new Date(2026, 9, 19, 11, 15).getTime(),
  autorNome: "Zé Pedreiro",
  meu: true,
  estado: "pronto",
  texto: "Parede da cozinha pronta.",
  extraido: null,
  duracaoS: 20,
  temAudio: true,
  fotos: 0,
  erro: null,
  semSinal: false,
};

function montar(r: Partial<RegistroView> = {}, p: Partial<Parameters<typeof RegistroCardCampo>[0]> = {}) {
  const props = {
    registro: { ...base, ...r },
    onReprocessar: vi.fn(),
    reprocessando: false,
    onResponderEfetivo: vi.fn(),
    onDescartar: vi.fn(),
    ...p,
  };
  render(<RegistroCardCampo {...props} />);
  return props;
}

describe("RegistroCardCampo", () => {
  it("mostra 'Você' para o próprio registro, o texto, a duração e os chips do que a IA entendeu", () => {
    montar({ extraido: { efetivo_total: 8, materiais_faltando: ["Cimento"] }, fotos: 2 });
    expect(screen.getByText("Você")).toBeTruthy();
    expect(screen.getByText("Parede da cozinha pronta.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ouvir (0:20)" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ver as 2 fotos" })).toBeTruthy();
    expect(screen.getByText("8 pessoas")).toBeTruthy();
    expect(screen.getByText("Falta: Cimento")).toBeTruthy();
  });

  it("registro de outra pessoa só mostra o resumo do que tem, sem botão para abrir arquivo", () => {
    montar({ meu: false, autorNome: "Marcos", fotos: 2 });
    expect(screen.getByText("0:20")).toBeTruthy();
    expect(screen.getByText("2 fotos")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Ouvir|Ver as/ })).toBeNull();
  });

  it("registro de outra pessoa mostra o nome dela e não pergunta nada", () => {
    montar({ meu: false, autorNome: "Marcos", extraido: { pergunta: PERGUNTA_EFETIVO } });
    expect(screen.getByText("Marcos")).toBeTruthy();
    expect(screen.queryByText(PERGUNTA_EFETIVO)).toBeNull();
  });

  it("organizando: mostra o selo e o esqueleto no lugar do texto", () => {
    montar({ estado: "organizando", texto: null });
    expect(screen.getByText("Organizando")).toBeTruthy();
    expect(screen.getByRole("article").getAttribute("aria-busy")).toBe("true");
  });

  it("só no aparelho: 'Enviando' e, depois de uma tentativa que falhou, 'Esperando sinal'", () => {
    const { unmount } = render(
      <RegistroCardCampo
        registro={{ ...base, id: null, estado: "local", texto: null }}
        onReprocessar={vi.fn()}
        reprocessando={false}
        onResponderEfetivo={vi.fn()}
        onDescartar={vi.fn()}
      />
    );
    expect(screen.getByText("Enviando")).toBeTruthy();
    unmount();
    montar({ id: null, estado: "local", texto: null, semSinal: true });
    expect(screen.getByText("Esperando sinal")).toBeTruthy();
  });

  it("falhou: diz que o registro está salvo e oferece tentar de novo", () => {
    const p = montar({ estado: "falhou", erro: "tempo_esgotado" });
    expect(screen.getByText(/Seu registro está salvo/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /tentar de novo/i }));
    expect(p.onReprocessar).toHaveBeenCalledWith("s1");
  });

  it("bloqueado: mostra o motivo e descarta pela chave", () => {
    const p = montar({ id: null, estado: "bloqueado", erro: "Áudio acima de 3 minutos" });
    expect(screen.getByText("Áudio acima de 3 minutos")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /descartar/i }));
    expect(p.onDescartar).toHaveBeenCalledWith("c1");
  });

  it("pergunta de efetivo: responde com um número e dá para pular", () => {
    const p = montar({ extraido: { efetivo_total: null, pergunta: PERGUNTA_EFETIVO } });
    expect(screen.getByText(PERGUNTA_EFETIVO)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "8" }));
    expect(p.onResponderEfetivo).toHaveBeenCalledWith("s1", 8);
    fireEvent.click(screen.getByRole("button", { name: /pular/i }));
    expect(screen.queryByText(PERGUNTA_EFETIVO)).toBeNull();
  });

  it("áudio sem fala: avisa para gravar de novo e não faz pergunta numérica", () => {
    montar({ texto: null, extraido: { pergunta: PERGUNTA_SEM_FALA } });
    expect(screen.getByText(/Não ouvimos fala/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "8" })).toBeNull();
  });
});
