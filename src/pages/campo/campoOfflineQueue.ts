/**
 * Fila offline do Pilar Campo (spec 042, fases 4-5). Quando "salvar o dia"
 * falha por falta de conexão, a captura não se perde: fica na fila
 * (IndexedDB) e sincroniza sozinha quando a rede volta.
 *
 * `campo_salvar_rdo` é upsert por obra+data, então reprocessar o mesmo item é
 * seguro (nunca duplica o dia); cada foto e cada medição é marcada `enviada`
 * individualmente para uma falha parcial não reenviar o que já subiu.
 */

export interface FilaFoto {
  contentType: string;
  imageBase64: string;
  enviada: boolean;
}

export interface FilaMedicao {
  item: string;
  quantidade: number;
  unidade: string;
  enviada: boolean;
}

/**
 * Vínculo com uma tarefa EXISTENTE do cronograma (spec 040). Criar tarefa nova
 * exige rede (não entra na fila): reconciliar um id local com o id real do
 * servidor antes de vincular adicionaria uma complexidade desproporcional a um
 * caso raro — o cronograma normalmente já existe antes do pedreiro reportar.
 */
export interface FilaTarefaVinculo {
  tarefaId: string;
  resultado: "avancou" | "concluiu" | "parou";
  observacao: string;
  enviada: boolean;
}

export interface FilaDiaPayload {
  p_data: string;
  p_clima: string | null;
  p_condicao: string | null;
  p_efetivo: number | null;
  p_atividades: string | null;
  p_ocorrencias: string | null;
  p_pendencias: string | null;
}

export interface FilaDiaItem {
  id: string;
  criadoEm: number;
  dia: FilaDiaPayload;
  fotos: FilaFoto[];
  medicoes: FilaMedicao[];
  tarefas: FilaTarefaVinculo[];
  /** Preenchido após o primeiro `salvarRdo` bem-sucedido; pula o upsert no retry. */
  rdoId?: string;
  tentativas: number;
  ultimoErro?: string;
}

/** Armazenamento da fila. Injetável: em produção é IndexedDB; em teste, um Map. */
export interface FilaStore {
  listar(): Promise<FilaDiaItem[]>;
  salvar(item: FilaDiaItem): Promise<void>;
  remover(id: string): Promise<void>;
}

export interface SincronizarDeps {
  salvarRdo(dia: FilaDiaPayload): Promise<{ ok: boolean; rdoId?: string; erro?: string }>;
  subirFoto(rdoId: string, foto: FilaFoto): Promise<{ ok: boolean; erro?: string }>;
  registrarMedicao(rdoId: string, medicao: FilaMedicao): Promise<{ ok: boolean; erro?: string }>;
  registrarTarefa(rdoId: string, vinculo: FilaTarefaVinculo): Promise<{ ok: boolean; erro?: string }>;
}

/**
 * Sincroniza um item: cria/atualiza o RDO (se ainda não tem `rdoId`), sobe as
 * fotos pendentes e registra as medições pendentes. Fotos e medições são
 * independentes entre si (uma falhar não trava a outra); devolve o item
 * atualizado quando algo falha, para o chamador regravar na fila com o
 * progresso (rdoId e o que já foi enviado).
 */
export async function sincronizarItem(
  item: FilaDiaItem,
  deps: SincronizarDeps
): Promise<{ ok: true } | { ok: false; item: FilaDiaItem }> {
  let rdoId = item.rdoId;
  if (!rdoId) {
    const r = await deps.salvarRdo(item.dia);
    if (!r.ok || !r.rdoId) {
      return { ok: false, item: { ...item, tentativas: item.tentativas + 1, ultimoErro: r.erro ?? "Falha ao salvar" } };
    }
    rdoId = r.rdoId;
  }

  const fotos = [...item.fotos];
  let algumaFalhou = false;
  for (let i = 0; i < fotos.length; i++) {
    if (fotos[i].enviada) continue;
    const r = await deps.subirFoto(rdoId, fotos[i]);
    if (r.ok) fotos[i] = { ...fotos[i], enviada: true };
    else algumaFalhou = true;
  }

  const medicoes = [...item.medicoes];
  for (let i = 0; i < medicoes.length; i++) {
    if (medicoes[i].enviada) continue;
    const r = await deps.registrarMedicao(rdoId, medicoes[i]);
    if (r.ok) medicoes[i] = { ...medicoes[i], enviada: true };
    else algumaFalhou = true;
  }

  const tarefas = [...item.tarefas];
  for (let i = 0; i < tarefas.length; i++) {
    if (tarefas[i].enviada) continue;
    const r = await deps.registrarTarefa(rdoId, tarefas[i]);
    if (r.ok) tarefas[i] = { ...tarefas[i], enviada: true };
    else algumaFalhou = true;
  }

  if (algumaFalhou) {
    return { ok: false, item: { ...item, rdoId, fotos, medicoes, tarefas, tentativas: item.tentativas + 1 } };
  }
  return { ok: true };
}

export interface SincronizarFilaResumo {
  enviados: number;
  pendentes: number;
}

/**
 * Sincroniza toda a fila, em ordem de criação (um upload de cada vez — não
 * satura a conexão do celular). Remove os itens completos; regrava (com nova
 * tentativa) os que ainda falharam.
 */
export async function sincronizarFila(store: FilaStore, deps: SincronizarDeps): Promise<SincronizarFilaResumo> {
  const itens = (await store.listar()).sort((a, b) => a.criadoEm - b.criadoEm);
  let enviados = 0;
  let pendentes = 0;
  for (const item of itens) {
    const r = await sincronizarItem(item, deps);
    if (r.ok) {
      await store.remover(item.id);
      enviados++;
    } else {
      await store.salvar(r.item);
      pendentes++;
    }
  }
  return { enviados, pendentes };
}
