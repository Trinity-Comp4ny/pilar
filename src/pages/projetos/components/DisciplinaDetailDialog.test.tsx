import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { DisciplinaResponsavel } from "@/types/projetos";

// Detalhe da disciplina: status (com trava do checklist incompleto), pausar com motivo e
// erro do banco, revisões (registrar/concluir/histórico), checklist, descrição, comentários
// com menção, observação pré-save, excluir com confirmação e a disciplina ainda não salva.

const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("@/hooks/useComentarioAutoria", () => ({
  useComentarioAutoria: () => ({ autorId: "u-eu", podeExcluir: () => false }),
}));
vi.mock("sonner", () => ({ toast }));
const pausas = vi.hoisted(() => ({
  data: [] as unknown[],
  pausar: vi.fn(),
  retomar: vi.fn(),
}));
vi.mock("@/pages/projetos/hooks/useDisciplinaPausas", async (orig) => ({
  ...(await orig<typeof import("@/pages/projetos/hooks/useDisciplinaPausas")>()),
  useDisciplinaPausas: () => ({
    data: pausas.data,
    pausar: { mutate: pausas.pausar, isPending: false },
    retomar: { mutate: pausas.retomar, isPending: false },
  }),
}));
const check = vi.hoisted(() => ({ data: [] as unknown[], add: vi.fn(), toggle: vi.fn(), remove: vi.fn() }));
vi.mock("@/pages/projetos/hooks/useProjetoDisciplinaChecklist", () => ({
  useDisciplinaChecklist: () => ({
    data: check.data,
    addItem: { mutate: check.add },
    toggleItem: { mutate: check.toggle },
    removeItem: { mutate: check.remove },
  }),
}));
const rev = vi.hoisted(() => ({ data: [] as unknown[], registrar: vi.fn(), concluir: vi.fn() }));
vi.mock("@/pages/projetos/hooks/useDisciplinaRevisoes", async (orig) => ({
  ...(await orig<typeof import("@/pages/projetos/hooks/useDisciplinaRevisoes")>()),
  useDisciplinaRevisoes: () => ({
    data: rev.data,
    registrar: { mutate: rev.registrar, isPending: false },
    concluir: { mutate: rev.concluir, isPending: false },
  }),
}));
const mencao = vi.hoisted(() => vi.fn());
vi.mock("@/lib/notificarMencao", () => ({ notificarMencao: mencao }));
vi.mock("./AtividadeComposer", () => ({
  AtividadeComposer: ({ onSubmit }: { onSubmit: (t: string, m: string[]) => void }) => (
    <button onClick={() => onSubmit("Revisar a laje", ["pes-2"])}>enviar-comentario</button>
  ),
}));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));

Element.prototype.scrollIntoView ??= () => {};
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

import { DisciplinaDetailDialog } from "./DisciplinaDetailDialog";

const base = {
  id: "d-1",
  codigo: "EST-01",
  disciplina: "Estrutural",
  responsavel_id: "pes-1",
  responsavel_nome: "Ana",
  responsaveis: [{ responsavel_id: "pes-1", responsavel_nome: "Ana" }],
  status: "Em Andamento",
  prioridade: "Alta",
  data_inicio: "2026-10-01",
  data_previsao: "2026-12-01",
  descricao: "Lajes e pilares",
  labels: ["urgente"],
  links: [],
  comentarios: [],
  horas_estimadas: 10,
  horas_realizadas: 2,
} as unknown as DisciplinaResponsavel;

function montar(over: Partial<Parameters<typeof DisciplinaDetailDialog>[0]> = {}) {
  const h = {
    onOpenChange: vi.fn(),
    onUpdateField: vi.fn(),
    onUpdateResponsaveis: vi.fn(),
    onUpdateLabels: vi.fn(),
    onUpdateLinks: vi.fn(),
    onUpdateComentarios: vi.fn().mockResolvedValue(undefined),
    onUpdateDescricao: vi.fn(),
    onUpdateHorasEstimadas: vi.fn(),
    onUpdateHorasRealizadas: vi.fn(),
    onDelete: vi.fn(),
  };
  render(
    <DisciplinaDetailDialog
      open
      disciplina={base}
      disciplinas={[
        { id: "c-1", nome: "Estrutural" },
        { id: "c-2", nome: "Elétrica" },
      ]}
      pessoas={[
        { id: "pes-1", nome: "Ana" },
        { id: "pes-2", nome: "Bruno" },
      ]}
      autorNome="Dev"
      projetoDataInicio="2026-09-01"
      projetoDataPrevisao="2027-01-31"
      {...h}
      {...over}
    />
  );
  return h;
}

const comboDe = (rotulo: string) =>
  screen.getByText(rotulo, { selector: "span" }).closest("div.flex")!.querySelector('[role="combobox"]') as HTMLElement;

