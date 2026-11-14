import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LabelsEditor } from "./LabelsEditor";
import { LinksEditor, type LinkItem } from "./LinksEditor";
import { HorasMinutosField } from "./HorasMinutosField";
import { CommandPaletteHint } from "./CommandPaletteHint";
import { EVENTO_ABRIR_PALETA } from "@/lib/paletaComandosEvento";
import { ErrorBoundary } from "./ErrorBoundary";

const h = vi.hoisted(() => ({
  capture: vi.fn(),
  breadcrumb: vi.fn(),
  isStale: vi.fn(),
  tentarReload: vi.fn(),
}));

vi.mock("@/lib/monitoring", () => ({ monitoring: { captureException: h.capture, addBreadcrumb: h.breadcrumb } }));
vi.mock("@/lib/staleChunkReload", () => ({
  isStaleChunkError: h.isStale,
  tentarReloadPorChunkVelho: h.tentarReload,
}));

function Etiquetas({ inicial = [] as string[], readOnly = false }) {
  const [v, setV] = useState(inicial);
  return <LabelsEditor value={v} onChange={setV} readOnly={readOnly} />;
}

function Links({ inicial = [] as LinkItem[] }) {
  const [v, setV] = useState(inicial);
  return <LinksEditor value={v} onChange={setV} />;
}

