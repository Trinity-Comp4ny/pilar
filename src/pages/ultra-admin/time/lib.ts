/**
 * Regras puras do Time de agentes (SPEC 126). Sem React, sem Supabase.
 *
 * O número vem do banco (ops_receita, ops_saude_empresas). Agente ligado (fase 1) grava
 * as próprias ações em ops_acoes; agente desligado tem a fila montada aqui por regra fixa.
 * Toda mensagem é rascunho: o link do WhatsApp abre a conversa com o texto pronto e quem
 * envia é o ultra admin (ADR 0060).
 */
import type { Receita, SaudeEmpresa, OpsAcao, OpsAgente, OpsExecucao } from "./api";

export type AgenteId = "chefe" | "receita" | "clientes" | "marketing" | "produto" | "qualidade" | "financas";

export type StatusAgente = "ok" | "atencao" | "falhou" | "pausado" | "so_numeros" | "planejado" | "externo";

/** Agentes que já têm painel de números na fase 0. Os outros mostram o plano. */
const AGENTES_COM_NUMEROS: readonly AgenteId[] = ["receita", "clientes"];

/** Agentes que a Edge Function ops-agente-run já executa (fase 1; Produto na SPEC 130). */
const AGENTES_EXECUTAVEIS: readonly AgenteId[] = ["receita", "clientes", "produto", "chefe"];

export function ehExecutavel(id: string): boolean {
  return AGENTES_EXECUTAVEIS.includes(id as AgenteId);
}

/** Rota da ficha: a Central é a página do chefe de gabinete. */
export function rotaDoAgente(id: string): string {
  return id === "chefe" ? "/ultra-admin/time" : `/ultra-admin/time/${id}`;
}

export function statusDoAgente(
  agente: Pick<OpsAgente, "id" | "ativo">,
  ultima: Pick<OpsExecucao, "status"> | null,
  pendentes: number
): StatusAgente {
  // Marketing vive na plataforma de marketing, produto próprio (ADR 0061).
  if (agente.id === "marketing") return "externo";
  if (!agente.ativo) {
    // Já rodou alguma vez e está desligado: foi pausado pelo ultra admin.
    if (ultima) return "pausado";
    return AGENTES_COM_NUMEROS.includes(agente.id as AgenteId) ? "so_numeros" : "planejado";
  }
  if (ultima?.status === "falhou") return "falhou";
  if (ultima?.status === "pausada_teto") return "pausado";
  return pendentes > 0 ? "atencao" : "ok";
}

/** O que cada agente vai medir e de onde, para a ficha mostrar o plano (SPEC 126, req. 4). */
export const PLANO_DOS_AGENTES: Record<AgenteId, { quando: string; indicadores: string[]; fontes: string[] }> = {
  chefe: {
    quando: "Fase 2, dezembro de 2026",
    indicadores: ["Três prioridades do dia", "Números que mudaram desde ontem", "Semana contra as metas"],
    fontes: ["Saída dos outros agentes"],
  },
  receita: {
    quando: "Fase 1, novembro de 2026: briefing e rascunhos automáticos",
    indicadores: ["Funil cadastro, ativação e pagante", "MRR", "Testes vencendo", "Atrasos", "Conversão por campanha"],
    fontes: ["Cadastros e projetos", "Assinaturas", "UTM do cadastro"],
  },
  clientes: {
    quando: "Fase 1, novembro de 2026: briefing e rascunhos automáticos",
    indicadores: [
      "Nota de saúde por escritório",
      "Sem acesso há 7+ dias",
      "Feedback sem resposta",
      "Erros que atingiram cliente",
    ],
    fontes: ["Acessos", "Uso por semana", "Feedback", "Sentry por empresa"],
  },
  marketing: {
    quando: "Na plataforma de marketing, produto próprio (ADR 0061)",
    indicadores: [
      "Campanhas, posts, carrosséis e vídeos",
      "Alcance e engajamento por rede, anúncios e Search Console",
      "Cadastros, ativados e pagantes por post (UTM, vindo do Pilar)",
    ],
    fontes: ["Plataforma de marketing (post-automation)", "Funil por UTM exportado pelo Pilar"],
  },
  produto: {
    quando: "Toda segunda às 7h07: áreas usadas e bugs parados. Funis e cliques de raiva com o PostHog (SPEC 125)",
    indicadores: [
      "Escritórios por área do produto em 28 dias",
      "Área perdendo escritório ou quase sem uso",
      "Bugs esperando triagem",
      "Depois: funis de ativação, telas com mais erro e cliques de raiva",
    ],
    fontes: ["Histórico de alterações por área", "Feedback", "PostHog (SPEC 125)"],
  },
  qualidade: {
    quando: "Fase 2, dezembro de 2026",
    indicadores: [
      "Issues abertas por empresas afetadas",
      "Novas e regressões em 24 h",
      "Sessões sem erro",
      "Incidentes",
    ],
    fontes: ["Sentry", "Status page"],
  },
  financas: {
    quando: "Fase 3, depois do lançamento",
    indicadores: ["MRR e churn", "Custo de IA e infraestrutura", "Margem", "Fôlego de caixa"],
    fontes: ["Assinaturas", "Ledger de tokens", "Custos informados"],
  },
};

