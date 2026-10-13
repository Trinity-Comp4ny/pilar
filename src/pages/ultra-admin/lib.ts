/**
 * Regras puras do portal ultra admin (SPEC 117): situação da empresa, prazo
 * do teste, data relativa e frase da atividade. Sem React, sem Supabase.
 */
import { FEATURES_BY_KEY, type FeatureKey } from "@/lib/features";
import type { Cobranca, EmpresaStatus } from "./api";

/**
 * Situação única da empresa: junta o status de acesso (empresas.status) e a
 * cobrança (assinatura) num selo só. Antes eram duas colunas e "Cancelada"
 * aparecia nas duas com sentidos diferentes.
 */
export type Situacao =
  | "pagante"
  | "em_teste"
  | "convidada"
  | "teste_vencido"
  | "em_atraso"
  | "assinatura_cancelada"
  | "sem_assinatura"
  | "suspensa"
  | "arquivada";

export function situacaoEmpresa(status: EmpresaStatus, cobranca: Cobranca): Situacao {
  if (status === "cancelled") return "arquivada";
  if (status === "suspended") return "suspensa";
  if (cobranca.convidada) return "convidada";
  if (cobranca.status === "trialing") return "em_teste";
  if (cobranca.status === "expired") return "teste_vencido";
  if (cobranca.status === "overdue") return "em_atraso";
  if (cobranca.status === "canceled") return "assinatura_cancelada";
  if (cobranca.isPaying && cobranca.status === "active") return "pagante";
  return "sem_assinatura";
}

/** Ordem de exibição dos filtros e da distribuição na visão geral. */
export const SITUACOES: readonly Situacao[] = [
  "pagante",
  "em_teste",
  "convidada",
  "teste_vencido",
  "em_atraso",
  "assinatura_cancelada",
  "sem_assinatura",
  "suspensa",
  "arquivada",
];

const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;

/** "vence hoje", "vence em 5 h", "vence em 2 dias", "venceu há 3 dias". */
export function prazoTeste(trialEndsAt: string | null, agora: number = Date.now()): string | null {
  if (!trialEndsAt) return null;
  const restante = new Date(trialEndsAt).getTime() - agora;
  if (restante < 0) {
    const dias = Math.floor(-restante / DIA);
    return dias === 0 ? "venceu hoje" : `venceu há ${dias} ${dias === 1 ? "dia" : "dias"}`;
  }
  if (restante < HORA) return "vence em menos de 1 h";
  if (restante < DIA) return `vence em ${Math.ceil(restante / HORA)} h`;
  const dias = Math.ceil(restante / DIA);
  return `vence em ${dias} ${dias === 1 ? "dia" : "dias"}`;
}

/** Teste que vence em até `horas` (padrão 48 h), ainda não vencido. */
export function testeVenceEmBreve(trialEndsAt: string | null, horas = 48, agora: number = Date.now()): boolean {
  if (!trialEndsAt) return false;
  const restante = new Date(trialEndsAt).getTime() - agora;
  return restante >= 0 && restante <= horas * HORA;
}

/** Data relativa curta: "agora há pouco", "há 3 h", "ontem", "há 5 dias", "12/08/2026". */
export function quandoRelativo(iso: string | null | undefined, agora: number = Date.now()): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const passou = agora - t;
  if (passou < HORA) return "agora há pouco";
  if (passou < DIA) return `há ${Math.floor(passou / HORA)} h`;
  const dias = Math.floor(passou / DIA);
  if (dias === 1) return "ontem";
  if (dias < 30) return `há ${dias} dias`;
  return new Date(t).toLocaleDateString("pt-BR");
}

