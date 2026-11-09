import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { MetaRow, MetaView } from "@/lib/metas";
import { MetaCard } from "./MetaCard";

/**
 * Cartão de meta: subtítulo (indicador e período), valor restrito sem número,
 * alvo "por período" e histórico sob demanda só para meta recorrente com indicador.
 */

const h = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: h.rpc } }));

const META: MetaRow = {
  id: "m1",
  nome: "Entregar 10 projetos",
  alvo: 10,
  atual: 2,
  prazo: "2026-12-31",
  categoria: null,
  pessoa_id: null,
  descricao: null,
  unidade: "quantity",
  unidade_rotulo: null,
  indicador: null,
  periodo_inicio: null,
  recorrencia: "nenhuma",
  created_at: "2026-01-01T00:00:00Z",
};

const view = (meta: Partial<MetaRow> = {}, v: Partial<MetaView> = {}): MetaView => ({
  meta: { ...META, ...meta },
  atual: 2,
  restrito: false,
  janelaInicio: null,
  janelaFim: null,
  percent: 20,
  status: "em_andamento",
  ...v,
});

function renderCard(v: MetaView) {
  const onEdit = vi.fn();
  const onDelete = vi.fn();
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MetaCard view={v} onEdit={onEdit} onDelete={onDelete} />
    </QueryClientProvider>
  );
  return { onEdit, onDelete, user: userEvent.setup() };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("MetaCard", () => {
  it("meta manual: subtítulo com prazo, percentual e sem histórico", async () => {
    const { user, onEdit, onDelete } = renderCard(view());
    expect(screen.getByText("Entregar 10 projetos")).toBeInTheDocument();
    expect(screen.getByText("Manual · até 31/12/2026")).toBeInTheDocument();
    expect(screen.getByText("20%")).toBeInTheDocument();
    expect(screen.getByText("Alvo")).toBeInTheDocument();
    expect(screen.queryByText("Histórico")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Editar meta" }));
    await user.click(screen.getByRole("button", { name: "Excluir meta" }));
    expect(onEdit).toHaveBeenCalledOnce();
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it("valor restrito esconde percentual e valor atual", () => {
    renderCard(
      view({ indicador: "lucro", unidade: "currency", alvo: 50000 }, { restrito: true, atual: null, percent: 0 })
    );
    expect(screen.getByText("Sem acesso ao valor")).toBeInTheDocument();
    expect(screen.queryByText("0%")).not.toBeInTheDocument();
    expect(screen.getByText(/^Lucro · /)).toBeInTheDocument();
  });

  it("indicador pontual mostra 'hoje' no subtítulo", () => {
    renderCard(view({ indicador: "projetos_ativos", recorrencia: "mensal" }));
    expect(screen.getByText(/ · hoje$/)).toBeInTheDocument();
  });

  it("recorrente com indicador: abre o histórico e lista os períodos, inclusive restritos", async () => {
    h.rpc.mockResolvedValue({
      data: [
        { janela_inicio: "2026-11-01", janela_fim: "2026-11-30", atual: 10, restrito: false },
        { janela_inicio: "2026-10-01", janela_fim: "2026-10-31", atual: null, restrito: true },
      ],
      error: null,
    });
    const { user } = renderCard(
      view(
        { indicador: "projetos_concluidos", recorrencia: "mensal" },
        { janelaInicio: "2026-11-01", janelaFim: "2026-11-30", percent: 100, status: "concluida", atual: 10 }
      )
    );
    expect(screen.getByText("Alvo por período")).toBeInTheDocument();
    expect(screen.getByText(/Todo mês/)).toBeInTheDocument();
    expect(h.rpc).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /Histórico/ }));
    expect(await screen.findByText("Sem acesso")).toBeInTheDocument();
    expect(screen.getByText(/\(100%\)/)).toBeInTheDocument();
    expect(h.rpc).toHaveBeenCalledWith("rpc_meta_historico", { p_meta_id: "m1", p_periodos: 6 });
  });

  it("erro do histórico mostra aviso em vez de lista vazia silenciosa", async () => {
    h.rpc.mockResolvedValue({ data: null, error: { message: "permission denied" } });
    const { user } = renderCard(view({ indicador: "projetos_concluidos", recorrencia: "trimestral" }));
    await user.click(screen.getByRole("button", { name: /Histórico/ }));
    expect(await screen.findByText("Não foi possível carregar o histórico.")).toBeInTheDocument();
  });
});