// ─── Números ──────────────────────────────────────────────────────────────────

/** Delta do KPICard: % contra o período anterior, "novo" quando antes era zero. */
export function variacao(atual: number, anterior: number): { value?: number; isNew?: boolean } | undefined {
  if (anterior === 0) return atual > 0 ? { isNew: true } : undefined;
  return { value: ((atual - anterior) / anterior) * 100 };
}

/** "48%" ou "-" quando não há base. */
export function taxa(parte: number, total: number): string {
  if (total <= 0) return "-";
  return `${Math.round((parte / total) * 100)}%`;
}

// ─── WhatsApp ─────────────────────────────────────────────────────────────────

/** Telefone do cadastro em formato do wa.me (só dígitos, com 55). Null se não der para usar. */
export function telefoneWhatsApp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digitos = raw.replace(/\D/g, "");
  if (digitos.length === 10 || digitos.length === 11) return `55${digitos}`;
  if (digitos.startsWith("55") && (digitos.length === 12 || digitos.length === 13)) return digitos;
  return null;
}

export function linkWhatsApp(telefone: string | null | undefined, texto: string): string | null {
  const numero = telefoneWhatsApp(telefone);
  if (!numero) return null;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

function primeiroNome(nome: string | null | undefined): string | null {
  const p = nome?.trim().split(/\s+/)[0];
  return p ? p : null;
}

const DIA = 24 * 60 * 60 * 1000;

function inicioDoDia(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** "hoje", "amanhã", "em 3 dias" ou "já terminou", contando dia do calendário. */
export function quandoVence(iso: string, agora: Date = new Date()): string {
  const dias = Math.round((inicioDoDia(new Date(iso)) - inicioDoDia(agora)) / DIA);
  if (dias < 0) return "já terminou";
  if (dias === 0) return "hoje";
  if (dias === 1) return "amanhã";
  return `em ${dias} dias`;
}

function saudacao(contato: string | null | undefined, remetente: string): string {
  const nome = primeiroNome(contato);
  return `Oi${nome ? ` ${nome}` : ""}, aqui é ${remetente}, da Pilar.`;
}

export function mensagemTesteVencendo(p: {
  contato: string | null;
  remetente: string;
  projetos: number;
  venceEm: string;
  agora?: Date;
}): string {
  const quando = quandoVence(p.venceEm, p.agora);
  if (p.projetos === 0) {
    return `${saudacao(p.contato, p.remetente)} Seu teste termina ${quando} e vi que ainda não deu tempo de cadastrar um projeto. Quer ajuda para montar o primeiro agora? Leva uns 10 minutos.`;
  }
  const projetos = `${p.projetos} ${p.projetos === 1 ? "projeto" : "projetos"}`;
  return `${saudacao(p.contato, p.remetente)} Vi que vocês já cadastraram ${projetos} no teste, que termina ${quando}. Quer que eu ajude a deixar tudo pronto para seguir? Em 15 minutos te mostro como ver a margem de cada projeto.`;
}

function mensagemAtraso(p: { contato: string | null; remetente: string; empresa: string }): string {
  return `${saudacao(p.contato, p.remetente)} O pagamento da assinatura da ${p.empresa} ficou em aberto. Se ajudar, te mando o link de novo ou vemos outra forma de pagamento.`;
}

function mensagemSemAcesso(p: { contato: string | null; remetente: string; dias: number }): string {
  return `${saudacao(p.contato, p.remetente)} Faz ${p.dias} dias que vocês não entram no sistema. Travou em alguma coisa? Se quiser, marco 15 minutos para ajustar o Pilar ao jeito do escritório.`;
}

// ─── Fila de decisões (fase 0: por regra) ─────────────────────────────────────

export type Decisao = {
  id: string;
  agente: AgenteId;
  /** 1 = hoje, 2 = esta semana. */
  prioridade: 1 | 2;
  titulo: string;
  detalhe: string;
  empresaId: string;
  /** Link do wa.me com o texto pronto; null quando o cadastro não tem telefone. */
  whatsapp: string | null;
  /** Para onde o "Abrir" leva quando a ação não é mensagem. */
  link: string;
  prazo: string | null;
  /** Ação gravada por um agente (ops_acoes): pode ser editada, marcada como enviada ou descartada. */
  acao?: { id: string; texto: string; telefone: string | null; canal: "whatsapp" | "alerta" };
};

/** Rótulo do botão que abre o destino de uma tarefa da fila. */
export function rotuloDoLink(link: string): string {
  if (link.startsWith("/ultra-admin/feedback")) return "Ver feedback";
  if (link.startsWith("/ultra-admin/atividade")) return "Ver atividade";
  if (link.startsWith("/ultra-admin/empresas/")) return "Ver empresa";
  return "Abrir";
}

/** Ação gravada pelo agente vira item da mesma fila, com o rascunho editável. */
export function acaoParaDecisao(a: OpsAcao): Decisao {
  const r = a.rascunho;
  const canal = r?.canal ?? (a.tipo === "whatsapp" ? "whatsapp" : "alerta");
  const texto = r?.texto ?? "";
  const telefone = r?.telefone ?? null;
  const ehWhatsApp = canal === "whatsapp";
  return {
    id: `acao-${a.id}`,
    agente: a.agente_id as AgenteId,
    prioridade: a.prioridade <= 1 ? 1 : 2,
    titulo: a.titulo,
    detalhe: ehWhatsApp ? (telefone ? "Rascunho pronto para revisar." : "Sem telefone no cadastro.") : texto,
    empresaId: a.empresa_id ?? "",
    whatsapp: ehWhatsApp ? linkWhatsApp(telefone, texto) : null,
    link:
      !ehWhatsApp && r?.link ? r.link : a.empresa_id ? `/ultra-admin/empresas/${a.empresa_id}` : "/ultra-admin/time",
    prazo: a.prazo,
    acao: { id: a.id, texto, telefone, canal },
  };
}

/** Ordem da fila: hoje antes de esta semana, prazo mais perto primeiro. */
export function ordenarDecisoes(itens: Decisao[]): Decisao[] {
  return [...itens].sort((a, b) => {
    if (a.prioridade !== b.prioridade) return a.prioridade - b.prioridade;
    if (a.prazo && b.prazo) return a.prazo < b.prazo ? -1 : 1;
    if (a.prazo) return -1;
    if (b.prazo) return 1;
    return a.titulo.localeCompare(b.titulo, "pt-BR");
  });
}

const CADENCIA: Record<string, string> = {
  "0 10,22 * * *": "todo dia às 7h e às 19h",
  "5 10 * * *": "todo dia às 7h05",
  "10 10 * * *": "todo dia às 7h10",
  "7 10 * * 1": "toda segunda às 7h07",
};

/** Horário do cron (UTC) em frase de Brasília. Cron desconhecido aparece cru. */
export function cadenciaLegivel(cron: string | null): string | null {
  if (!cron) return null;
  return CADENCIA[cron] ?? `cron ${cron} (UTC)`;
}

const SITUACOES_QUE_IMPORTAM = new Set(["pagante", "em_teste", "convidada", "em_atraso"]);

/** Dias sem acesso a partir dos quais o agente Clientes sugere contato. */
const DIAS_SEM_ACESSO_ALERTA = 7;

export function decisoesDoDia(
  receita: Receita | undefined,
  saude: SaudeEmpresa[] | undefined,
  remetente: string,
  agora: Date = new Date()
): Decisao[] {
  const itens: Decisao[] = [];

  for (const t of receita?.testes_vencendo ?? []) {
    const projetos =
      t.projetos === 0
        ? "Nenhum projeto cadastrado ainda"
        : `${t.projetos} ${t.projetos === 1 ? "projeto cadastrado" : "projetos cadastrados"}`;
    itens.push({
      id: `teste-${t.empresa_id}`,
      agente: "receita",
      prioridade: 1,
      titulo: `${t.empresa_nome}: teste termina ${quandoVence(t.vence_em, agora)}`,
      detalhe: t.contato_telefone ? projetos : `${projetos}. Sem telefone no cadastro.`,
      empresaId: t.empresa_id,
      whatsapp: linkWhatsApp(
        t.contato_telefone,
        mensagemTesteVencendo({
          contato: t.contato_nome,
          remetente,
          projetos: t.projetos,
          venceEm: t.vence_em,
          agora,
        })
      ),
      link: `/ultra-admin/empresas/${t.empresa_id}`,
      prazo: t.vence_em,
    });
  }

  for (const a of receita?.em_atraso ?? []) {
    itens.push({
      id: `atraso-${a.empresa_id}`,
      agente: "receita",
      prioridade: 1,
      titulo: `${a.empresa_nome}: pagamento em atraso`,
      detalhe: a.contato_telefone ? "Assinatura com cobrança em aberto." : "Sem telefone no cadastro.",
      empresaId: a.empresa_id,
      whatsapp: linkWhatsApp(
        a.contato_telefone,
        mensagemAtraso({ contato: a.contato_nome, remetente, empresa: a.empresa_nome })
      ),
      link: `/ultra-admin/empresas/${a.empresa_id}`,
      prazo: null,
    });
  }

  for (const s of saude ?? []) {
    if (!SITUACOES_QUE_IMPORTAM.has(s.situacao_cobranca)) continue;
    const dias = s.dias_sem_acesso;
    if (dias !== null && dias >= DIAS_SEM_ACESSO_ALERTA) {
      itens.push({
        id: `acesso-${s.empresa_id}`,
        agente: "clientes",
        prioridade: 2,
        titulo: `${s.empresa_nome}: sem acesso há ${dias} dias`,
        detalhe: s.contato_telefone ? `Nota de saúde ${s.nota}.` : `Nota de saúde ${s.nota}. Sem telefone no cadastro.`,
        empresaId: s.empresa_id,
        whatsapp: linkWhatsApp(s.contato_telefone, mensagemSemAcesso({ contato: s.contato_nome, remetente, dias })),
        link: `/ultra-admin/empresas/${s.empresa_id}`,
        prazo: null,
      });
    }
    if (s.feedback_aberto > 0) {
      itens.push({
        id: `feedback-${s.empresa_id}`,
        agente: "clientes",
        prioridade: 2,
        titulo: `${s.empresa_nome}: ${s.feedback_aberto} ${s.feedback_aberto === 1 ? "feedback" : "feedbacks"} sem resposta há mais de 24 h`,
        detalhe: "Responder fecha o ciclo e mostra que alguém leu.",
        empresaId: s.empresa_id,
        whatsapp: null,
        link: "/ultra-admin/feedback",
        prazo: null,
      });
    }
  }

  return ordenarDecisoes(itens);
}

/**
 * Fila da Central: agente que já rodou alguma vez é dono da própria fila (ops_acoes), mesmo
 * pausado, porque a regra recriaria o que o ultra admin já descartou. Quem nunca rodou
 * tem a fila montada pela regra da fase 0, para a área não ficar muda.
 */
export function filaDoTime(p: {
  agentesQueJaRodaram: Set<string>;
  pendentes: OpsAcao[];
  receita: Receita | undefined;
  saude: SaudeEmpresa[] | undefined;
  remetente: string;
}): Decisao[] {
  const dono = p.agentesQueJaRodaram;
  const porRegra = decisoesDoDia(
    dono.has("receita") ? undefined : p.receita,
    dono.has("clientes") ? undefined : p.saude,
    p.remetente
  );
  const doAgente = p.pendentes.filter((a) => dono.has(a.agente_id)).map(acaoParaDecisao);
  return ordenarDecisoes([...doAgente, ...porRegra]);
}

/** "caiu 25 em 7 dias" / "subiu 12 em 7 dias"; null sem retrato antigo ou variação menor que 5. */
export function tendenciaNota(
  nota: number,
  nota7d: number | null | undefined
): { texto: string; caiu: boolean } | null {
  if (nota7d === null || nota7d === undefined) return null;
  const d = nota - nota7d;
  if (Math.abs(d) < 5) return null;
  return { texto: `${d < 0 ? "caiu" : "subiu"} ${Math.abs(d)} em 7 dias`, caiu: d < 0 };
}

/** "2 de 3 contatos funcionaram" a partir dos resultados medidos 7 dias depois do envio. */
export function textoEfeito(efeitos: string[]): string | null {
  if (efeitos.length === 0) return null;
  const ok = efeitos.filter((e) => e === "funcionou").length;
  return `${ok} de ${efeitos.length} ${efeitos.length === 1 ? "contato funcionou" : "contatos funcionaram"}`;
}
