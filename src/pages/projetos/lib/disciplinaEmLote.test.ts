import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Projeto } from "@/types/projetos";
import { excluirDisciplina, nomeJaExiste, renomearDisciplina, usosDaDisciplina } from "./disciplinaEmLote";

const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));

const projeto = (id: string, nomes: string[]) =>
  ({
    id,
    disciplinas: nomes.map((disciplina, i) => ({ id: `${id}-d${i}`, disciplina })),
  }) as unknown as Projeto;

const projetos = [
  projeto("p1", ["Estrutural", "Elétrica"]),
  projeto("p2", ["estrutural"]),
  projeto("p3", ["Hidráulica"]),
];
const catalogo = [
  { id: "c1", nome: "Estrutural", empresa_id: "e1" },
  { id: "c2", nome: "Hidráulica", empresa_id: "e1" },
];

describe("usosDaDisciplina", () => {
  it("conta linhas e projetos ignorando caixa", () => {
    expect(usosDaDisciplina(projetos, "ESTRUTURAL")).toEqual({ discIds: ["p1-d0", "p2-d0"], projetos: 2 });
  });
  it("sem uso, devolve vazio", () => {
    expect(usosDaDisciplina(projetos, "Arquitetônico")).toEqual({ discIds: [], projetos: 0 });
  });
});

describe("nomeJaExiste", () => {
  it("acha em outro projeto ou no catálogo", () => {
    expect(nomeJaExiste("elétrica", { projetos, catalogo })).toBe(true);
    expect(nomeJaExiste("Hidráulica", { projetos: [], catalogo })).toBe(true);
  });
  it("trocar só a caixa do próprio nome é permitido", () => {
    expect(nomeJaExiste("estrutural", { projetos, catalogo, ignorar: "Estrutural" })).toBe(false);
  });
  it("nome novo não existe", () => {
    expect(nomeJaExiste("Arquitetônico", { projetos, catalogo })).toBe(false);
  });
});

describe("renomear e excluir em lote", () => {
  const inMock = vi.fn();
  const eqMock = vi.fn();
  const updateMock = vi.fn();
  const deleteMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    inMock.mockResolvedValue({ error: null });
    eqMock.mockResolvedValue({ error: null });
    updateMock.mockReturnValue({ in: inMock, eq: eqMock });
    deleteMock.mockReturnValue({ in: inMock, eq: eqMock });
    mocks.from.mockReturnValue({ update: updateMock, delete: deleteMock });
  });

  it("renomeia as linhas dos projetos e a do catálogo", async () => {
    await renomearDisciplina({ nome: "Estrutural", novoNome: "Estruturas", projetos, catalogo });
    expect(mocks.from).toHaveBeenCalledWith("projeto_disciplinas");
    expect(updateMock).toHaveBeenCalledWith({ nome: "Estruturas" });
    expect(inMock).toHaveBeenCalledWith("id", ["p1-d0", "p2-d0"]);
    expect(eqMock).toHaveBeenCalledWith("id", "c1");
  });

  it("exclui as linhas dos projetos e a do catálogo", async () => {
    await excluirDisciplina({ nome: "Estrutural", projetos, catalogo });
    expect(deleteMock).toHaveBeenCalledTimes(2);
    expect(inMock).toHaveBeenCalledWith("id", ["p1-d0", "p2-d0"]);
    expect(eqMock).toHaveBeenCalledWith("id", "c1");
  });

  it("divide ids em lotes de 100", async () => {
    const muitos = [
      projeto(
        "pX",
        Array.from({ length: 250 }, () => "Civil")
      ),
    ];
    await excluirDisciplina({ nome: "Civil", projetos: muitos, catalogo: [] });
    expect(inMock).toHaveBeenCalledTimes(3);
  });

  it("não mexe em disciplina do catálogo sem empresa", async () => {
    await excluirDisciplina({
      nome: "Estrutural",
      projetos: [],
      catalogo: [{ id: "g1", nome: "Estrutural", empresa_id: null }],
    });
    expect(eqMock).not.toHaveBeenCalled();
  });

  it("propaga o erro e não segue para o catálogo", async () => {
    inMock.mockResolvedValue({ error: new Error("rls") });
    await expect(excluirDisciplina({ nome: "Estrutural", projetos, catalogo })).rejects.toThrow("rls");
    expect(eqMock).not.toHaveBeenCalled();
  });
});
