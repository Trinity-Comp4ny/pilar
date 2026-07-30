import { describe, it, expect } from "vitest";
import {
  buildEventosTarefas,
  buildEventosDisciplinas,
  filtrarVisiveis,
  addDays,
  fmtKey,
  todayKey,
  type PrazoEvento,
} from "./eventos";

const hoje = todayKey();
const ontem = fmtKey(addDays(new Date(), -1));
const em3dias = fmtKey(addDays(new Date(), 3));
const em30dias = fmtKey(addDays(new Date(), 30));

describe("buildEventosTarefas", () => {
  it("ignora tarefa sem prazo", () => {
    const eventos = buildEventosTarefas([{ id: "1", titulo: "sem prazo", prazo: null, concluida: false }]);
    expect(eventos).toHaveLength(0);
  });

  it("marca camada tarefa e classifica o estado pela data", () => {
    const eventos = buildEventosTarefas([
      { id: "atrasada", titulo: "a", prazo: ontem, concluida: false },
      { id: "proxima", titulo: "b", prazo: em3dias, concluida: false },
      { id: "futura", titulo: "c", prazo: em30dias, concluida: false },
      { id: "feita", titulo: "d", prazo: ontem, concluida: true },
    ]);
    const porId = Object.fromEntries(eventos.map((e) => [e.id, e]));
    expect(porId.atrasada.camada).toBe("tarefa");
    expect(porId.atrasada.estado).toBe("atrasado");
    expect(porId.proxima.estado).toBe("proximo");
    expect(porId.futura.estado).toBe("futuro");
    // concluída vence a data: mesmo vencida ontem, fica "concluido".
    expect(porId.feita.estado).toBe("concluido");
  });

  it("usa 'Tarefa avulsa' como subtítulo quando não há projeto", () => {
    const [e] = buildEventosTarefas([{ id: "1", titulo: "x", prazo: hoje, concluida: false }]);
    expect(e.subtitulo).toBe("Tarefa avulsa");
  });
});

describe("buildEventosDisciplinas", () => {
  it("carrega o projetoId e ignora disciplina sem prazo", () => {
    const eventos = buildEventosDisciplinas([
      { id: "com", titulo: "Estrutural", prazo: em3dias, concluida: false, projetoId: "p1", projetoNome: "Obra A" },
      { id: "sem", titulo: "Elétrica", prazo: null, concluida: false, projetoId: "p1" },
    ]);
    expect(eventos).toHaveLength(1);
    expect(eventos[0].camada).toBe("disciplina");
    expect(eventos[0].projetoId).toBe("p1");
    expect(eventos[0].subtitulo).toBe("Obra A");
  });
});

describe("filtrarVisiveis", () => {
  const base: PrazoEvento[] = [
    { id: "d", data: hoje, camada: "disciplina", estado: "futuro", titulo: "D", status: "" },
    { id: "t", data: hoje, camada: "tarefa", estado: "futuro", titulo: "T", status: "" },
    { id: "p", data: hoje, camada: "projeto", estado: "futuro", titulo: "P", status: "" },
  ];

  it("esconde só as camadas explicitamente desligadas", () => {
    const visiveis = filtrarVisiveis(base, { disciplina: true, tarefa: true });
    // projeto não está no mapa (undefined) → tratado como visível.
    expect(visiveis.map((e) => e.camada).sort()).toEqual(["disciplina", "projeto", "tarefa"]);
  });

  it("remove a camada projeto no escopo pessoal (desligada)", () => {
    const visiveis = filtrarVisiveis(base, { disciplina: true, tarefa: true, projeto: false });
    expect(visiveis.map((e) => e.camada).sort()).toEqual(["disciplina", "tarefa"]);
  });
});
