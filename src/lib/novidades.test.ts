import { describe, expect, it } from "vitest";
import { contagemNovidades, lerNovidades, novidadesPendentes, releaseDoSha, type NovidadeRelease } from "./novidades";

const item = (id: string, impacto: "fluxo" | "melhoria" | "correcao", modulo: string | null = null) => ({
  id,
  texto: `item ${id}`,
  impacto,
  modulo,
  voce_pediu: false,
});

const release = (id: string, nova: boolean, itens: NovidadeRelease["itens"], sha: string | null = null) => ({
  id,
  sha,
  titulo: id,
  versao: null,
  publicada_em: "2026-11-10T12:00:00Z",
  nova,
  itens,
});

const todos = () => true;

describe("novidades (SPEC 152)", () => {
  it("resposta fora do formato vira lista vazia", () => {
    expect(lerNovidades(null).releases).toEqual([]);
    expect(lerNovidades({ releases: [{ id: 1 }] }).releases).toEqual([]);
  });

  it("só release nova com mudança de fluxo abre o modal", () => {
    const releases = [release("velha", false, [item("a", "fluxo")]), release("nova", true, [item("b", "melhoria")])];
    expect(novidadesPendentes(releases, todos).comFluxo).toEqual([]);
    expect(novidadesPendentes(releases, todos).temDestaque).toBe(true);

    const comFluxo = novidadesPendentes([release("nova", true, [item("c", "fluxo")])], todos);
    expect(comFluxo.comFluxo.map((r) => r.id)).toEqual(["nova"]);
  });

  it("correção sozinha não acende o ponto", () => {
    expect(novidadesPendentes([release("nova", true, [item("a", "correcao")])], todos).temDestaque).toBe(false);
  });

  it("item de módulo que a pessoa não acessa não abre modal nem acende o ponto", () => {
    const releases = [release("nova", true, [item("a", "fluxo", "financeiro"), item("b", "melhoria", "financeiro")])];
    const semFinanceiro = (m: string) => m !== "financeiro";
    expect(novidadesPendentes(releases, semFinanceiro)).toEqual({ comFluxo: [], temDestaque: false });
    expect(novidadesPendentes(releases, todos).comFluxo).toHaveLength(1);
  });

  it("acha a release pelo sha curto ou longo", () => {
    const releases = [release("r", true, [item("a", "melhoria")], "abc1234")];
    expect(releaseDoSha(releases, "abc1234def5678")?.id).toBe("r");
    expect(releaseDoSha(releases, "fff0000")).toBeNull();
    expect(releaseDoSha(releases, null)).toBeNull();
  });

  it("conta no singular e no plural", () => {
    expect(contagemNovidades(1)).toBe("1 novidade");
    expect(contagemNovidades(3)).toBe("3 novidades");
  });
});