describe("DisciplinaDetailDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pausas.data = [];
    check.data = [];
    rev.data = [];
    mencao.mockResolvedValue(undefined);
  });

  it("mostra cabeçalho, propriedades e o vazio de comentários", () => {
    montar();
    expect(screen.getByRole("heading", { name: "Estrutural" })).toBeInTheDocument();
    expect(screen.getByText("EST-01")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Lajes e pilares")).toBeInTheDocument();
    expect(screen.getByText("Nenhum comentário ainda")).toBeInTheDocument();
    expect(screen.getByText("urgente")).toBeInTheDocument();
  });

  it("trocar status, prioridade e disciplina chamam o handler do campo", () => {
    const h = montar();
    const status = screen.getAllByRole("combobox")[0];
    fireEvent.keyDown(status, { key: "Enter" });
    fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: "Concluído" }));
    expect(h.onUpdateField).toHaveBeenCalledWith("status", "Concluído");

    fireEvent.keyDown(comboDe("Prioridade"), { key: "Enter" });
    fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: /Baixa/ }));
    expect(h.onUpdateField).toHaveBeenCalledWith("prioridade", "Baixa");

    fireEvent.keyDown(comboDe("Disciplina"), { key: "Enter" });
    fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: "Elétrica" }));
    expect(h.onUpdateField).toHaveBeenCalledWith("disciplina", "Elétrica");
  });

  it("checklist incompleto trava Concluído; itens marcam, removem e adicionam", () => {
    check.data = [
      { id: "i-1", texto: "Memorial", concluido: true, ordem: 0 },
      { id: "i-2", texto: "Pranchas", concluido: false, ordem: 1 },
    ];
    montar();
    expect(screen.getByText("1/2")).toBeInTheDocument();
    fireEvent.keyDown(screen.getAllByRole("combobox")[0], { key: "Enter" });
    expect(within(screen.getByRole("listbox")).getByRole("option", { name: "Concluído" })).toHaveAttribute(
      "aria-disabled",
      "true"
    );
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape" });

    fireEvent.click(screen.getAllByRole("checkbox")[1]);
    expect(check.toggle).toHaveBeenCalledWith({ id: "i-2", concluido: true });
    fireEvent.click(screen.getByRole("button", { name: "Remover item Memorial" }));
    expect(check.remove).toHaveBeenCalledWith("i-1");

    const novo = screen.getByPlaceholderText("Adicionar item…");
    expect(screen.getByRole("button", { name: "Adicionar item ao checklist" })).toBeDisabled();
    fireEvent.change(novo, { target: { value: "  ART " } });
    fireEvent.keyDown(novo, { key: "Enter" });
    expect(check.add).toHaveBeenCalledWith("ART");
    fireEvent.change(novo, { target: { value: "RRT" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar item ao checklist" }));
    expect(check.add).toHaveBeenCalledWith("RRT");
  });

  it("pausar exige motivo e mostra o erro do banco", async () => {
    pausas.pausar.mockImplementation((_m: string, o: { onError: (e: unknown) => void }) =>
      o.onError({ code: "P0001", message: "Disciplina pausada junto com o projeto. Retome o projeto." })
    );
    montar();
    fireEvent.click(screen.getByRole("button", { name: /Pausar/ }));
    fireEvent.change(await screen.findByLabelText("Motivo da pausa"), { target: { value: " chuva " } });
    fireEvent.click(screen.getAllByRole("button", { name: /Pausar/ }).at(-1)!);
    await waitFor(() => expect(pausas.pausar).toHaveBeenCalledWith("chuva", expect.anything()));
    expect(toast.error).toHaveBeenCalledWith("Disciplina pausada junto com o projeto. Retome o projeto.");
  });

  it("pausar com sucesso mostra o estado devolvido pelo banco", async () => {
    pausas.pausar.mockImplementation((_m: string, o: { onSuccess: (e: unknown) => void }) =>
      o.onSuccess({ status: "Pausada", data_inicio: "2026-10-01", data_fim: "2026-12-01" })
    );
    montar();
    fireEvent.click(screen.getByRole("button", { name: /Pausar/ }));
    fireEvent.change(await screen.findByLabelText("Motivo da pausa"), { target: { value: "cliente" } });
    fireEvent.click(screen.getAllByRole("button", { name: /Pausar/ }).at(-1)!);
    await waitFor(() => expect(pausas.pausar).toHaveBeenCalled());
  });

  it("retomar com erro genérico usa a mensagem padrão", () => {
    pausas.data = [{ id: "pa", motivo: "x", pausado_em: "2026-10-20T10:00:00Z", retomado_em: null }];
    pausas.retomar.mockImplementation((_v: unknown, o: { onError: (e: unknown) => void }) => o.onError(new Error("x")));
    montar();
    fireEvent.click(screen.getByRole("button", { name: /Retomar/ }));
    expect(toast.error).toHaveBeenCalledWith("Não foi possível retomar a disciplina. Tente de novo.");
  });

  it("registrar revisão exige motivo; concluir a aberta; histórico aparece", async () => {
    rev.registrar.mockImplementation((_v: unknown, o: { onSuccess: () => void }) => o.onSuccess());
    montar();
    fireEvent.click(screen.getByRole("button", { name: /Registrar revisão/ }));
    const motivo = await screen.findByPlaceholderText("Ex.: cliente pediu mudar a posição do pilar P12");
    fireEvent.change(motivo, { target: { value: "  mover pilar P3 " } });
    fireEvent.click(screen.getAllByRole("button", { name: /Registrar/ }).at(-1)!);
    await waitFor(() =>
      expect(rev.registrar).toHaveBeenCalledWith(
        { motivo: "mover pilar P3", solicitadaEm: undefined },
        expect.anything()
      )
    );
  });

  it("revisão em aberto vira o botão de concluir e o histórico é listado", () => {
    rev.data = [
      {
        id: "r-2",
        motivo: "ajustar cotas",
        solicitada_em: "2026-10-10",
        concluida_em: null,
        registrada_por_nome: "Ana",
        concluida_por_nome: null,
      },
      {
        id: "r-1",
        motivo: "trocar viga",
        solicitada_em: "2026-09-10",
        concluida_em: "2026-09-12",
        registrada_por_nome: null,
        concluida_por_nome: "Bruno",
      },
    ];
    montar();
    expect(screen.getByText("2 revisões")).toBeInTheDocument();
    expect(screen.getByText(/em aberto/)).toBeInTheDocument();
    expect(screen.getByText(/concluída por Bruno/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Concluir revisão/ }));
    expect(rev.concluir).toHaveBeenCalledWith("r-2");
  });

  it("descrição só grava ao sair do campo e se mudou", () => {
    const h = montar();
    const campo = screen.getByPlaceholderText("Detalhes, escopo, o que precisa ser entregue...");
    fireEvent.blur(campo);
    expect(h.onUpdateDescricao).not.toHaveBeenCalled();
    fireEvent.change(campo, { target: { value: "Lajes, pilares e fundação" } });
    fireEvent.blur(campo);
    expect(h.onUpdateDescricao).toHaveBeenCalledWith("Lajes, pilares e fundação");
  });

  it("comentário com menção grava e notifica", async () => {
    const h = montar();
    fireEvent.click(screen.getByRole("button", { name: "enviar-comentario" }));
    await waitFor(() => expect(h.onUpdateComentarios).toHaveBeenCalled());
    expect(h.onUpdateComentarios.mock.calls[0][0][0]).toMatchObject({
      texto: "Revisar a laje",
      autor: "Dev",
      mencionados: ["pes-2"],
    });
    await waitFor(() =>
      expect(mencao).toHaveBeenCalledWith("disciplina", "d-1", ["pes-2"], "Revisar a laje", expect.any(String))
    );
  });

  it("comentário destacado vem do link de notificação", () => {
    montar({
      disciplina: {
        ...base,
        comentarios: [{ id: "c-9", texto: "olha isso", autor: "Ana", data: "2026-10-01T10:00:00Z" }],
      } as DisciplinaResponsavel,
      comentarioDestacado: "c-9",
    });
    expect(screen.getByText("olha isso")).toBeInTheDocument();
  });

  it("excluir pede confirmação", () => {
    const h = montar();
    fireEvent.click(screen.getByRole("button", { name: /Excluir/ }));
    expect(screen.getByText("Excluir disciplina")).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Excluir" }));
    expect(h.onDelete).toHaveBeenCalled();
  });

  it("disciplina ainda não salva: sem checklist, pausa, revisão ou exclusão; observação simples", () => {
    const onAddObservation = vi.fn();
    const onNewObservationChange = vi.fn();
    montar({
      disciplina: { ...base, id: undefined } as unknown as DisciplinaResponsavel,
      onUpdateComentarios: undefined,
      onAddObservation,
      onNewObservationChange,
      newObservation: "rascunho",
    });
    expect(screen.queryByPlaceholderText("Adicionar item…")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Pausar|Registrar revisão|Excluir/ })).not.toBeInTheDocument();
    const obs = screen.getByPlaceholderText("Nova observação...");
    fireEvent.change(obs, { target: { value: "x" } });
    expect(onNewObservationChange).toHaveBeenCalledWith("x");
    fireEvent.keyDown(obs, { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar observação" }));
    expect(onAddObservation).toHaveBeenCalledTimes(2);
  });

  it("sem como comentar pede para salvar antes", () => {
    montar({
      disciplina: { ...base, id: undefined } as unknown as DisciplinaResponsavel,
      onUpdateComentarios: undefined,
    });
    expect(screen.getByText("Salve a disciplina para comentar.")).toBeInTheDocument();
  });

  it("disciplina nula não renderiza o corpo", () => {
    montar({ disciplina: null });
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });
});
