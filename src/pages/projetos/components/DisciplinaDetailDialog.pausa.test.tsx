import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { EstadoDaDisciplina } from "@/pages/projetos/lib/pausa";
import type { DisciplinaResponsavel } from "@/types/projetos";

// BEZ-460: pausar e retomar mexem em status e prazo no banco (RPC). O diálogo não pode regravar a
// disciplina com o snapshot do pai (prazo de antes da retomada); mostra o estado que o RPC devolveu.

const mutate = vi.fn();
let pausasAbertas = false;

vi.mock("@/pages/projetos/hooks/useDisciplinaPausas", async (importar) => ({
  ...(await importar<typeof import("@/pages/projetos/hooks/useDisciplinaPausas")>()),
  useDisciplinaPausas: () => ({
    data: pausasAbertas
      ? [{ id: "pa-1", motivo: "obra parada", pausado_em: "2026-10-24T12:00:00Z", retomado_em: null }]
      : [],
    pausar: { mutate, isPending: false },
    retomar: { mutate, isPending: false },
  }),
}));
vi.mock("@/pages/projetos/hooks/useProjetoDisciplinaChecklist", () => ({
  useDisciplinaChecklist: () => ({
    data: [],
    add: { mutate: vi.fn() },
    toggle: { mutate: vi.fn() },
    remove: { mutate: vi.fn() },
  }),
}));
vi.mock("@/pages/projetos/hooks/useDisciplinaRevisoes", async (importar) => ({
  ...(await importar<typeof import("@/pages/projetos/hooks/useDisciplinaRevisoes")>()),
  useDisciplinaRevisoes: () => ({ data: [], registrar: { mutate: vi.fn() }, concluir: { mutate: vi.fn() } }),
}));
vi.mock("./AtividadeComposer", () => ({ AtividadeComposer: () => null }));

import { DisciplinaDetailDialog } from "./DisciplinaDetailDialog";

const disciplina = {
  id: "disc-1",
  disciplina: "Climatização",
  responsavel_id: "pe-1",
  responsavel_nome: "Matheus",
  status: "Pausada",
  data_inicio: "2026-10-27",
  data_previsao: "2026-11-03",
} as DisciplinaResponsavel;

const estadoRetomado: EstadoDaDisciplina = {
  status: "Em Andamento",
  data_inicio: "2026-10-27",
  data_fim: "2026-11-08",
};

function abrir(onUpdateField = vi.fn()) {
  render(
    <DisciplinaDetailDialog
      open
      onOpenChange={vi.fn()}
      disciplina={disciplina}
      disciplinas={[{ id: "d1", nome: "Climatização" }]}
      pessoas={[{ id: "pe-1", nome: "Matheus" }]}
      onUpdateField={onUpdateField}
      onUpdateResponsaveis={vi.fn()}
    />
  );
  return onUpdateField;
}

describe("DisciplinaDetailDialog, retomar disciplina", () => {
  beforeEach(() => {
    mutate.mockReset();
    pausasAbertas = true;
  });

  it("mostra o prazo empurrado e não regrava a disciplina", () => {
    mutate.mockImplementation((_vars, opcoes) => opcoes.onSuccess(estadoRetomado));
    const onUpdateField = abrir();
    expect(screen.getByText("03/11/2026")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Retomar/ }));

    expect(onUpdateField).not.toHaveBeenCalled();
    expect(screen.getByText("08/11/2026")).toBeInTheDocument();
    expect(screen.queryByText("03/11/2026")).not.toBeInTheDocument();
  });
});
