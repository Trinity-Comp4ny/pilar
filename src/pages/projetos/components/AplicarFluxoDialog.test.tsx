import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const mutateAsync = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock("sonner", () => ({ toast }));
vi.mock("@/hooks/useProjetoDisciplinas", () => ({
  useAplicarFluxoNoProjeto: () => ({ mutateAsync, isPending: false }),
}));
vi.mock("@/components/ui/date-picker", () => ({
  DatePicker: ({ value, onChange }: { value?: string; onChange: (v: string) => void }) => (
    <input aria-label="Início" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
  ),
}));
vi.mock("./FluxoPipelineGraph", () => ({
  FluxoPipelineGraph: ({
    stages,
  }: {
    stages: {
      key: string;
      nodes: { key: string; titulo: string; status: string; metaLabel?: string; checklistLabel?: string }[];
    }[];
  }) => (
    <ul data-testid="grafo">
      {stages.map((s) => (
        <li key={s.key} data-testid={`coluna-${s.key}`}>
          {s.nodes.map((n) => (
            <span key={n.key}>
              {n.titulo}|{n.status}|{n.metaLabel ?? ""}|{n.checklistLabel ?? ""}
            </span>
          ))}
        </li>
      ))}
    </ul>
  ),
}));

import { AplicarFluxoDialog } from "./AplicarFluxoDialog";
import type { FluxoDisciplinas } from "@/types/fluxoDisciplinas";
import type { ProjetoDisciplinaDB } from "@/types/projetos";

const fluxoA: FluxoDisciplinas = {
  id: "f1",
  empresa_id: "emp-1",
  nome: "Residencial",
  descricao: null,
  ativo: true,
  created_at: "2026-01-01",
  disciplinas: [
    {
      ordem: 1,
      nome: "Arquitetura",
      duracao_dias_uteis: 5,
      checklist_padrao: [{ texto: "Planta" }, { texto: "Corte" }],
    },
    { ordem: 2, nome: "Estrutural", duracao_dias_uteis: 5 },
    { ordem: 2, nome: "Hidráulica" },
  ],
};
const fluxoB: FluxoDisciplinas = {
  ...fluxoA,
  id: "f2",
  nome: "Simples",
  disciplinas: [{ ordem: 1, nome: "Elétrica" }],
};

const db = (id: string, nome: string, status: string) => ({ id, nome, status }) as unknown as ProjetoDisciplinaDB;

beforeEach(() => {
  mutateAsync.mockReset();
  toast.success.mockReset();
  toast.error.mockReset();
});

describe("AplicarFluxoDialog", () => {
  it("com um fluxo só, já pré-seleciona e mostra o plano (novas, encaixadas e avulsas)", () => {
    render(
      <AplicarFluxoDialog
        open
        onOpenChange={vi.fn()}
        projetoId="p1"
        projetoDataInicio="2026-03-02"
        dbDisciplinas={[
          db("d1", "Estrutural", "Em Andamento"),
          db("d2", "Hidráulica", "Concluído"),
          db("d3", "Paisagismo", "Não Iniciado"),
          db("d4", "Fachada", "Não Iniciado"),
        ]}
        fluxos={[fluxoA]}
      />
    );
    expect(
      screen.getByText(/1 nova, 2 já existem e entram na coluna, 2 fora do fluxo continuam avulsas\./)
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId("coluna-1")).getByText(/Arquitetura\|nao_iniciado\|.+\|2 itens/)
    ).toBeInTheDocument();
    const col2 = screen.getByTestId("coluna-2");
    expect(within(col2).getByText("Estrutural|em_andamento|já no projeto|")).toBeInTheDocument();
    expect(within(col2).getByText("Hidráulica|concluido|já no projeto|")).toBeInTheDocument();
  });

  it("singular: 1 encaixada e 1 avulsa; disciplina nova sem data mostra sem meta", () => {
    render(
      <AplicarFluxoDialog
        open
        onOpenChange={vi.fn()}
        projetoId="p1"
        dbDisciplinas={[db("d1", "Estrutural", "x"), db("d9", "Outra", "x")]}
        fluxos={[
          {
            ...fluxoA,
            disciplinas: [
              { ordem: 1, nome: "Estrutural" },
              { ordem: 1, nome: "Nova A" },
              { ordem: 3, nome: "Nova B" },
            ],
          },
        ]}
      />
    );
    expect(
      screen.getByText(/2 novas, 1 já existe e entra na coluna, 1 fora do fluxo continua avulsa\./)
    ).toBeInTheDocument();
    expect(screen.getByText("Estrutural|nao_iniciado|já no projeto|")).toBeInTheDocument();
  });

  it("com vários fluxos começa sem plano e com o envio bloqueado; escolher habilita", async () => {
    render(
      <AplicarFluxoDialog open onOpenChange={vi.fn()} projetoId="p1" dbDisciplinas={[]} fluxos={[fluxoA, fluxoB]} />
    );
    expect(screen.queryByTestId("grafo")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aplicar fluxo" })).toBeDisabled();

    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
    const lista = screen.getByRole("listbox");
    expect(within(lista).getByRole("option", { name: "Residencial (2 colunas)" })).toBeInTheDocument();
    fireEvent.click(within(lista).getByRole("option", { name: "Simples (1 coluna)" }));

    expect(screen.getByText(/^1 nova\.$/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aplicar fluxo" })).toBeEnabled();

    // Data vazia não quebra o plano (cai no início indefinido).
    fireEvent.change(screen.getByLabelText("Início"), { target: { value: "" } });
    expect(screen.getByTestId("grafo")).toBeInTheDocument();
  });

  it("aplica o fluxo, avisa e fecha", async () => {
    mutateAsync.mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    render(
      <AplicarFluxoDialog
        open
        onOpenChange={onOpenChange}
        projetoId="p1"
        dbDisciplinas={[db("d1", "Estrutural", "x")]}
        fluxos={[fluxoA]}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Aplicar fluxo" }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ projetoId: "p1", plano: expect.objectContaining({ encaixadas: [expect.anything()] }) })
    );
    expect(toast.success).toHaveBeenCalledWith("Fluxo aplicado", {
      description: '2 disciplina(s) criada(s) e 1 encaixada(s) em "Residencial"',
    });
  });

  it("falha ao aplicar mostra erro e mantém o diálogo aberto", async () => {
    mutateAsync.mockRejectedValue(new Error("RLS negou"));
    const onOpenChange = vi.fn();
    render(<AplicarFluxoDialog open onOpenChange={onOpenChange} projetoId="p1" dbDisciplinas={[]} fluxos={[fluxoB]} />);
    fireEvent.click(screen.getByRole("button", { name: "Aplicar fluxo" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.error.mock.calls[0][1].description).toContain("RLS negou");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("enviar sem fluxo escolhido não chama a mutação", () => {
    render(
      <AplicarFluxoDialog open onOpenChange={vi.fn()} projetoId="p1" dbDisciplinas={[]} fluxos={[fluxoA, fluxoB]} />
    );
    fireEvent.submit(screen.getByRole("button", { name: "Aplicar fluxo" }).closest("form")!);
    expect(mutateAsync).not.toHaveBeenCalled();
  });
});
