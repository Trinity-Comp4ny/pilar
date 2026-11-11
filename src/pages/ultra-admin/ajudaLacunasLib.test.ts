import { describe, expect, it } from "vitest";
import { agruparLacunas } from "./ajudaLacunasLib";

describe("agruparLacunas (SPEC 155)", () => {
  it("junta a mesma pergunta, conta escritórios e telas, mais repetida primeiro", () => {
    const linhas = [
      {
        texto: "nota fiscal",
        rota: "/gestao/financeiro",
        origem: "agente",
        empresa_id: "e1",
        created_at: "2026-11-01T10:00:00Z",
      },
      {
        texto: "nota fiscal",
        rota: "/inicio",
        origem: "central",
        empresa_id: "e2",
        created_at: "2026-11-03T10:00:00Z",
      },
      { texto: "nota fiscal", rota: "/inicio", origem: "agente", empresa_id: "e2", created_at: "2026-11-02T10:00:00Z" },
      { texto: "gantt", rota: null, origem: "agente", empresa_id: null, created_at: "2026-11-04T10:00:00Z" },
    ];
    expect(agruparLacunas(linhas)).toEqual([
      {
        texto: "nota fiscal",
        vezes: 3,
        escritorios: 2,
        telas: ["/gestao/financeiro", "/inicio"],
        ultima: "2026-11-03T10:00:00Z",
      },
      { texto: "gantt", vezes: 1, escritorios: 0, telas: [], ultima: "2026-11-04T10:00:00Z" },
    ]);
  });
});
