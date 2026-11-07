import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ChainQuery, ChainResult } from "@/test/supabaseChain";
import StatusPage from "./index";

const h = vi.hoisted(() => ({
  resolve: vi.fn<(q: ChainQuery) => ChainResult>(),
}));

vi.mock("@/integrations/supabase/client", async () => {
  const { createSupabaseFrom } = await import("@/test/supabaseChain");
  return { supabase: { from: createSupabaseFrom((q) => h.resolve(q)).from } };
});
vi.mock("@/hooks/usePageTitle", () => ({ usePageTitle: vi.fn() }));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <StatusPage />
    </QueryClientProvider>
  );
}

const COMPONENTES = [
  { id: "1", slug: "app", nome_exibicao: "Aplicativo", status_efetivo: "operacional" },
  { id: "2", slug: "ia", nome_exibicao: "Agentes", status_efetivo: "degradado" },
];

beforeEach(() => {
  vi.clearAllMocks();
  h.resolve.mockImplementation((q) => (q.table === "status_current" ? { data: COMPONENTES } : { data: [] }));
});

describe("Status público", () => {
  it("lista componentes e diz que não há incidentes", async () => {
    renderPage();
    expect(await screen.findByText("Aplicativo")).toBeInTheDocument();
    expect(screen.getByText("Agentes")).toBeInTheDocument();
    expect(screen.getByText("Nenhum incidente registrado.")).toBeInTheDocument();
  });

  it("incidente mostra componentes afetados e atualizações da mais nova para a mais antiga", async () => {
    h.resolve.mockImplementation((q) =>
      q.table === "status_current"
        ? { data: COMPONENTES }
        : {
            data: [
              {
                id: "i1",
                titulo: "Lentidão nos agentes",
                severidade: "menor",
                status: "investigando",
                created_at: "2026-11-01T10:00:00Z",
                status_incident_components: [
                  { status_components: { nome_exibicao: "Agentes" } },
                  { status_components: null },
                ],
                status_incident_updates: [
                  { id: "a", mensagem: "Primeira", created_at: "2026-11-01T10:05:00Z" },
                  { id: "b", mensagem: "Segunda", created_at: "2026-11-01T11:00:00Z" },
                ],
              },
            ],
          }
    );
    renderPage();
    expect(await screen.findByText("Lentidão nos agentes")).toBeInTheDocument();
    const itens = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(itens[0]).toContain("Segunda");
    expect(itens[1]).toContain("Primeira");
  });

  it("erro ao consultar mostra aviso sem detalhe técnico", async () => {
    h.resolve.mockImplementation((q) =>
      q.table === "status_current" ? { error: { message: "relation status_current does not exist" } } : { data: [] }
    );
    renderPage();
    expect(await screen.findByText(/Não conseguimos carregar o status agora/)).toBeInTheDocument();
    expect(screen.queryByText(/relation/)).not.toBeInTheDocument();
  });
});
