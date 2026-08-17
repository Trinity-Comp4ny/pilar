import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DataFrescor } from "./DataFrescor";

// Smoke test de render (spec #45). O selo usa setInterval de 30s para o "há X min"
// avançar; com fake timers o teste fica determinístico e não depende do relógio real.
describe("DataFrescor", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date("2026-08-13T12:00:00Z") });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("não renderiza nada sem updatedAt e sem isFetching", () => {
    const { container } = render(<DataFrescor />);
    expect(container).toBeEmptyDOMElement();
  });

  it("mostra estado de atualização quando isFetching", () => {
    render(<DataFrescor isFetching />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Atualizando");
  });

  it("mostra 'Atualizado …' quando tem updatedAt e não está buscando", () => {
    render(<DataFrescor updatedAt={Date.now() - 60_000} />);
    expect(screen.getByRole("status")).toHaveTextContent(/Atualizado/);
  });

  it("com onRefresh vira botão que dispara refetch", () => {
    const onRefresh = vi.fn();
    render(<DataFrescor updatedAt={Date.now()} onRefresh={onRefresh} />);
    fireEvent.click(screen.getByRole("button", { name: "Atualizar dados agora" }));
    expect(onRefresh).toHaveBeenCalledOnce();
  });
});
