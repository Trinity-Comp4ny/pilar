/**
 * Fila offline dos registros do Pilar Campo (SPEC 135). Gravar e fechar o app não pode
 * depender de sinal: o registro (áudio, fotos, texto) é guardado no aparelho ANTES de
 * qualquer envio, e sobe sozinho quando a rede volta.
 *
 * O `id` do item é o `client_id` do registro: o servidor é idempotente por (obra, client_id),
 * então reenviar o mesmo item (falha no meio, resposta que se perdeu) nunca duplica.
 */

interface FilaRegistroAudio {
  blob: Blob;
  mimeType: string;
  duracaoS: number;
}

interface FilaRegistroFoto {
  blob: Blob;
  contentType: string;
}

export interface FilaRegistroItem {
  id: string;
  criadoEm: number;
  /** Data LOCAL da obra, yyyy-mm-dd. */
  data: string;
  texto?: string;
  audio?: FilaRegistroAudio;
  fotos: FilaRegistroFoto[];
  /** A pessoa aceitou o aviso do áudio guardado (ADR 0062) neste aparelho. */
  aceiteAudio: boolean;
  tentativas: number;
  ultimoErro?: string;
  /** Erro que repetir não resolve (ex.: áudio acima do limite). Fica até a pessoa descartar. */
  erroDefinitivo?: string;
}

export interface RegistroFilaStore {
  listar(): Promise<FilaRegistroItem[]>;
  salvar(item: FilaRegistroItem): Promise<void>;
  remover(id: string): Promise<void>;
}

/** Depois de tantas falhas seguidas o item para de ser tentado e espera a pessoa decidir. */
export const MAX_TENTATIVAS = 8;

export type ResultadoEnvio = { ok: true } | { ok: false; erro: string; definitivo: boolean };

export interface ResumoFilaRegistros {
  enviados: number;
  /** Voltam a ser tentados na próxima sincronização. */
  pendentes: number;
  /** Com erro definitivo: esperam a pessoa descartar. */
  bloqueados: number;
}

/** Cria o item da fila já com os contadores zerados. */
export function novoItemDeRegistro(
  p: Pick<FilaRegistroItem, "data" | "texto" | "audio" | "fotos" | "aceiteAudio"> & { id?: string; agora?: number }
): FilaRegistroItem {
  return {
    id: p.id ?? crypto.randomUUID(),
    criadoEm: p.agora ?? Date.now(),
    data: p.data,
    texto: p.texto,
    audio: p.audio,
    fotos: p.fotos,
    aceiteAudio: p.aceiteAudio,
    tentativas: 0,
  };
}

/**
 * Envia a fila na ordem de criação, um item por vez (não satura a conexão do celular).
 * Sucesso remove o item; falha passageira regrava com mais uma tentativa; falha definitiva (ou
 * `MAX_TENTATIVAS` falhas seguidas) marca o item e para de tentar. Item já marcado é pulado.
 */
export async function sincronizarRegistros(
  store: RegistroFilaStore,
  enviar: (item: FilaRegistroItem) => Promise<ResultadoEnvio>
): Promise<ResumoFilaRegistros> {
  const itens = (await store.listar()).sort((a, b) => a.criadoEm - b.criadoEm);
  const resumo: ResumoFilaRegistros = { enviados: 0, pendentes: 0, bloqueados: 0 };
  for (const item of itens) {
    if (item.erroDefinitivo) {
      resumo.bloqueados++;
      continue;
    }
    const r = await enviar(item);
    if (r.ok) {
      await store.remover(item.id);
      resumo.enviados++;
    } else if (r.definitivo || item.tentativas + 1 >= MAX_TENTATIVAS) {
      await store.salvar({ ...item, tentativas: item.tentativas + 1, ultimoErro: r.erro, erroDefinitivo: r.erro });
      resumo.bloqueados++;
    } else {
      await store.salvar({ ...item, tentativas: item.tentativas + 1, ultimoErro: r.erro });
      resumo.pendentes++;
    }
  }
  return resumo;
}