describe("LabelsEditor", () => {
  it("adiciona com Enter e vírgula, ignora repetida e vazia", async () => {
    const user = userEvent.setup();
    render(<Etiquetas />);
    const input = screen.getByPlaceholderText("Adicionar etiqueta…");
    await user.type(input, "urgente{Enter}");
    await user.type(screen.getByPlaceholderText("+ etiqueta"), "cliente,");
    await user.type(screen.getByPlaceholderText("+ etiqueta"), "urgente{Enter}");
    await user.type(screen.getByPlaceholderText("+ etiqueta"), "   {Enter}");
    expect(screen.getAllByRole("button", { name: /Remover etiqueta/ })).toHaveLength(2);
  });

  it("botão + adiciona antes do blur; blur também adiciona", async () => {
    const user = userEvent.setup();
    render(<Etiquetas />);
    await user.type(screen.getByPlaceholderText("Adicionar etiqueta…"), "obra");
    fireEvent.mouseDown(screen.getByRole("button", { name: "Adicionar etiqueta" }));
    expect(screen.getByText("obra")).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText("+ etiqueta"), "fase");
    fireEvent.blur(screen.getByPlaceholderText("+ etiqueta"));
    expect(screen.getByText("fase")).toBeInTheDocument();
  });

  it("backspace com campo vazio remove a última; X remove a escolhida", async () => {
    const user = userEvent.setup();
    render(<Etiquetas inicial={["a", "b", "c"]} />);
    await user.click(screen.getByPlaceholderText("+ etiqueta"));
    await user.keyboard("{Backspace}");
    expect(screen.queryByText("c")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remover etiqueta a" }));
    expect(screen.queryByText("a")).not.toBeInTheDocument();
    expect(screen.getByText("b")).toBeInTheDocument();
  });

  it("somente leitura", () => {
    render(<Etiquetas readOnly />);
    expect(screen.getByText("Sem etiquetas")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});

describe("LinksEditor", () => {
  it("normaliza a URL, adiciona por Enter, botão e blur, e remove", async () => {
    const user = userEvent.setup();
    render(<Links />);
    const input = screen.getByPlaceholderText(/Colar URL/);
    await user.type(input, "drive.google.com/x{Enter}");
    expect(screen.getByRole("link", { name: "https://drive.google.com/x" })).toHaveAttribute(
      "rel",
      "noopener noreferrer"
    );
    await user.type(input, "http://repo.test");
    await user.click(screen.getByRole("button", { name: /Adicionar/ }));
    expect(screen.getByRole("link", { name: /http:\/\/repo.test/ })).toBeInTheDocument();
    await user.type(input, "   ");
    fireEvent.blur(input);
    expect(screen.getAllByRole("link")).toHaveLength(2);
    await user.click(screen.getAllByRole("button", { name: "Remover link" })[0]);
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("mostra rótulo quando há e 'Sem links' no modo leitura", () => {
    const { unmount } = render(
      <LinksEditor value={[{ url: "https://a.test", rotulo: "Projeto" }]} onChange={vi.fn()} readOnly />
    );
    expect(screen.getByRole("link", { name: /Projeto/ })).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    unmount();
    render(<LinksEditor value={[]} onChange={vi.fn()} readOnly />);
    expect(screen.getByText("Sem links")).toBeInTheDocument();
  });
});

describe("HorasMinutosField", () => {
  it("converte decimal, arredonda e limpa", () => {
    const onChange = vi.fn();
    render(<HorasMinutosField value={1.5} onChange={onChange} />);
    const input = screen.getByLabelText("Horas");
    expect(input).toHaveValue(1.5);
    fireEvent.change(input, { target: { value: "0.33333" } });
    expect(onChange).toHaveBeenLastCalledWith(0.333);
    fireEvent.change(input, { target: { value: "" } });
    expect(onChange).toHaveBeenLastCalledWith(null);
    onChange.mockClear();
    fireEvent.change(input, { target: { value: "-1" } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("sem valor inicial fica vazio", () => {
    render(<HorasMinutosField value={null} onChange={vi.fn()} disabled />);
    expect(screen.getByLabelText("Horas")).toHaveValue(null);
    expect(screen.getByLabelText("Horas")).toBeDisabled();
  });
});

describe("CommandPaletteHint", () => {
  const plataforma = Object.getOwnPropertyDescriptor(Navigator.prototype, "platform");
  afterEach(() => {
    if (plataforma) Object.defineProperty(Navigator.prototype, "platform", plataforma);
  });

  it("⌘K no Mac, Ctrl+K nos outros", () => {
    Object.defineProperty(Navigator.prototype, "platform", { get: () => "MacIntel", configurable: true });
    const { unmount } = render(<CommandPaletteHint />);
    expect(screen.getByText("⌘K")).toBeInTheDocument();
    unmount();
    Object.defineProperty(Navigator.prototype, "platform", { get: () => "Win32", configurable: true });
    render(<CommandPaletteHint />);
    expect(screen.getByText("Ctrl+K")).toBeInTheDocument();
  });

  it("é um botão do trilho que abre a paleta", () => {
    const ouvinte = vi.fn();
    window.addEventListener(EVENTO_ABRIR_PALETA, ouvinte);
    render(<CommandPaletteHint />);
    fireEvent.click(screen.getByRole("button", { name: /Buscar e comandos/ }));
    expect(ouvinte).toHaveBeenCalledTimes(1);
    window.removeEventListener(EVENTO_ABRIR_PALETA, ouvinte);
  });
});

describe("ErrorBoundary", () => {
  function Quebra({ erro }: { erro: Error }): JSX.Element {
    throw erro;
  }

  const reload = vi.fn();
  const back = vi.fn();
  const locationOriginal = window.location;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    Object.defineProperty(window, "location", { value: { ...locationOriginal, reload }, configurable: true });
    vi.spyOn(window.history, "back").mockImplementation(back);
    h.isStale.mockReturnValue(false);
  });

  afterEach(() => {
    Object.defineProperty(window, "location", { value: locationOriginal, configurable: true });
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("sem erro renderiza os filhos", () => {
    render(
      <ErrorBoundary>
        <span>ok</span>
      </ErrorBoundary>
    );
    expect(screen.getByText("ok")).toBeInTheDocument();
  });

  it("erro mostra a tela com código, copia detalhes e tenta de novo", async () => {
    h.capture.mockReturnValue("evt-42");
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(
      <ErrorBoundary>
        <Quebra erro={new Error("falhou feio")} />
      </ErrorBoundary>
    );
    expect(screen.getByText("Esta página não carregou")).toBeInTheDocument();
    expect(screen.getByText("falhou feio")).toBeInTheDocument();
    expect(await screen.findByText("Código: evt-42")).toBeInTheDocument();
    expect(h.capture).toHaveBeenCalledWith(expect.any(Error), { componentStack: expect.any(String) });

    await user.click(screen.getByRole("button", { name: "Copiar detalhes" }));
    expect(writeText.mock.calls[0][0]).toMatch(/^Código: evt-42\n\nError: falhou feio/);
    expect(await screen.findByRole("button", { name: "Copiado" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(reload).toHaveBeenCalled();
  });

  it("sem event id copia só o detalhe; voltar limpa o erro", async () => {
    h.capture.mockReturnValue(undefined);
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const erro = new Error("x");
    erro.stack = undefined;
    let quebrar = true;
    function Talvez() {
      if (quebrar) throw erro;
      return <span>voltou</span>;
    }
    render(
      <ErrorBoundary>
        <Talvez />
      </ErrorBoundary>
    );
    await user.click(screen.getByRole("button", { name: "Copiar detalhes" }));
    expect(writeText).toHaveBeenCalledWith("x");
    quebrar = false;
    await user.click(screen.getByRole("button", { name: "Voltar" }));
    expect(back).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText("voltou")).toBeInTheDocument());
  });

  it("chunk velho recarrega em vez de reportar", () => {
    h.isStale.mockReturnValue(true);
    h.tentarReload.mockReturnValue(true);
    render(
      <ErrorBoundary>
        <Quebra erro={new Error("Failed to fetch dynamically imported module")} />
      </ErrorBoundary>
    );
    expect(h.breadcrumb).toHaveBeenCalledWith("stale_chunk_reload", { origem: "ErrorBoundary" });
    expect(h.capture).not.toHaveBeenCalled();
  });
});
