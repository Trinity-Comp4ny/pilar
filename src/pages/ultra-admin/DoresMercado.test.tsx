import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import DoresMercado from "./DoresMercado";

const h = vi.hoisted(() => ({
  resultado: { data: [] as unknown[], error: null as unknown },
  tabela: "",
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (tabela: string) => {
      h.tabela = tabela;
      const q: Record<string, unknown> = {
        select: () => q,
        order: () => q,
        limit: () => Promise.resolve(h.resultado),
      };
      return q;
    },
  },
}));
vi.mock("@/hooks/usePageTitle", () => ({ usePageTitle: vi.fn() }));
vi.mock("@/components/PilarPage", () => ({
  PilarPage: ({
    title,
    actions,
    children,
  }: {
    title: string;
    actions?: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <main>
      <h1>{title}</h1>
      {actions}
      {children}
    </main>
  ),
}));

const linha = (empresa: string, porte: string, extra: Record<string, unknown>) => ({
  empresa_id: `id-${empresa}`,
  created_at: "2026-11-10T10:00:00Z",
  dores: [],
  dor_principal: null,
  texto_livre: null,
  contexto: {},
  etapa_atual: 7,
  concluido_em: "2026-11-10T10:05:00Z",
  empresas: { nome: empresa, porte, disciplinas: ["estrutural"] },
  ...extra,
});

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <DoresMercado />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  h.tabela = "";
  h.resultado = {
    data: [
      linha("Alfa", "6-15", {
        dores: ["prazos", "equipe"],
        dor_principal: "prazos",
        texto_livre: "Perdemos prazo toda semana",
      }),
      linha("Beta", "1-5", { dores: ["prazos"], dor_principal: "prazos", texto_livre: "=1+1" }),
      linha("Gama", "16-40", { dores: ["financeiro"], dor_principal: "financeiro" }),
    ],
    error: null,
  };
});

describe("Dores do mercado (SPEC 165, fase 4)", () => {
  it("lê onboarding_respostas e mostra o ranking com a base", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "Dores do mercado" })).toBeInTheDocument();
    await screen.findByText(/base: 3 escritórios/);
    expect(h.tabela).toBe("onboarding_respostas");
    const ranking = screen.getByText(/Dores mais citadas/).closest("div")!.parentElement!;
    const primeiro = within(ranking).getAllByRole("listitem")[0];
    expect(primeiro).toHaveTextContent("Estouro de prazo e de cronograma");
    expect(primeiro).toHaveTextContent("2 (67%) · principal em 2");
  });

  it("filtra por porte", async () => {
    renderPage();
    await screen.findByText(/base: 3 escritórios/);
    await userEvent.setup().click(screen.getByRole("radio", { name: "1 a 5 pessoas" }));
    expect(await screen.findByText(/base: 1 escritórios/)).toBeInTheDocument();
    expect(screen.queryByText("Perdemos prazo toda semana")).not.toBeInTheDocument();
  });

  it("mostra o texto livre com link para a empresa, sem executar nada", async () => {
    renderPage();
    const link = await screen.findByRole("link", { name: "Alfa" });
    expect(link).toHaveAttribute("href", "/ultra-admin/empresas/id-Alfa");
    expect(screen.getByText("Perdemos prazo toda semana")).toBeInTheDocument();
    expect(screen.getByText("=1+1")).toBeInTheDocument();
  });

  it("sem respostas mostra o estado vazio e desabilita a exportação", async () => {
    h.resultado = { data: [], error: null };
    renderPage();
    expect(await screen.findByText("Ainda sem respostas")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Exportar CSV/ })).toBeDisabled();
  });

  it("erro de consulta mostra aviso", async () => {
    h.resultado = { data: null as unknown as unknown[], error: new Error("falhou") };
    renderPage();
    expect(await screen.findByText("Não foi possível carregar as respostas")).toBeInTheDocument();
  });

  it("exporta o CSV do recorte atual, com texto livre neutralizado", async () => {
    const blobs: Blob[] = [];
    const criar = vi.fn((b: Blob) => (blobs.push(b), "blob:csv"));
    const clique = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    Object.assign(URL, { createObjectURL: criar, revokeObjectURL: vi.fn() });
    renderPage();
    await screen.findByText(/base: 3 escritórios/);
    await userEvent.setup().click(screen.getByRole("button", { name: /Exportar CSV/ }));
    await waitFor(() => expect(clique).toHaveBeenCalled());
    const texto = await blobs[0].text();
    expect(texto.split("\n")).toHaveLength(4);
    expect(texto).toContain("'=1+1");
    expect(texto).not.toMatch(/,=1\+1/);
    clique.mockRestore();
  });
});
