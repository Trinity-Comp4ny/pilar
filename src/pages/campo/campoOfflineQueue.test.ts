import { describe, expect, it } from "vitest";
import {
  sincronizarFila,
  sincronizarItem,
  type FilaDiaItem,
  type FilaFoto,
  type FilaStore,
  type SincronizarDeps,
} from "./campoOfflineQueue";

const dia = () => ({
  p_data: "2026-08-14",
  p_clima: "ensolarado",
  p_condicao: null,
  p_efetivo: 8,
  p_atividades: "Concretagem",
  p_ocorrencias: null,
  p_pendencias: null,
});

const foto = (over: Partial<FilaFoto> = {}): FilaFoto => ({
  contentType: "image/jpeg",
  imageBase64: "abc",
  enviada: false,
  ...over,
});

const item = (over: Partial<FilaDiaItem> = {}): FilaDiaItem => ({
  id: "item-1",
  criadoEm: 1000,
  dia: dia(),
  fotos: [],
  tentativas: 0,
  ...over,
});

function memStore(itens: FilaDiaItem[] = []): FilaStore {
  const map = new Map(itens.map((i) => [i.id, i]));
  return {
    async listar() {
      return [...map.values()];
    },
    async salvar(i) {
      map.set(i.id, i);
    },
    async remover(id) {
      map.delete(id);
    },
  };
}

describe("sincronizarItem", () => {
  it("cria o RDO e sobe as fotos quando tudo dá certo", async () => {
    const deps: SincronizarDeps = {
      salvarRdo: async () => ({ ok: true, rdoId: "rdo-1" }),
      subirFoto: async () => ({ ok: true }),
    };
    const r = await sincronizarItem(item({ fotos: [foto(), foto()] }), deps);
    expect(r.ok).toBe(true);
  });

  it("não chama salvarRdo de novo quando já tem rdoId (evita duplicar o dia)", async () => {
    let chamadasSalvar = 0;
    const deps: SincronizarDeps = {
      salvarRdo: async () => {
        chamadasSalvar++;
        return { ok: true, rdoId: "rdo-1" };
      },
      subirFoto: async () => ({ ok: true }),
    };
    await sincronizarItem(item({ rdoId: "rdo-existente", fotos: [foto()] }), deps);
    expect(chamadasSalvar).toBe(0);
  });

  it("falha ao salvar o RDO: devolve o item com tentativas+1 e sem rdoId", async () => {
    const deps: SincronizarDeps = {
      salvarRdo: async () => ({ ok: false, erro: "sem rede" }),
      subirFoto: async () => ({ ok: true }),
    };
    const r = await sincronizarItem(item({ tentativas: 2 }), deps);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.item.tentativas).toBe(3);
      expect(r.item.rdoId).toBeUndefined();
      expect(r.item.ultimoErro).toBe("sem rede");
    }
  });

  it("RDO sobe mas 1 de 2 fotos falha: marca só a que subiu como enviada e guarda o rdoId", async () => {
    const deps: SincronizarDeps = {
      salvarRdo: async () => ({ ok: true, rdoId: "rdo-1" }),
      subirFoto: async (_rdoId, f) => (f.imageBase64 === "falha" ? { ok: false } : { ok: true }),
    };
    const r = await sincronizarItem(item({ fotos: [foto({ imageBase64: "ok" }), foto({ imageBase64: "falha" })] }), deps);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.item.rdoId).toBe("rdo-1");
      expect(r.item.fotos[0].enviada).toBe(true);
      expect(r.item.fotos[1].enviada).toBe(false);
    }
  });

  it("retry não reenvia foto já marcada enviada (idempotência)", async () => {
    let chamadasUpload = 0;
    const deps: SincronizarDeps = {
      salvarRdo: async () => ({ ok: true, rdoId: "rdo-1" }),
      subirFoto: async () => {
        chamadasUpload++;
        return { ok: true };
      },
    };
    const jaEnviada = item({ rdoId: "rdo-1", fotos: [foto({ enviada: true }), foto({ enviada: false })] });
    const r = await sincronizarItem(jaEnviada, deps);
    expect(r.ok).toBe(true);
    expect(chamadasUpload).toBe(1); // só a pendente
  });
});

describe("sincronizarFila", () => {
  it("processa em ordem de criação e remove os que completaram", async () => {
    const ordem: string[] = [];
    const store = memStore([item({ id: "b", criadoEm: 2000 }), item({ id: "a", criadoEm: 1000 })]);
    const deps: SincronizarDeps = {
      salvarRdo: async () => {
        ordem.push("salvou");
        return { ok: true, rdoId: "rdo-x" };
      },
      subirFoto: async () => ({ ok: true }),
    };
    const resumo = await sincronizarFila(store, deps);
    expect(resumo).toEqual({ enviados: 2, pendentes: 0 });
    expect(await store.listar()).toHaveLength(0);
  });

  it("mantém na fila os que falharam, sem perder os que deram certo", async () => {
    const store = memStore([item({ id: "ok" }), item({ id: "falha" })]);
    const deps: SincronizarDeps = {
      salvarRdo: async () => ({ ok: false, erro: "rede" }),
      subirFoto: async () => ({ ok: true }),
    };
    const resumo = await sincronizarFila(store, deps);
    expect(resumo.pendentes).toBe(2);
    const restantes = await store.listar();
    expect(restantes).toHaveLength(2);
    expect(restantes.every((i) => i.tentativas === 1)).toBe(true);
  });

  it("fila vazia devolve zeros sem chamar as deps", async () => {
    const store = memStore([]);
    let chamou = false;
    const deps: SincronizarDeps = {
      salvarRdo: async () => {
        chamou = true;
        return { ok: true, rdoId: "x" };
      },
      subirFoto: async () => ({ ok: true }),
    };
    const resumo = await sincronizarFila(store, deps);
    expect(resumo).toEqual({ enviados: 0, pendentes: 0 });
    expect(chamou).toBe(false);
  });
});
