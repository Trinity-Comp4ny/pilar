import { describe, expect, it } from "vitest";
import { ordenarReleases, type ReleaseAdmin } from "./releases";

const r = (id: string, criadaEm: string, publicadaEm: string | null): ReleaseAdmin => ({
  id,
  sha: null,
  titulo: id,
  versao: null,
  criadaEm,
  publicadaEm,
  itens: [],
});

describe("ordenarReleases (SPEC 152)", () => {
  it("rascunho vem primeiro, depois as publicadas da mais nova para a mais velha", () => {
    const lista = [
      r("pub-velha", "2026-10-01T00:00:00Z", "2026-10-02T00:00:00Z"),
      r("rascunho", "2026-09-01T00:00:00Z", null),
      r("pub-nova", "2026-11-01T00:00:00Z", "2026-11-02T00:00:00Z"),
    ];
    expect(ordenarReleases(lista).map((x) => x.id)).toEqual(["rascunho", "pub-nova", "pub-velha"]);
  });
});
