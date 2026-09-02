import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { callUntypedRpc } from "@/lib/supabaseRpc";
import { filaOfflineDb } from "./campoOfflineDb";
import {
  sincronizarFila,
  type FilaDiaPayload,
  type FilaEfetivo,
  type FilaFoto,
  type FilaImpedimento,
  type FilaMedicao,
  type FilaTarefaVinculo,
  type FilaVisita,
} from "./campoOfflineQueue";
import { getCampoToken } from "./useCampoAuth";

async function salvarRdoRemoto(token: string, dia: FilaDiaPayload) {
  const { data, error } = await callUntypedRpc<{ ok: boolean; erro?: string; rdo_id?: string }>("campo_salvar_rdo", {
    p_token: token,
    ...dia,
  });
  if (error || !data?.ok || !data.rdo_id) return { ok: false as const, erro: data?.erro ?? error?.message };
  return { ok: true as const, rdoId: data.rdo_id };
}

async function subirFotoRemota(token: string, rdoId: string, foto: FilaFoto) {
  const { data, error } = await supabase.functions.invoke("campo-upload-foto", {
    body: { token, rdo_id: rdoId, image_base64: foto.imageBase64, content_type: foto.contentType },
  });
  if (error || !(data as { success?: boolean } | null)?.success) return { ok: false as const };
  return { ok: true as const };
}

async function registrarMedicaoRemota(token: string, rdoId: string, medicao: FilaMedicao) {
  const { data, error } = await callUntypedRpc<{ ok: boolean; erro?: string }>("campo_registrar_medicao", {
    p_token: token,
    p_rdo_id: rdoId,
    p_item: medicao.item,
    p_quantidade: medicao.quantidade,
    p_unidade: medicao.unidade,
  });
  if (error || !data?.ok) return { ok: false as const, erro: data?.erro ?? error?.message };
  return { ok: true as const };
}

async function registrarTarefaRemota(token: string, rdoId: string, vinculo: FilaTarefaVinculo) {
  const { data, error } = await callUntypedRpc<{ ok: boolean; erro?: string }>("campo_registrar_tarefa_rdo", {
    p_token: token,
    p_rdo_id: rdoId,
    p_tarefa_id: vinculo.tarefaId,
    p_resultado: vinculo.resultado,
    p_observacao: vinculo.observacao,
  });
  if (error || !data?.ok) return { ok: false as const, erro: data?.erro ?? error?.message };
  return { ok: true as const };
}

async function registrarEfetivoRemoto(token: string, rdoId: string, efetivo: FilaEfetivo) {
  const { data, error } = await callUntypedRpc<{ ok: boolean; erro?: string }>("campo_registrar_efetivo", {
    p_token: token,
    p_rdo_id: rdoId,
    p_fornecedor_id: efetivo.fornecedorId,
    p_fornecedor_nome: efetivo.fornecedorNome,
    p_quantidade: efetivo.quantidade,
  });
  if (error || !data?.ok) return { ok: false as const, erro: data?.erro ?? error?.message };
  return { ok: true as const };
}

async function registrarImpedimentoRemoto(token: string, rdoId: string, impedimento: FilaImpedimento) {
  const { data, error } = await callUntypedRpc<{ ok: boolean; erro?: string }>("campo_registrar_impedimento", {
    p_token: token,
    p_rdo_id: rdoId,
    p_descricao: impedimento.descricao,
    p_tipo: impedimento.tipo,
  });
  if (error || !data?.ok) return { ok: false as const, erro: data?.erro ?? error?.message };
  return { ok: true as const };
}

async function registrarVisitaRemota(token: string, rdoId: string, visita: FilaVisita) {
  const { data, error } = await callUntypedRpc<{ ok: boolean; erro?: string }>("campo_registrar_visita", {
    p_token: token,
    p_rdo_id: rdoId,
    p_fornecedor_id: visita.fornecedorId,
    p_fornecedor_nome: visita.fornecedorNome,
    p_observacao: visita.observacao,
  });
  if (error || !data?.ok) return { ok: false as const, erro: data?.erro ?? error?.message };
  return { ok: true as const };
}

/**
 * Sincroniza a fila offline com o servidor: dispara ao montar, quando a rede
 * volta (`online`) e sob demanda (`sincronizar()`). Expõe a contagem de
 * pendentes para a UI mostrar "aguardando envio".
 */
export function useCampoSync() {
  const queryClient = useQueryClient();
  const [pendentes, setPendentes] = useState(0);
  const [sincronizando, setSincronizando] = useState(false);

  const atualizarContagem = useCallback(async () => {
    const itens = await filaOfflineDb.listar();
    setPendentes(itens.length);
  }, []);

  const sincronizar = useCallback(async () => {
    const token = getCampoToken();
    if (!token || sincronizando) return;
    setSincronizando(true);
    try {
      const resumo = await sincronizarFila(filaOfflineDb, {
        salvarRdo: (dia) => salvarRdoRemoto(token, dia),
        subirFoto: (rdoId, foto) => subirFotoRemota(token, rdoId, foto),
        registrarMedicao: (rdoId, medicao) => registrarMedicaoRemota(token, rdoId, medicao),
        registrarTarefa: (rdoId, vinculo) => registrarTarefaRemota(token, rdoId, vinculo),
        registrarEfetivo: (rdoId, efetivo) => registrarEfetivoRemoto(token, rdoId, efetivo),
        registrarImpedimento: (rdoId, impedimento) => registrarImpedimentoRemoto(token, rdoId, impedimento),
        registrarVisita: (rdoId, visita) => registrarVisitaRemota(token, rdoId, visita),
      });
      if (resumo.enviados > 0) {
        queryClient.invalidateQueries({ queryKey: ["campo_rdos"] });
      }
    } finally {
      setSincronizando(false);
      await atualizarContagem();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atualizarContagem, queryClient]);

  useEffect(() => {
    atualizarContagem();
    if (navigator.onLine) sincronizar();
    window.addEventListener("online", sincronizar);
    return () => window.removeEventListener("online", sincronizar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { pendentes, sincronizando, sincronizar };
}
