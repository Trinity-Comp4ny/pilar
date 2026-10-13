import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { lerEntrada, MAX_LISTA_ITENS, montarSchema } from "./esquema.ts";

const forn = new Set(["f1"]);
const tarefas = new Set(["t1"]);
const base = { transcricao: "Concretagem da laje" };

Deno.test("id de tarefa inventado pelo modelo some sem derrubar a transcrição", () => {
  const r = montarSchema(forn, tarefas).safeParse({
    ...base,
    sugestoes: {
      tarefas: [
        { tarefa_id: "t1", resultado: "concluiu" },
        { tarefa_id: "inventada", resultado: "avancou" },
      ],
    },
  });
  assertEquals(r.success, true);
  assertEquals(r.success && r.data.transcricao, "Concretagem da laje");
  assertEquals(r.success && r.data.sugestoes.tarefas, [{ tarefa_id: "t1", resultado: "concluiu" }]);
});

Deno.test("fornecedor fora do cadastro perde o vínculo, mas a sugestão fica", () => {
  const r = montarSchema(forn, tarefas).safeParse({
    ...base,
    sugestoes: {
      efetivo_por_fornecedor: [
        { fornecedor_id: "f1", fornecedor_nome: "Concreteira", quantidade: 3 },
        { fornecedor_id: "fx", fornecedor_nome: "Elétrica Silva", quantidade: 2 },
      ],
    },
  });
  assertEquals(r.success && r.data.sugestoes.efetivo_por_fornecedor.map((e) => e.fornecedor_id), ["f1", null]);
});

Deno.test("item malformado sai; sugestões ausentes viram listas vazias", () => {
  const r = montarSchema(forn, tarefas).safeParse({
    ...base,
    sugestoes: {
      impedimentos: [
        { descricao: "chuva", tipo: "clima" },
        { descricao: "x", tipo: "inventado" },
      ],
    },
  });
  assertEquals(r.success && r.data.sugestoes.impedimentos, [{ descricao: "chuva", tipo: "clima" }]);
  const vazio = montarSchema(forn, tarefas).safeParse(base);
  assertEquals(vazio.success && vazio.data.sugestoes, {
    efetivo_por_fornecedor: [],
    impedimentos: [],
    visitas: [],
    tarefas: [],
  });
});

Deno.test("campos principais continuam estritos: sem transcrição a resposta é recusada", () => {
  assertEquals(montarSchema(forn, tarefas).safeParse({ clima: "nublado" }).success, false);
  assertEquals(montarSchema(forn, tarefas).safeParse({ ...base, clima: "granizo" }).success, false);
});

Deno.test("entrada: mensagens na ordem de antes e listas de cadastro saneadas", () => {
  assertEquals(lerEntrada({}), { ok: false, error: "Nenhum áudio enviado" });
  assertEquals(lerEntrada({ audioBase64: "AAA", mimeType: "video/mp4" }), {
    ok: false,
    error: "Formato de áudio não suportado neste navegador.",
  });
  const muitos = Array.from({ length: MAX_LISTA_ITENS + 5 }, (_, i) => ({ id: `f${i}`, nome: "x" }));
  const r = lerEntrada({
    audioBase64: "AAA",
    mimeType: "audio/webm",
    fornecedores: [...muitos, { id: 1 }],
    tarefasAbertas: "não é lista",
  });
  assertEquals(r.ok && r.data.fornecedores.length, MAX_LISTA_ITENS);
  assertEquals(r.ok && r.data.tarefasAbertas, []);
});
