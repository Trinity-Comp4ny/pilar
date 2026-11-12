import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { SobrePilar } from "./SobrePilar";

const h = vi.hoisted(() => ({
  closeSettings: vi.fn(),
  env: { VITE_STATUS_URL: undefined as string | undefined },
}));

vi.mock("@/contexts/SettingsModalContext", () => ({ useSettingsModal: () => ({ closeSettings: h.closeSettings }) }));
vi.mock("@/lib/env", () => ({ env: h.env }));

function renderSobre() {
  return render(
    <MemoryRouter initialEntries={["/inicio"]}>
      <Routes>
        <Route path="/inicio" element={<SobrePilar />} />
        <Route path="/novidades" element={<h1>Página novidades</h1>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  h.closeSettings.mockReset();
  h.env.VITE_STATUS_URL = undefined;
  vi.stubGlobal("__SENTRY_RELEASE__", "0b62931e4f2a9c1d7e8b3a5c6d9f0e1a2b3c4d5e");
  vi.stubGlobal("__BUILD_TIME__", "2026-11-10T15:30:00.000Z");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SobrePilar", () => {
  it("mostra a versão curta e a data do build", () => {
    renderSobre();
    expect(screen.getByText("Sobre a Pilar")).toBeInTheDocument();
    expect(screen.getByTestId("versao-app")).toHaveTextContent(/^Versão 0b62931 · \d{2}\/11\/2026/);
  });

  it("build de desenvolvimento", () => {
    vi.stubGlobal("__SENTRY_RELEASE__", "dev");
    renderSobre();
    expect(screen.getByTestId("versao-app")).toHaveTextContent("Versão de desenvolvimento");
  });

  it("links de ajuda; status cai em /status sem VITE_STATUS_URL", () => {
    renderSobre();
    expect(screen.getByRole("link", { name: "Novidades" })).toHaveAttribute("href", "/novidades");
    expect(screen.getByRole("link", { name: "Central de ajuda" })).toHaveAttribute("href", "/ajuda");
    const status = screen.getByRole("link", { name: "Status do sistema" });
    expect(status).toHaveAttribute("href", "/status");
    expect(status).not.toHaveAttribute("target");
  });

  it("status abre a página externa em nova aba quando configurada", () => {
    h.env.VITE_STATUS_URL = "https://status.exemplo.test";
    renderSobre();
    const status = screen.getByRole("link", { name: "Status do sistema" });
    expect(status).toHaveAttribute("href", "https://status.exemplo.test");
    expect(status).toHaveAttribute("target", "_blank");
    expect(status).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("link interno fecha o modal de configurações e navega", async () => {
    const user = userEvent.setup();
    renderSobre();
    await user.click(screen.getByRole("link", { name: "Novidades" }));
    expect(h.closeSettings).toHaveBeenCalled();
    expect(screen.getByText("Página novidades")).toBeInTheDocument();
  });
});
