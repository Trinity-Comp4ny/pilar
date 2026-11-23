import { describe, expect, it } from "vitest";
import { montarArvoreCronograma } from "./obraArvore";
import { cronogramaParaCsv } from "./cronogramaCsv";

const no = (
  id: string,
  parent_id: string | null,
  nivel: string,
  nome: string,
  ini: string | null,
  fim: string | null
) => ({
  id,
  parent_id,
  nivel,
  nome,
  ordem: 0,
  data_inicio: ini,
  data_fim: fim,
  created_at: "2026-01-01",
});
const tarefa = (id: string, obra_frente_id: string, titulo: string, status: string) => ({
  id,
  obra_frente_id,
  titulo,
  status,
  data_inicio: "2026-03-02",
  prazo: "2026-03-10",
  created_at: "2026-01-01",
});

describe("cronogramaParaCsv", () => {
  const nos = [
    no("f", null, "fase", "Estrutura", "2026-03-01", "2026-05-30"),
    no("s", "f", "servico", "=Brocas", null, null),
  ];
  const tarefas = [tarefa("t1", "s", "Escavar", "concluida"), tarefa("t2", "s", 'Concretar "A"', "a_fazer")];

  it("uma linha por nível, na ordem da árvore, com avanço", () => {
    const linhas = cronogramaParaCsv(montarArvoreCronograma(nos, tarefas).fases).split("\n");
    expect(linhas[0]).toBe('"Nível";"Item";"Início";"Fim";"Avanço (%)"');
    expect(linhas[1]).toContain('"Fase";"Estrutura"');
    expect(linhas[1].endsWith('"50"')).toBe(true);
    expect(linhas[3]).toContain('"Tarefa";"    Escavar"');
    expect(linhas[3].endsWith('"100"')).toBe(true);
  });

  it("escapa aspas e neutraliza fórmula no começo da célula", () => {
    const csv = cronogramaParaCsv(
      montarArvoreCronograma(
        [no("f", null, "fase", "=cmd", null, null)],
        [tarefa("t", "f", 'Concretar "A"', "a_fazer")]
      ).fases
    );
    expect(csv).toContain('"\'=cmd"');
    expect(csv).toContain('Concretar ""A""');
  });
});
