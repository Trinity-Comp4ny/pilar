import { describe, expect, it } from "vitest";
import {
  sincronizarFila,
  sincronizarItem,
  type FilaDiaItem,
  type FilaEfetivo,
  type FilaFoto,
  type FilaImpedimento,
  type FilaMedicao,
  type FilaStore,
  type FilaTarefaVinculo,
  type FilaVisita,
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

const medicao = (over: Partial<FilaMedicao> = {}): FilaMedicao => ({
  item: "Concreto",
  quantidade: 12.5,
  unidade: "m3",
  enviada: false,
  ...over,
});

const tarefaVinculo = (over: Partial<FilaTarefaVinculo> = {}): FilaTarefaVinculo => ({
  tarefaId: "tarefa-1",
  resultado: "avancou",
  observacao: "",
  enviada: false,
  ...over,
});

const efetivo = (over: Partial<FilaEfetivo> = {}): FilaEfetivo => ({
  fornecedorId: "fornecedor-1",
  fornecedorNome: null,
  quantidade: 5,
  enviada: false,
  ...over,
});

const impedimento = (over: Partial<FilaImpedimento> = {}): FilaImpedimento => ({
  descricao: "Falta de cimento",
  tipo: "falta_material",
  enviada: false,
  ...over,
});

const visita = (over: Partial<FilaVisita> = {}): FilaVisita => ({
  fornecedorId: "fornecedor-1",
  fornecedorNome: null,
  observacao: null,
  enviada: false,
  ...over,
});

const item = (over: Partial<FilaDiaItem> = {}): FilaDiaItem => ({
  id: "item-1",
  criadoEm: 1000,
  dia: dia(),
  fotos: [],
  medicoes: [],
  tarefas: [],
  efetivos: [],
  impedimentos: [],
  visitas: [],
  tentativas: 0,
  ...over,
});

const depsOk = (): SincronizarDeps => ({
  salvarRdo: async () => ({ ok: true, rdoId: "rdo-1" }),
  subirFoto: async () => ({ ok: true }),
  registrarMedicao: async () => ({ ok: true }),
  registrarTarefa: async () => ({ ok: true }),
  registrarEfetivo: async () => ({ ok: true }),
  registrarImpedimento: async () => ({ ok: true }),
  registrarVisita: async () => ({ ok: true }),
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
    const r = await sincronizarItem(item({ fotos: [foto(), foto()] }), depsOk());
    expect(r.ok).toBe(true);
  });

  it("não chama salvarRdo de novo quando já tem rdoId (evita duplicar o dia)", async () => {
    let chamadasSalvar = 0;
    const deps: SincronizarDeps = {
      ...depsOk(),
      salvarRdo: async () => {
        chamadasSalvar++;
        return { ok: true, rdoId: "rdo-1" };
      },
    };
    await sincronizarItem(item({ rdoId: "rdo-existente", fotos: [foto()] }), deps);
    expect(chamadasSalvar).toBe(0);
  });

  it("falha ao salvar o RDO: devolve o item com tentativas+1 e sem rdoId", async () => {
    const deps: SincronizarDeps = { ...depsOk(), salvarRdo: async () => ({ ok: false, erro: "sem rede" }) };
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
      ...depsOk(),
      subirFoto: async (_rdoId, f) => (f.imageBase64 === "falha" ? { ok: false } : { ok: true }),
    };
    const r = await sincronizarItem(
      item({ fotos: [foto({ imageBase64: "ok" }), foto({ imageBase64: "falha" })] }),
      deps
    );
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
      ...depsOk(),
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

  it("registra as medições pendentes quando tudo dá certo", async () => {
    let chamadas = 0;
    const deps: SincronizarDeps = {
      ...depsOk(),
      registrarMedicao: async () => {
        chamadas++;
        return { ok: true };
      },
    };
    const r = await sincronizarItem(item({ medicoes: [medicao(), medicao({ item: "Tijolo", unidade: "un" })] }), deps);
    expect(r.ok).toBe(true);
    expect(chamadas).toBe(2);
  });

  it("retry não reenvia medição já marcada enviada (idempotência)", async () => {
    let chamadas = 0;
    const deps: SincronizarDeps = {
      ...depsOk(),
      registrarMedicao: async () => {
        chamadas++;
        return { ok: true };
      },
    };
    const jaEnviada = item({ rdoId: "rdo-1", medicoes: [medicao({ enviada: true }), medicao({ enviada: false })] });
    const r = await sincronizarItem(jaEnviada, deps);
    expect(r.ok).toBe(true);
    expect(chamadas).toBe(1);
  });

  it("registra os vínculos de tarefa pendentes quando tudo dá certo", async () => {
    let chamadas = 0;
    const deps: SincronizarDeps = {
      ...depsOk(),
      registrarTarefa: async () => {
        chamadas++;
        return { ok: true };
      },
    };
    const r = await sincronizarItem(
      item({ tarefas: [tarefaVinculo(), tarefaVinculo({ tarefaId: "tarefa-2", resultado: "concluiu" })] }),
      deps
    );
    expect(r.ok).toBe(true);
    expect(chamadas).toBe(2);
  });

  it("retry não reenvia vínculo de tarefa já marcado enviado (idempotência)", async () => {
    let chamadas = 0;
    const deps: SincronizarDeps = {
      ...depsOk(),
      registrarTarefa: async () => {
        chamadas++;
        return { ok: true };
      },
    };
    const jaEnviada = item({
      rdoId: "rdo-1",
      tarefas: [tarefaVinculo({ enviada: true }), tarefaVinculo({ enviada: false })],
    });
    const r = await sincronizarItem(jaEnviada, deps);
    expect(r.ok).toBe(true);
    expect(chamadas).toBe(1);
  });

  it("registra o efetivo por fornecedor pendente quando tudo dá certo", async () => {
    let chamadas = 0;
    const deps: SincronizarDeps = {
      ...depsOk(),
      registrarEfetivo: async () => {
        chamadas++;
        return { ok: true };
      },
    };
    const r = await sincronizarItem(
      item({ efetivos: [efetivo(), efetivo({ fornecedorId: null, fornecedorNome: "Empreiteira sem cadastro" })] }),
      deps
    );
    expect(r.ok).toBe(true);
    expect(chamadas).toBe(2);
  });

  it("retry não reenvia efetivo já marcado enviado (idempotência)", async () => {
    let chamadas = 0;
    const deps: SincronizarDeps = {
      ...depsOk(),
      registrarEfetivo: async () => {
        chamadas++;
        return { ok: true };
      },
    };
    const jaEnviada = item({ rdoId: "rdo-1", efetivos: [efetivo({ enviada: true }), efetivo({ enviada: false })] });
    const r = await sincronizarItem(jaEnviada, deps);
    expect(r.ok).toBe(true);
    expect(chamadas).toBe(1);
  });

  it("registra os impedimentos pendentes quando tudo dá certo", async () => {
    let chamadas = 0;
    const deps: SincronizarDeps = {
      ...depsOk(),
      registrarImpedimento: async () => {
        chamadas++;
        return { ok: true };
      },
    };
    const r = await sincronizarItem(item({ impedimentos: [impedimento(), impedimento({ tipo: "clima" })] }), deps);
    expect(r.ok).toBe(true);
    expect(chamadas).toBe(2);
  });

  it("registra as visitas pendentes quando tudo dá certo", async () => {
    let chamadas = 0;
    const deps: SincronizarDeps = {
      ...depsOk(),
      registrarVisita: async () => {
        chamadas++;
        return { ok: true };
      },
    };
    const r = await sincronizarItem(item({ visitas: [visita(), visita({ observacao: "vistoria" })] }), deps);
    expect(r.ok).toBe(true);
    expect(chamadas).toBe(2);
  });

  it("foto, medição, tarefa, efetivo, impedimento e visita falham de forma independente: cada uma guarda seu próprio progresso", async () => {
    const deps: SincronizarDeps = {
      ...depsOk(),
      subirFoto: async () => ({ ok: false }),
      registrarMedicao: async () => ({ ok: true }),
      registrarTarefa: async () => ({ ok: false }),
      registrarEfetivo: async () => ({ ok: true }),
      registrarImpedimento: async () => ({ ok: false }),
      registrarVisita: async () => ({ ok: true }),
    };
    const r = await sincronizarItem(
      item({
        fotos: [foto()],
        medicoes: [medicao()],
        tarefas: [tarefaVinculo()],
        efetivos: [efetivo()],
        impedimentos: [impedimento()],
        visitas: [visita()],
      }),
      deps
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.item.fotos[0].enviada).toBe(false);
      expect(r.item.medicoes[0].enviada).toBe(true);
      expect(r.item.tarefas[0].enviada).toBe(false);
      expect(r.item.efetivos[0].enviada).toBe(true);
      expect(r.item.impedimentos[0].enviada).toBe(false);
      expect(r.item.visitas[0].enviada).toBe(true);
    }
  });
});

