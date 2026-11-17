// Importar o cronograma da obra de uma planilha (Excel ou CSV): colunas Fase, Etapa, Serviço, Tarefa,
// Início e Fim. A leitura é pura (recebe as células, devolve o plano); gravar é com o hook.

export type Celula = string | number | Date | boolean | null | undefined;

export interface ItemImportado {
  /** Caminho normalizado ("fase|etapa|servico"): identifica o nó e liga filho a pai. */
  chave: string;
  paiChave: string | null;
  nivel: "fase" | "etapa" | "servico";
  nome: string;
  inicio: string | null;
  fim: string | null;
  /** Prestador padrão do serviço (só o fluxo de obra preenche). */
  fornecedorId?: string | null;
}

export interface TarefaImportada {
  titulo: string;
  /** Chave do serviço onde a tarefa fica. */
  servicoChave: string;
  inicio: string | null;
  prazo: string | null;
}

export interface PlanoImportacao {
  itens: ItemImportado[];
  tarefas: TarefaImportada[];
  avisos: string[];
  /** Mensagem quando a planilha não pôde ser lida (sem cabeçalho reconhecível). */
  erro: string | null;
}

const normalizar = (t: unknown) =>
  String(t ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();

const SINONIMOS: Record<"fase" | "etapa" | "servico" | "tarefa" | "inicio" | "fim", string[]> = {
  fase: ["fase", "macroetapa", "macro etapa"],
  etapa: ["etapa", "subetapa", "sub etapa"],
  servico: ["servico", "servicos", "item"],
  tarefa: ["tarefa", "tarefas", "atividade", "atividades"],
  inicio: ["inicio", "data inicio", "data de inicio", "inicio previsto", "start"],
  fim: ["fim", "termino", "data fim", "data de termino", "termino previsto", "prazo", "end"],
};

type Coluna = keyof typeof SINONIMOS;

function dataIso(ano: number, mes: number, dia: number): string | null {
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  if (d.getUTCFullYear() !== ano || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null;
  return d.toISOString().slice(0, 10);
}

/** Aceita Date do Excel, número de série, dd/mm/aaaa, dd-mm-aa e aaaa-mm-dd. */
export function lerData(v: Celula): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    // O Excel entrega a data à meia-noite local: lê pelas partes locais, sem deslocar o dia.
    return dataIso(v.getFullYear(), v.getMonth() + 1, v.getDate());
  }
  if (typeof v === "number") {
    if (v < 20000 || v > 80000) return null; // fora do que é data de obra
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  const t = String(v).trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t);
  if (m) return dataIso(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(t);
  if (m) return dataIso(m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]), Number(m[2]), Number(m[1]));
  return null;
}

const texto = (v: Celula) => (v == null ? "" : v instanceof Date ? "" : String(v).trim());

function acharCabecalho(
  linhas: ReadonlyArray<ReadonlyArray<Celula>>
): { indice: number; col: Partial<Record<Coluna, number>> } | null {
  for (let i = 0; i < Math.min(linhas.length, 15); i++) {
    const col: Partial<Record<Coluna, number>> = {};
    linhas[i].forEach((c, j) => {
      const n = normalizar(c);
      if (!n) return;
      (Object.keys(SINONIMOS) as Coluna[]).forEach((k) => {
        if (col[k] === undefined && SINONIMOS[k].includes(n)) col[k] = j;
      });
    });
    if (col.fase !== undefined || col.etapa !== undefined || col.servico !== undefined || col.tarefa !== undefined) {
      return { indice: i, col };
    }
  }
  return null;
}

