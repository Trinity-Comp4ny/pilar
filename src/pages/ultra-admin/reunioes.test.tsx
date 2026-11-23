import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Cerebro from "./Cerebro";
import { NovaReuniaoDialog } from "./NovaReuniaoDialog";

const h = vi.hoisted(() => ({
  invoke: vi.fn(),
  insights: [] as unknown[],
  reunioes: [] as unknown[],
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: h.invoke },
    from: (tabela: string) => {
      const dados = () => (tabela === "reuniao_insight" ? h.insights : h.reunioes);
      const q: Record<string, unknown> = {
        select: () => q,
        order: () => q,
        eq: () => q,
        limit: () => Promise.resolve({ data: dados(), error: null }),
      };
      return q;
    },
  },
}));
vi.mock("@/hooks/usePageTitle", () => ({ usePageTitle: vi.fn() }));
vi.mock("@/components/PilarPage", () => ({
  PilarPage: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <main>
      <h1>{title}</h1>
      {children}
    </main>
  ),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function renderComQuery(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  h.invoke.mockReset();
  h.insights = [];
  h.reunioes = [];
});

describe("NovaReuniaoDialog", () => {
  it("só habilita Analisar com título, origem e transcrição, e envia o corpo certo", async () => {
    h.invoke.mockResolvedValue({
      data: { reuniao_id: "r1", insights: 2, descartados_sem_citacao: 0, compromissos: 0 },
      error: null,
    });
    const onAnalisada = vi.fn();
    const user = userEvent.setup();
    renderComQuery(<NovaReuniaoDialog open onOpenChange={() => {}} onAnalisada={onAnalisada} />);

    const analisar = screen.getByRole("button", { name: "Analisar" });
    expect(analisar).toBeDisabled();

    await user.type(screen.getByLabelText("Título"), "Reunião de teste");
    await user.click(screen.getByRole("radio", { name: "Contato frio" }));
    await user.type(screen.getByLabelText("Transcrição"), "texto da reunião");
    expect(analisar).toBeEnabled();
    await user.click(analisar);

    await waitFor(() => expect(h.invoke).toHaveBeenCalled());
    const [nome, opts] = h.invoke.mock.calls[0];
    expect(nome).toBe("reuniao-analisar");
    expect(opts.body).toMatchObject({
      titulo: "Reunião de teste",
      origem_contato: "frio",
      transcript: "texto da reunião",
    });
    await waitFor(() => expect(onAnalisada).toHaveBeenCalledWith("r1"));
  });
});

describe("Cerebro", () => {
  it("mostra o tema com reuniões e escritórios e marca como hipótese quando é um só", async () => {
    h.insights = [
      {
        id: "i1",
        reuniao_id: "r1",
        categoria: "dor",
        texto: "Medição manual",
        citacao: "perdemos tempo conferindo medição",
        modulo_pilar: "Obras",
        removido: false,
        reuniao: { origem_nome: "Escritório A", origem_contato: "frio" },
      },
    ];
    h.reunioes = [{ origem_contato: "parente" }, { origem_contato: "frio" }];
    renderComQuery(<Cerebro />);

    expect(await screen.findByText(/1 reunião, 1 escritório \(hipótese\)/)).toBeInTheDocument();
    expect(screen.getByText("perdemos tempo conferindo medição")).toBeInTheDocument();
    expect(await screen.findByRole("note")).toHaveTextContent("50% das reuniões vieram de parente");
  });

  it("sem achados, mostra o estado vazio", async () => {
    renderComQuery(<Cerebro />);
    expect(await screen.findByText("Nenhum tema ainda")).toBeInTheDocument();
  });
});
