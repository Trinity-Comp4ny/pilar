import { supabase } from "@/integrations/supabase/client";
import { lerErro } from "@/lib/registroUpload";
import { type PropostaEnviada } from "./cotarSchema";

/** O que a edge devolve para o fornecedor (lista fixa de campos, ver `saidaDaConsulta`). */
export interface CotacaoPublica {
  empresa_nome: string | null;
  descricao: string;
  quantidade: number | null;
  unidade: string | null;
  prazo_necessidade: string | null;
  observacoes: string | null;
  expira_em: string | null;
  resposta_atual: {
    valor: number | null;
    valor_parcelado: number | null;
    condicao_pagamento: string | null;
    desconto_pct: number | null;
    prazo_entrega_dias: number | null;
    observacoes: string | null;
  } | null;
}

/** `null` = link encerrado (inexistente, expirado, revogado ou cotação fechada: a edge não diz qual). */
export async function consultarCotacao(token: string): Promise<CotacaoPublica | null> {
  const { data, error } = await supabase.functions.invoke("cotacao-link", { body: { acao: "consultar", token } });
  if (error) throw new Error((await lerErro(error)).mensagem);
  const r = data as ({ ok: boolean } & Partial<CotacaoPublica>) | null;
  if (!r?.ok) return null;
  return r as CotacaoPublica;
}

/** `true` = proposta guardada; `false` = o link encerrou enquanto a pessoa preenchia. */
export async function enviarProposta(token: string, proposta: PropostaEnviada): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke("cotacao-link", {
    body: { acao: "responder", token, ...proposta },
  });
  if (error) throw new Error((await lerErro(error)).mensagem);
  return (data as { ok?: boolean } | null)?.ok === true;
}