export function planejarImportacao(linhas: ReadonlyArray<ReadonlyArray<Celula>>): PlanoImportacao {
  const vazio: PlanoImportacao = { itens: [], tarefas: [], avisos: [], erro: null };
  const cab = acharCabecalho(linhas);
  if (!cab) {
    return {
      ...vazio,
      erro: "Não achei o cabeçalho. A primeira linha precisa ter colunas como Fase, Etapa, Serviço, Tarefa, Início e Fim.",
    };
  }
  const { col } = cab;
  const itens = new Map<string, ItemImportado>();
  const tarefas: TarefaImportada[] = [];
  const avisos: string[] = [];
  const atual: { fase: string; etapa: string; servico: string } = { fase: "", etapa: "", servico: "" };
  let chaveFase = "";
  let chaveEtapa = "";
  let chaveServico = "";

  const pegar = (linha: ReadonlyArray<Celula>, k: Coluna) => (col[k] === undefined ? undefined : linha[col[k]!]);
  const garantir = (nivel: ItemImportado["nivel"], nome: string, paiChave: string | null): string => {
    const chave = `${paiChave ?? ""}|${normalizar(nome)}`;
    if (!itens.has(chave)) itens.set(chave, { chave, paiChave, nivel, nome, inicio: null, fim: null });
    return chave;
  };

  for (let i = cab.indice + 1; i < linhas.length; i++) {
    const linha = linhas[i];
    const n = i + 1; // número da linha na planilha
    const f = texto(pegar(linha, "fase"));
    const e = texto(pegar(linha, "etapa"));
    const s = texto(pegar(linha, "servico"));
    const t = texto(pegar(linha, "tarefa"));
    if (!f && !e && !s && !t) continue;

    // Célula vazia herda a de cima (planilha com células mescladas ou só o primeiro da fase preenchido).
    if (f && normalizar(f) !== normalizar(atual.fase)) {
      atual.fase = f;
      atual.etapa = "";
      atual.servico = "";
    }
    if (e && normalizar(e) !== normalizar(atual.etapa)) {
      atual.etapa = e;
      atual.servico = "";
    }
    if (s && normalizar(s) !== normalizar(atual.servico)) atual.servico = s;

    if (!atual.fase) {
      avisos.push(`Linha ${n}: sem fase, ignorada.`);
      continue;
    }
    chaveFase = garantir("fase", atual.fase, null);
    chaveEtapa = atual.etapa ? garantir("etapa", atual.etapa, chaveFase) : "";
    chaveServico = atual.servico && chaveEtapa ? garantir("servico", atual.servico, chaveEtapa) : "";
    if (atual.servico && !atual.etapa)
      avisos.push(`Linha ${n}: o serviço "${atual.servico}" está sem etapa, ignorado.`);

    const inicio = lerData(pegar(linha, "inicio"));
    const fim = lerData(pegar(linha, "fim"));
    const temData = (v: Celula) => v != null && v !== "";
    if (temData(pegar(linha, "inicio")) && !inicio)
      avisos.push(`Linha ${n}: data de início inválida, deixada em branco.`);
    if (temData(pegar(linha, "fim")) && !fim) avisos.push(`Linha ${n}: data de fim inválida, deixada em branco.`);
    let ini = inicio;
    let fi = fim;
    if (ini && fi && ini > fi) {
      avisos.push(`Linha ${n}: o início é depois do fim, datas deixadas em branco.`);
      ini = fi = null;
    }

    if (t) {
      let destino = chaveServico;
      if (!destino) {
        if (!chaveEtapa) {
          avisos.push(`Linha ${n}: a tarefa "${t}" está sem etapa e serviço, ignorada.`);
          continue;
        }
        destino = garantir("servico", "Geral", chaveEtapa);
        atual.servico = "";
      }
      tarefas.push({ titulo: t, servicoChave: destino, inicio: ini, prazo: fi });
      continue;
    }

    // A linha descreve o nó mais fundo que ela preenche: as datas são dele.
    const alvo = s && chaveServico ? chaveServico : e ? chaveEtapa : chaveFase;
    const item = itens.get(alvo);
    if (item && (ini || fi)) {
      item.inicio = ini ?? item.inicio;
      item.fim = fi ?? item.fim;
    }
  }

  if (itens.size === 0 && tarefas.length === 0)
    return { ...vazio, avisos, erro: "A planilha não tem linhas para importar." };
  return { itens: [...itens.values()], tarefas, avisos, erro: null };
}

/** CSV de exemplo para baixar (separador ponto e vírgula, como o Excel em português). */
export const MODELO_CRONOGRAMA_CSV = [
  "Fase;Etapa;Serviço;Tarefa;Início;Fim",
  "Estrutura;Fundação;Sapatas;Escavar;01/03/2026;05/03/2026",
  "Estrutura;Fundação;Sapatas;Concretar;06/03/2026;08/03/2026",
  "Estrutura;Pilares;Pilares do térreo;Armar;10/03/2026;15/03/2026",
  "Acabamento;Pintura;Parede interna;Aplicar massa;01/05/2026;10/05/2026",
].join("\n");

/**
 * Lê CSV sem passar pelo leitor de Excel, que trata "01/03/2026" como 3 de janeiro (formato americano).
 * Aceita ; , ou tab como separador (o do cabeçalho) e campos entre aspas.
 */
export function lerCsv(conteudo: string): string[][] {
  const texto = conteudo.replace(/^\uFEFF/, "");
  const primeira = texto.split(/\r?\n/, 1)[0] ?? "";
  const separador = [";", "\t", ","].reduce((melhor, s) =>
    primeira.split(s).length > primeira.split(melhor).length ? s : melhor
  );
  const linhas: string[][] = [];
  let campo = "";
  let linha: string[] = [];
  let entreAspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (entreAspas) {
      if (c === '"' && texto[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') entreAspas = false;
      else campo += c;
    } else if (c === '"') entreAspas = true;
    else if (c === separador) {
      linha.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = "";
    } else campo += c;
  }
  if (campo !== "" || linha.length > 0) {
    linha.push(campo);
    linhas.push(linha);
  }
  return linhas;
}