/** Rótulo do dia pra agrupar o feed: "Hoje", "Ontem" ou a data. */
export function rotuloDoDia(iso: string, agora: Date = new Date()): string {
  const d = new Date(iso);
  const mesmoDia = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (mesmoDia(d, agora)) return "Hoje";
  const ontem = new Date(agora);
  ontem.setDate(agora.getDate() - 1);
  if (mesmoDia(d, ontem)) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

export type TipoEvento = "empresa" | "usuarios" | "cobranca" | "acesso" | "cadastro" | "feedback" | "sistema";

export const TIPO_EVENTO_LABEL: Record<TipoEvento, string> = {
  cadastro: "Cadastros",
  empresa: "Empresas",
  usuarios: "Usuários",
  cobranca: "Cobrança",
  acesso: "Acesso e segurança",
  feedback: "Feedback",
  sistema: "Sistema",
};

export type AcaoAuditoria = {
  action: string;
  category: string | null;
  targetName: string | null;
  metadata: Record<string, unknown> | null;
};

const PAPEL: Record<string, string> = {
  admin: "admin",
  coordenador: "coordenador",
  user: "usuário",
  ultra_admin: "ultra admin",
};

function nomeFeature(key: unknown): string {
  if (typeof key !== "string") return "uma funcionalidade";
  return FEATURES_BY_KEY[key as FeatureKey]?.label ?? key;
}

/**
 * Frase legível de uma linha de admin_audit_logs, sem o sujeito (a tela põe
 * quem fez antes). Ação desconhecida cai num texto neutro com o código, pra
 * nunca sumir do feed.
 */
export function descreverAcao({ action, category, targetName, metadata }: AcaoAuditoria): {
  frase: string;
  tipo: TipoEvento;
} {
  const alvo = targetName ?? "uma empresa";
  const m = metadata ?? {};
  switch (action) {
    case "create_company":
      return { frase: `criou a empresa ${alvo}`, tipo: "empresa" };
    case "update_company": {
      const novo = typeof m.new_status === "string" && m.new_status !== m.old_status ? m.new_status : null;
      if (novo === "cancelled") return { frase: `arquivou ${alvo}`, tipo: "empresa" };
      if (novo === "suspended") return { frase: `suspendeu o acesso de ${alvo}`, tipo: "empresa" };
      if (novo === "active") return { frase: `reativou ${alvo}`, tipo: "empresa" };
      return { frase: `editou os dados de ${alvo}`, tipo: "empresa" };
    }
    case "delete_company":
      return { frase: `excluiu a empresa ${alvo}`, tipo: "empresa" };
    case "empresa_excluida_retencao":
      return { frase: "excluiu os dados de uma empresa vencida (retenção de 90 dias)", tipo: "cobranca" };
    case "mark_company_invited":
      return { frase: `tornou ${alvo} convidada (sem cobrança)`, tipo: "cobranca" };
    case "convert_to_paid": {
      const dias = typeof m.dias_prazo === "number" ? `, com ${m.dias_prazo} dias para assinar` : "";
      return { frase: `começou a cobrar ${alvo}${dias}`, tipo: "cobranca" };
    }
    case "bulk_toggle_feature": {
      const n = typeof m.affected === "number" ? m.affected : null;
      const verbo = m.value === false ? "desligou" : "ligou";
      const onde = n === null ? "em várias empresas" : `em ${n} ${n === 1 ? "empresa" : "empresas"}`;
      return { frase: `${verbo} ${nomeFeature(m.feature ?? targetName)} ${onde}`, tipo: "empresa" };
    }
    case "invite_user":
      return { frase: `convidou ${alvo}`, tipo: "usuarios" };
    case "resend_invite":
      return { frase: `reenviou o convite de ${alvo}`, tipo: "usuarios" };
    case "cancel_invite":
      return { frase: `cancelou o convite de ${alvo}`, tipo: "usuarios" };
    case "delete_user":
      return { frase: `removeu ${alvo}`, tipo: "usuarios" };
    case "update_user_access": {
      const novo = (m.new as { role?: string } | undefined)?.role;
      const papel = novo ? ` para ${PAPEL[novo] ?? novo}` : "";
      return { frase: `mudou o acesso de ${alvo}${papel}`, tipo: "usuarios" };
    }
    case "invite_dispatch_failed":
      return { frase: `não conseguiu enviar o convite de ${alvo}`, tipo: "usuarios" };
    case "update_plan":
      return { frase: `trocou o plano de ${alvo}`, tipo: "cobranca" };
    case "cancel":
      return { frase: `cancelou a assinatura de ${alvo}`, tipo: "cobranca" };
    case "refund":
      return { frase: `estornou um pagamento de ${alvo}`, tipo: "cobranca" };
    case "trial_expired":
      return { frase: `encerrou o teste de ${alvo} (venceu sem assinatura)`, tipo: "cobranca" };
    case "trial_converted_active":
      return { frase: `ativou a assinatura de ${alvo}`, tipo: "cobranca" };
    case "reconciliacao_rodada":
      return { frase: "conferiu as assinaturas com o Asaas", tipo: "sistema" };
    case "reconciliacao_divergencia":
      return { frase: `achou divergência com o Asaas em ${alvo}`, tipo: "cobranca" };
    case "save":
      return { frase: "salvou a configuração do Asaas", tipo: "cobranca" };
    case "apagar_tudo":
      return { frase: "apagou a configuração do Asaas", tipo: "cobranca" };
    case "start":
      return { frase: `começou a ver o app como ${alvo}`, tipo: "acesso" };
    case "stop":
    case "pause":
      return { frase: "saiu da visualização como outro papel", tipo: "acesso" };
    case "portal_proposta_aprovada":
      return { frase: `aprovou a proposta ${alvo} no portal do cliente`, tipo: "empresa" };
    default: {
      const tipo: TipoEvento =
        category === "billing"
          ? "cobranca"
          : category === "member" || category === "user"
            ? "usuarios"
            : category === "impersonation"
              ? "acesso"
              : "empresa";
      return { frase: `${action.replace(/_/g, " ")}${targetName ? ` (${targetName})` : ""}`, tipo };
    }
  }
}

/**
 * A exclusão manual (edge ultra-admin-empresas) reusa a RPC da retenção, que
 * grava a própria linha no log. O evento delete_company já conta a história;
 * esta segunda linha só confundiria o feed.
 */
export function ehEcoDeExclusaoManual(action: string, metadata: Record<string, unknown> | null): boolean {
  return (
    action === "empresa_excluida_retencao" &&
    typeof metadata?.motivo === "string" &&
    metadata.motivo.startsWith("Exclusão manual no portal")
  );
}

/** Ator legível: e-mail vira o nome antes do @; sistema quando vazio. */
export function nomeDoAtor(email: string | null): string {
  if (!email || email === "system@pilar") return "Sistema";
  return email.split("@")[0];
}

const TABELA_LABEL: Record<string, string> = {
  projetos: "um projeto",
  clientes: "um cliente",
  leads: "um lead",
  propostas: "uma proposta",
  receitas: "uma receita",
  despesas: "uma despesa",
  pessoas: "uma pessoa",
  obras: "uma obra",
  escopos: "um escopo",
  aditivos: "um aditivo",
  tarefas: "uma tarefa",
  faturas: "uma fatura",
  contas: "uma conta",
  metas: "uma meta",
  fornecedores: "um fornecedor",
  folha_pagamento: "uma folha de pagamento",
  marcos_faturamento: "um marco de faturamento",
  empresas: "os dados da empresa",
  profiles: "um perfil",
};

/** Frase de uma mutação de dados (audit_logs): "criou um projeto", "apagou uma despesa". */
export function descreverMutacao(action: string, tabela: string | null): string {
  const verbo = action === "INSERT" ? "criou" : action === "DELETE" ? "apagou" : "editou";
  const alvo = tabela ? (TABELA_LABEL[tabela] ?? `um registro em ${tabela.replace(/_/g, " ")}`) : "um registro";
  return `${verbo} ${alvo}`;
}

export type EstadoComponente = "operacional" | "degradado" | "parcial" | "outage";

const PESO_SEVERIDADE: Record<EstadoComponente, number> = { operacional: 0, degradado: 1, parcial: 2, outage: 3 };

/**
 * Estado atual de cada componente da status page: a pior severidade entre os
 * incidentes ainda abertos que o afetam; sem incidente aberto, operacional.
 */
export function estadoDosComponentes(
  componentIds: string[],
  incidentes: Array<{ status: string; severidade: Exclude<EstadoComponente, "operacional">; componentIds: string[] }>
): Map<string, EstadoComponente> {
  const estado = new Map<string, EstadoComponente>(componentIds.map((id) => [id, "operacional"]));
  for (const inc of incidentes) {
    if (inc.status === "resolvido") continue;
    for (const id of inc.componentIds) {
      const atual = estado.get(id) ?? "operacional";
      if (PESO_SEVERIDADE[inc.severidade] > PESO_SEVERIDADE[atual]) estado.set(id, inc.severidade);
    }
  }
  return estado;
}
