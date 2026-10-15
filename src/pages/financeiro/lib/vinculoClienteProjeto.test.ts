import { describe, expect, it } from "vitest";
import { clienteDoProjeto, projetoContinuaValido, projetosDoCliente, type ProjetoOpcao } from "./vinculoClienteProjeto";

const projetos: ProjetoOpcao[] = [
  { id: "p1", nome: "Edifício A", cliente_id: "c1" },
  { id: "p2", nome: "Edifício B", cliente_id: "c1" },
  { id: "p3", nome: "Casa C", cliente_id: "c2" },
  { id: "p4", nome: "Sem cliente", cliente_id: null },
];

describe("vínculo cliente e projeto", () => {
  it("o projeto escolhido devolve o cliente dono", () => {
    expect(clienteDoProjeto(projetos, "p3")).toBe("c2");
  });

  it("projeto sem cliente ou inexistente não devolve cliente", () => {
    expect(clienteDoProjeto(projetos, "p4")).toBeNull();
    expect(clienteDoProjeto(projetos, "nao-existe")).toBeNull();
  });

  it("sem cliente escolhido, oferece todos os projetos", () => {
    expect(projetosDoCliente(projetos, "", "")).toHaveLength(4);
  });

  it("com cliente escolhido, oferece só os projetos dele", () => {
    expect(projetosDoCliente(projetos, "c1", "").map((p) => p.id)).toEqual(["p1", "p2"]);
  });

  it("mantém o projeto já selecionado mesmo de outro cliente (edição de lançamento antigo)", () => {
    expect(projetosDoCliente(projetos, "c1", "p3").map((p) => p.id)).toEqual(["p1", "p2", "p3"]);
  });

  it("trocar de cliente invalida o projeto de outro cliente, mas não o vazio nem o sem dono", () => {
    expect(projetoContinuaValido(projetos, "p1", "c2")).toBe(false);
    expect(projetoContinuaValido(projetos, "p1", "c1")).toBe(true);
    expect(projetoContinuaValido(projetos, "", "c2")).toBe(true);
    expect(projetoContinuaValido(projetos, "p4", "c2")).toBe(true);
  });
});