describe("sincronizarFila", () => {
  it("processa em ordem de criação e remove os que completaram", async () => {
    const store = memStore([item({ id: "b", criadoEm: 2000 }), item({ id: "a", criadoEm: 1000 })]);
    const resumo = await sincronizarFila(store, depsOk());
    expect(resumo).toEqual({ enviados: 2, pendentes: 0 });
    expect(await store.listar()).toHaveLength(0);
  });

  it("mantém na fila os que falharam, sem perder os que deram certo", async () => {
    const store = memStore([item({ id: "ok" }), item({ id: "falha" })]);
    const deps: SincronizarDeps = { ...depsOk(), salvarRdo: async () => ({ ok: false, erro: "rede" }) };
    const resumo = await sincronizarFila(store, deps);
    expect(resumo.pendentes).toBe(2);
    const restantes = await store.listar();
    expect(restantes).toHaveLength(2);
    expect(restantes.every((i) => i.tentativas === 1)).toBe(true);
  });

  it("fila vazia devolve zeros sem chamar as deps", async () => {
    const store = memStore([]);
    let chamou = false;
    const deps: SincronizarDeps = { ...depsOk(), salvarRdo: async () => ((chamou = true), { ok: true, rdoId: "x" }) };
    const resumo = await sincronizarFila(store, deps);
    expect(resumo).toEqual({ enviados: 0, pendentes: 0 });
    expect(chamou).toBe(false);
  });
});
