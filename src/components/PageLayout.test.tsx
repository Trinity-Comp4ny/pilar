import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { MemoryRouter } from "react-router-dom";
import { PageLayout } from "./PageLayout";

// O chip-nav mobile lê permissões (AuthProvider); aqui só interessa a posição da camada.
vi.mock("@/components/ModuleChipNav", () => ({ ModuleChipNav: () => null }));

describe("PageLayout", () => {
  it("desce pela altura das faixas de aviso do topo (--faixas-h)", () => {
    render(
      <MemoryRouter>
        <SidebarProvider>
          <PageLayout header={<div>cabeçalho</div>}>conteúdo</PageLayout>
        </SidebarProvider>
      </MemoryRouter>
    );
    const camada = screen.getByText("cabeçalho").closest(".fixed") as HTMLElement;
    expect(camada.style.top).toBe("var(--faixas-h, 0px)");
  });

  it("standalone não tem faixas acima: fica colado no topo", () => {
    render(
      <MemoryRouter>
        <SidebarProvider>
          <PageLayout standalone header={<div>cabeçalho</div>}>
            conteúdo
          </PageLayout>
        </SidebarProvider>
      </MemoryRouter>
    );
    const camada = screen.getByText("cabeçalho").closest(".fixed") as HTMLElement;
    expect(camada.style.top).toBe("0px");
  });

  it("o recuo lateral do conteúdo é o do header (24 px), sem os 40 a 48 px de antes", () => {
    render(
      <MemoryRouter>
        <SidebarProvider>
          <PageLayout header={<div>cabeçalho</div>}>
            <p>conteúdo</p>
          </PageLayout>
        </SidebarProvider>
      </MemoryRouter>
    );
    const area = screen.getByText("conteúdo").closest("[tabindex='-1']") as HTMLElement;
    expect(area).toHaveClass("md:px-6", "md:pt-6");
    expect(area.className).not.toMatch(/xl:p-1\d/);
  });
});
