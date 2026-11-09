import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

// Teclado e botões do composer: navegar no menu de menção com as setas, escolher
// com Enter/Tab, fechar com Esc, botão @, botão Enviar, Shift+Enter e o aviso
// no plural para várias pessoas sem conta.

vi.mock("../hooks/usePessoasSemConta", () => ({ usePessoasSemConta: () => new Set(["p3", "p4"]) }));

import { AtividadeComposer } from "./AtividadeComposer";

const pessoas = [
  { id: "p1", nome: "Ana" },
  { id: "p2", nome: "André" },
  { id: "p3", nome: "Caio" },
  { id: "p4", nome: "Duda" },
];

let onSubmit: ReturnType<typeof vi.fn<(texto: string, mencionados: string[]) => void>>;
function montar(placeholder?: string) {
  onSubmit = vi.fn();
  render(<AtividadeComposer pessoas={pessoas} onSubmit={onSubmit} placeholder={placeholder} />);
  return screen.getByPlaceholderText(placeholder ?? "Escrever um comentário...") as HTMLTextAreaElement;
}
function digitar(caixa: HTMLTextAreaElement, texto: string) {
  fireEvent.change(caixa, { target: { value: texto, selectionStart: texto.length, selectionEnd: texto.length } });
}
const destacado = () => document.querySelector("button.bg-muted")?.textContent;

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  });
});

describe("AtividadeComposer: menu de menção pelo teclado", () => {
  it("setas circulam, Enter escolhe e o texto ganha o nome", () => {
    const caixa = montar();
    digitar(caixa, "Oi @An");
    // "an" casa @all? Não: só Ana e André.
    expect(destacado()).toBe("Ana");
    fireEvent.keyDown(caixa, { key: "ArrowDown" });
    expect(destacado()).toBe("André");
    fireEvent.keyDown(caixa, { key: "ArrowDown" });
    expect(destacado()).toBe("Ana");
    fireEvent.keyDown(caixa, { key: "ArrowUp" });
    expect(destacado()).toBe("André");
    fireEvent.keyDown(caixa, { key: "Enter" });
    expect(caixa).toHaveValue("Oi @André ");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("Tab também escolhe; Esc fecha sem mexer no texto", () => {
    const caixa = montar();
    digitar(caixa, "@Andr");
    fireEvent.keyDown(caixa, { key: "Tab" });
    expect(caixa).toHaveValue("@André ");

    digitar(caixa, "@André @An");
    expect(screen.getByRole("button", { name: "Ana" })).toBeInTheDocument();
    fireEvent.keyDown(caixa, { key: "Escape" });
    expect(screen.queryByRole("button", { name: "Ana" })).not.toBeInTheDocument();
    expect(caixa).toHaveValue("@André @An");
    // Com o menu fechado, outra tecla qualquer não faz nada.
    fireEvent.keyDown(caixa, { key: "ArrowDown" });
    expect(caixa).toHaveValue("@André @An");
  });

  it("quem não tem login não aparece no menu", () => {
    const caixa = montar();
    digitar(caixa, "@");
    expect(screen.getByRole("button", { name: "Ana" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Caio" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Duda" })).not.toBeInTheDocument();
  });

  it("consulta sem ninguém deixa o menu fechado e Enter envia", () => {
    const caixa = montar();
    digitar(caixa, "@zz");
    expect(screen.queryAllByRole("button", { name: /Ana|@all/ })).toHaveLength(0);
    fireEvent.keyDown(caixa, { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledWith("@zz", []);
  });

  it("botão @ abre a lista completa na posição do cursor e o clique insere", () => {
    const caixa = montar();
    digitar(caixa, "Falar com ");
    fireEvent.click(screen.getByRole("button", { name: "Mencionar alguém" }));
    expect(screen.getByRole("button", { name: /@all/ })).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole("button", { name: "Ana" }));
    fireEvent.click(screen.getByRole("button", { name: "Ana" }));
    expect(caixa).toHaveValue("Falar com @Ana ");
  });

  it("digitar texto sem @ fecha qualquer menu", () => {
    const caixa = montar();
    digitar(caixa, "@A");
    digitar(caixa, "sem arroba");
    expect(screen.queryByRole("button", { name: "Ana" })).not.toBeInTheDocument();
  });
});

describe("AtividadeComposer: enviar", () => {
  it("botão Enviar manda o texto aparado com os mencionados e limpa", () => {
    const caixa = montar("Comente aqui");
    expect(screen.getByRole("button", { name: "Enviar" })).toBeDisabled();
    digitar(caixa, "  @Ana veja  ");
    fireEvent.keyDown(caixa, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(onSubmit).toHaveBeenCalledWith("@Ana veja", ["p1"]);
    expect(caixa).toHaveValue("");
  });

  it("Shift+Enter não envia; texto só com espaços não envia", () => {
    const caixa = montar();
    digitar(caixa, "linha");
    fireEvent.keyDown(caixa, { key: "Enter", shiftKey: true });
    digitar(caixa, "   ");
    fireEvent.keyDown(caixa, { key: "Enter" });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("aviso no plural quando várias pessoas sem conta são marcadas", () => {
    const caixa = montar();
    digitar(caixa, "@Caio e @Duda vejam");
    expect(screen.getByRole("status")).toHaveTextContent("Caio, Duda não têm conta e não recebem o aviso.");
  });

  it("rolar a caixa sincroniza o fundo com os destaques", () => {
    const caixa = montar();
    caixa.scrollTop = 30;
    fireEvent.scroll(caixa);
    const fundo = caixa.parentElement!.querySelector("[aria-hidden]") as HTMLDivElement;
    expect(fundo.scrollTop).toBe(30);
  });
});
