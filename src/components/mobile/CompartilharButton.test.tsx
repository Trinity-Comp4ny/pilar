import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const h = vi.hoisted(() => ({
  nativo: true,
  compartilhar: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/lib/compartilhar", () => ({
  temCompartilharNativo: () => h.nativo,
  compartilhar: h.compartilhar,
}));
vi.mock("sonner", () => ({ toast: { success: h.success, error: h.error } }));

import { CompartilharButton } from "./CompartilharButton";

describe("CompartilharButton", () => {
  beforeEach(() => {
    h.nativo = true;
    h.compartilhar.mockReset();
    h.success.mockReset();
    h.error.mockReset();
  });

  it("não aparece sem folha nativa", () => {
    h.nativo = false;
    const { container } = render(<CompartilharButton dados={() => ({ url: "u" })} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("compartilha os dados na hora do toque", async () => {
    h.compartilhar.mockResolvedValue("compartilhado");
    render(<CompartilharButton dados={() => ({ url: "https://a.b" })} />);
    await userEvent.click(screen.getByRole("button", { name: /compartilhar/i }));
    expect(h.compartilhar).toHaveBeenCalledWith({ url: "https://a.b" });
    expect(h.success).not.toHaveBeenCalled();
  });

  it("avisa quando caiu no copiar e quando falhou", async () => {
    h.compartilhar.mockResolvedValueOnce("copiado").mockResolvedValueOnce("falhou");
    render(<CompartilharButton rotulo="Enviar" dados={() => ({ url: "u" })} />);
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(h.success).toHaveBeenCalledWith("Copiado"));
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(h.error).toHaveBeenCalled());
  });

  it("sem dados não compartilha", async () => {
    render(<CompartilharButton dados={() => null} />);
    await userEvent.click(screen.getByRole("button", { name: /compartilhar/i }));
    expect(h.compartilhar).not.toHaveBeenCalled();
  });
});
