import { describe, expect, it, vi } from "vitest";
import {
  MAX_TENTATIVAS,
  novoItemDeRegistro,
  sincronizarRegistros,
  type FilaRegistroItem,
  type RegistroFilaStore,
  type ResultadoEnvio,
} from "./campoRegistroFila";

function storeEmMemoria(
  iniciais: FilaRegistroItem[] = []
): RegistroFilaStore & { itens: Map<string, FilaRegistroItem> } {
  const itens = new Map(iniciais.map((i) => [i.id, i]));
  return {
    itens,
    listar: async () => [...itens.values()],
    salvar: async (i) => void itens.set(i.id, i),
    remover: async (id) => void itens.delete(id),
  };
}

const item = (id: string, criadoEm: number, extra: Partial<FilaRegistroItem> = {}): FilaRegistroItem => ({
  ...novoItemDeRegistro({ id, agora: criadoEm, data: "2026-10-19", texto: id, fotos: [], aceiteAudio: false }),
  ...extra,
});

describe("novoItemDeRegistro", () => {
  it("usa o id dado como client_id e zera as tentativas", () => {
    const i = novoItemDeRegistro({ id: "abc", agora: 5, data: "2026-10-19", fotos: [], aceiteAudio: true });
    expect(i).toMatchObject({ id: "abc", criadoEm: 5, tentativas: 0, aceiteAudio: true });
  });

  it("sem id gera um client_id novo a cada registro", () => {
    const a = novoItemDeRegistro({ data: "2026-10-19", fotos: [], aceiteAudio: false });
    const b = novoItemDeRegistro({ data: "2026-10-19", fotos: [], aceiteAudio: false });
    expect(a.id).not.toBe(b.id);
  });
});

describe("sincronizarRegistros", () => {
  it("envia em ordem de criação e remove os enviados", async () => {
    const store = storeEmMemoria([item("b", 2), item("a", 1)]);
    const ordem: string[] = [];
    const resumo = await sincronizarRegistros(store, async (i) => {
      ordem.push(i.id);
      return { ok: true };
    });
    expect(ordem).toEqual(["a", "b"]);
    expect(resumo).toEqual({ enviados: 2, pendentes: 0, bloqueados: 0 });
    expect(store.itens.size).toBe(0);
  });

  it("falha passageira mantém o item, conta a tentativa e segue para o próximo", async () => {
    const store = storeEmMemoria([item("a", 1), item("b", 2)]);
    const enviar = vi.fn(async (i: FilaRegistroItem): Promise<ResultadoEnvio> =>
      i.id === "a" ? { ok: false, erro: "sem rede", definitivo: false } : { ok: true }
    );
    const resumo = await sincronizarRegistros(store, enviar);
    expect(resumo).toEqual({ enviados: 1, pendentes: 1, bloqueados: 0 });
    expect(store.itens.get("a")).toMatchObject({ tentativas: 1, ultimoErro: "sem rede" });
    expect(store.itens.has("b")).toBe(false);
  });

  it("falha definitiva marca o item e ele não é tentado de novo", async () => {
    const store = storeEmMemoria([item("a", 1)]);
    const enviar = vi.fn(async (): Promise<ResultadoEnvio> => ({
      ok: false,
      erro: "Áudio acima de 3 minutos",
      definitivo: true,
    }));
    expect((await sincronizarRegistros(store, enviar)).bloqueados).toBe(1);
    expect(store.itens.get("a")?.erroDefinitivo).toBe("Áudio acima de 3 minutos");

    enviar.mockClear();
    const segunda = await sincronizarRegistros(store, enviar);
    expect(enviar).not.toHaveBeenCalled();
    expect(segunda).toEqual({ enviados: 0, pendentes: 0, bloqueados: 1 });
  });

  it("depois de MAX_TENTATIVAS falhas passageiras o item bloqueia em vez de tentar para sempre", async () => {
    const store = storeEmMemoria([item("a", 1, { tentativas: MAX_TENTATIVAS - 1 })]);
    const enviar = vi.fn(async (): Promise<ResultadoEnvio> => ({
      ok: false,
      erro: "Falha ao guardar o áudio",
      definitivo: false,
    }));
    expect(await sincronizarRegistros(store, enviar)).toEqual({ enviados: 0, pendentes: 0, bloqueados: 1 });
    expect(store.itens.get("a")?.erroDefinitivo).toBe("Falha ao guardar o áudio");
  });

  it("fila vazia não faz nada", async () => {
    const enviar = vi.fn();
    expect(await sincronizarRegistros(storeEmMemoria(), enviar)).toEqual({ enviados: 0, pendentes: 0, bloqueados: 0 });
    expect(enviar).not.toHaveBeenCalled();
  });
});
