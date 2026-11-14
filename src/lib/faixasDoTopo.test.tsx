import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { registrarAlvoFaixas } from "./faixasDoTopo";
import { ReadOnlyBanner } from "@/components/ReadOnlyBanner";

vi.mock("@/contexts/SettingsModalContext", () => ({ useSettingsModal: () => ({ openSettings: vi.fn() }) }));

afterEach(() => act(() => registrarAlvoFaixas(null)));

describe("faixas de sistema", () => {
  it("sem o bloco do topo, a faixa fica fixa por conta própria", () => {
    render(<ReadOnlyBanner isAdmin={false} />);
    expect(screen.getByRole("status").parentElement).toHaveClass("fixed");
  });

  it("com o bloco do topo registrado, a faixa entra nele (e desce as páginas com ele)", () => {
    const bloco = document.createElement("div");
    document.body.appendChild(bloco);
    act(() => registrarAlvoFaixas(bloco));
    render(<ReadOnlyBanner isAdmin={false} />);
    expect(bloco).toContainElement(screen.getByRole("status"));
    bloco.remove();
  });
});
