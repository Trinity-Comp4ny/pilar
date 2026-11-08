import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

// Casca da página de Metas: título, painel e o "Nova meta" (do cabeçalho ou do
// vazio do painel) abrindo o formulário.

vi.mock("@/components/ui/sidebar", () => ({ useSidebar: () => ({ state: "expanded", isMobile: false }) }));
vi.mock("@/components/PageHeader", () => ({
  PageHeader: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <header>
      <h1>{title}</h1>
      {children}
    </header>
  ),
}));
vi.mock("./tabs/MetasDashboard", () => ({
  default: ({ onCreate }: { onCreate: () => void }) => (
    <button type="button" onClick={onCreate}>
      criar-pelo-painel
    </button>
  ),
}));
vi.mock("./components/MetaFormDialog", () => ({
  MetaFormDialog: ({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) =>
    open ? (
      <div role="dialog">
        <button type="button" onClick={() => onOpenChange(false)}>
          fechar
        </button>
      </div>
    ) : null,
}));

import MetasPage from "./index";

describe("MetasPage", () => {
  it("define o título e abre o formulário pelo cabeçalho e pelo painel", () => {
    render(<MetasPage />);
    expect(screen.getByRole("heading", { name: "Metas" })).toBeInTheDocument();
    expect(document.title).toContain("Metas");
    expect(screen.getByRole("region", { name: "Painel de metas" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Nova meta/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "fechar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "criar-pelo-painel" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
