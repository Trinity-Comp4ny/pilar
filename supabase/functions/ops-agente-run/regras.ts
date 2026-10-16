/**
 * Regras puras dos agentes de operação (SPEC 126 fase 1, ADR 0060). Sem I/O.
 *
 * O código decide QUEM precisa de contato e com qual evidência (fato do banco); o modelo
 * só escreve o texto. Tudo que o modelo devolve passa por `aterrar`: referência que não
 * existe é descartada e texto que promete preço, desconto ou link volta para o texto
 * padrão. Sem modelo (falha, teto de custo), o agente roda só com as regras.
 */

export type AgenteExecutavel = "receita" | "clientes" | "chefe";

export const AGENTES_EXECUTAVEIS: readonly AgenteExecutavel[] = ["receita", "clientes", "chefe"];

/** Câmbio de referência do painel (src/pages/ultra-admin/custos.ts). O ledger segue em USD. */
export const USD_BRL_REFERENCIA = 5.5;

/** Dias sem acesso a partir dos quais o agente Clientes sugere contato (igual à tela). */
export const DIAS_SEM_ACESSO_ALERTA = 7;

export type Receita = {
  mrr: number;
  pagantes: number;
  cadastros: number;
  cadastros_anterior: number;
  ativados: number;
  novos_pagantes: number;
  em_teste: number;
  checkout_pendente: number;
  testes_vencendo: Array<{
    empresa_id: string;
    empresa_nome: string;
    vence_em: string;
    projetos: number;
    contato_nome: string | null;
    contato_telefone: string | null;
  }>;
  em_atraso: Array<{
    empresa_id: string;
    empresa_nome: string;
    desde: string | null;
    contato_nome: string | null;
    contato_telefone: string | null;
  }>;
};

export type SaudeEmpresa = {
  empresa_id: string;
  empresa_nome: string;
  situacao_cobranca: string;
  nota: number;
  faixa: string;
  ultimo_acesso: string | null;
  dias_sem_acesso: number | null;
  feedback_aberto: number;
  contato_nome: string | null;
  contato_telefone: string | null;
};

export type Candidato = {
  /** Referência curta e estável dentro da execução ("c1", "c2"...), a única que o modelo vê. */
  ref: string;
  /** Chave natural: o mesmo fato não vira duas ações pendentes. */
  chave: string;
  tipo: "whatsapp" | "alerta";
  empresaId: string;
  empresaNome: string;
  contatoNome: string | null;
  telefone: string | null;
  titulo: string;
  prioridade: 1 | 2;
  prazo: string | null;
  /** Evidência gravada na ação e mostrada antes de aprovar (ADR 0050). */
  fatos: Record<string, string | number | null>;
  textoPadrao: string;
};

// ─── Texto ────────────────────────────────────────────────────────────────────

export function primeiroNome(nome: string | null | undefined): string | null {
  const p = nome?.trim().split(/\s+/)[0];
  return p ? p : null;
}

const DIA = 24 * 60 * 60 * 1000;

/** Dia do calendário em Brasília, para "hoje"/"amanhã" baterem com o relógio do cliente. */
function diaBrasilia(d: Date): number {
  const [a, m, dd] = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" })
    .format(d)
    .split("-")
    .map(Number);
  return Date.UTC(a, m - 1, dd);
}

export function quandoVence(iso: string, agora: Date): string {
  const dias = Math.round((diaBrasilia(new Date(iso)) - diaBrasilia(agora)) / DIA);
  if (dias < 0) return "já terminou";
  if (dias === 0) return "hoje";
  if (dias === 1) return "amanhã";
  return `em ${dias} dias`;
}

function saudacao(contato: string | null, remetente: string): string {
  const nome = primeiroNome(contato);
  return `Oi${nome ? ` ${nome}` : ""}, aqui é ${remetente}, da Pilar.`;
}

function dataCurta(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "sem-data";
}

/** Tira travessão (a voz da marca não usa) e espaço sobrando. */
export function limparTexto(t: string): string {
  return t
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Texto que promete o que o agente não pode prometer (ADR 0060). */
const PROIBIDO = /(R\$|\d+\s*%|desconto|gr[aá]tis por mais|https?:\/\/|www\.)/i;

/**
 * Assunto que não é da área: Clientes não fala de pagamento (é da Receita). Sem esta
 * trava o modelo misturava cobrança no check-in de quem estava sem acesso.
 */
export const FORA_DA_AREA: Record<"receita" | "clientes", RegExp | null> = {
  receita: null,
  clientes: /(pagamento|cobran|atras|fatura|boleto|assinatura)/i,
};

// ─── Candidatos ───────────────────────────────────────────────────────────────

export function candidatosReceita(r: Receita, remetente: string, agora: Date): Candidato[] {
  const lista: Omit<Candidato, "ref">[] = [];

  for (const t of r.testes_vencendo) {
    const quando = quandoVence(t.vence_em, agora);
    const projetos = t.projetos;
    const saud = saudacao(t.contato_nome, remetente);
    lista.push({
      chave: `teste:${t.empresa_id}:${dataCurta(t.vence_em)}`,
      tipo: "whatsapp",
      empresaId: t.empresa_id,
      empresaNome: t.empresa_nome,
      contatoNome: t.contato_nome,
      telefone: t.contato_telefone,
      titulo: `${t.empresa_nome}: teste termina ${quando}`,
      prioridade: 1,
      prazo: t.vence_em,
      fatos: { motivo: "teste_vencendo", vence: quando, projetos_reais: projetos },
      textoPadrao:
        projetos === 0
          ? `${saud} Seu teste termina ${quando} e vi que ainda não deu tempo de cadastrar um projeto. Quer ajuda para montar o primeiro agora? Leva uns 10 minutos.`
          : `${saud} Vi que vocês já cadastraram ${projetos} ${projetos === 1 ? "projeto" : "projetos"} no teste, que termina ${quando}. Quer que eu ajude a deixar tudo pronto para seguir? Em 15 minutos te mostro como ver a margem de cada projeto.`,
    });
  }

  for (const a of r.em_atraso) {
    lista.push({
      chave: `atraso:${a.empresa_id}:${dataCurta(a.desde)}`,
      tipo: "whatsapp",
      empresaId: a.empresa_id,
      empresaNome: a.empresa_nome,
      contatoNome: a.contato_nome,
      telefone: a.contato_telefone,
      titulo: `${a.empresa_nome}: pagamento em atraso`,
      prioridade: 1,
      prazo: null,
      fatos: { motivo: "pagamento_em_atraso", desde: dataCurta(a.desde) },
      textoPadrao: `${saudacao(a.contato_nome, remetente)} O pagamento da assinatura da ${a.empresa_nome} ficou em aberto. Se ajudar, te mando o link de novo ou vemos outra forma de pagamento.`,
    });
  }

  return lista.map((c, i) => ({ ...c, ref: `c${i + 1}` }));
}

const SITUACOES_QUE_IMPORTAM = new Set(["pagante", "em_teste", "convidada", "em_atraso"]);

export function candidatosClientes(saude: SaudeEmpresa[], remetente: string): Candidato[] {
  const lista: Omit<Candidato, "ref">[] = [];

  for (const s of saude) {
    if (!SITUACOES_QUE_IMPORTAM.has(s.situacao_cobranca)) continue;
    const dias = s.dias_sem_acesso;
    if (dias !== null && dias >= DIAS_SEM_ACESSO_ALERTA) {
      lista.push({
        chave: `sem_acesso:${s.empresa_id}:${dataCurta(s.ultimo_acesso)}`,
        tipo: "whatsapp",
        empresaId: s.empresa_id,
        empresaNome: s.empresa_nome,
        contatoNome: s.contato_nome,
        telefone: s.contato_telefone,
        titulo: `${s.empresa_nome}: sem acesso há ${dias} dias`,
        prioridade: 2,
        prazo: null,
        fatos: { motivo: "sem_acesso", dias_sem_acesso: dias, nota_saude: s.nota, situacao: s.situacao_cobranca },
        textoPadrao: `${saudacao(s.contato_nome, remetente)} Faz ${dias} dias que vocês não entram no sistema. Travou em alguma coisa? Se quiser, marco 15 minutos para ajustar o Pilar ao jeito do escritório.`,
      });
    }
    if (s.feedback_aberto > 0) {
      const n = s.feedback_aberto;
      lista.push({
        chave: `feedback:${s.empresa_id}:${n}`,
        tipo: "alerta",
        empresaId: s.empresa_id,
        empresaNome: s.empresa_nome,
        contatoNome: s.contato_nome,
        telefone: null,
        titulo: `${s.empresa_nome}: ${n} ${n === 1 ? "feedback" : "feedbacks"} sem resposta há mais de 24 h`,
        prioridade: 2,
        prazo: null,
        fatos: { motivo: "feedback_sem_resposta", quantidade: n },
        textoPadrao: "Responder na triagem de feedback fecha o ciclo e mostra que alguém leu.",
      });
    }
  }

  return lista.map((c, i) => ({ ...c, ref: `c${i + 1}` }));
}

/**
 * Só o que é novo: fato que já virou ação (pendente, enviada ou descartada) não volta.
 * A chave leva a data do fato, então fato novo (outro vencimento, acesso depois) passa.
 */
export function novosCandidatos(candidatos: Candidato[], chavesJaVistas: Set<string>): Candidato[] {
  return candidatos.filter((c) => !chavesJaVistas.has(c.chave));
}

// ─── Resposta do modelo ───────────────────────────────────────────────────────

export type RespostaModelo = {
  resumo: string;
  destaques: Array<{ texto: string; refs: string[] }>;
  mensagens: Array<{ ref: string; texto: string }>;
};

export type Briefing = {
  fonte: "modelo" | "regra";
  resumo: string;
  destaques: Array<{ texto: string; refs: string[] }>;
};

export type Aterrado = {
  briefing: Briefing;
  textos: Map<string, string>;
  descartes: Array<{ ref: string; motivo: string }>;
};

/**
 * Aterra a resposta do modelo nos fatos (ADR 0050): destaque sem referência conhecida e
 * mensagem para candidato inexistente são descartados; texto proibido ou vazio volta para
 * o texto padrão. Mensagem só existe para candidato de WhatsApp.
 */
export function aterrar(
  resposta: RespostaModelo,
  candidatos: Candidato[],
  indicadores: string[],
  foraDaArea: RegExp | null = null
): Aterrado {
  const porRef = new Map(candidatos.map((c) => [c.ref, c]));
  const conhecidas = new Set([...porRef.keys(), ...indicadores]);
  const descartes: Aterrado["descartes"] = [];

  const destaques = resposta.destaques
    .map((d) => ({ texto: limparTexto(d.texto), refs: d.refs.filter((r) => conhecidas.has(r)) }))
    .filter((d) => {
      if (d.refs.length > 0 && d.texto) return true;
      descartes.push({ ref: "briefing", motivo: "destaque sem evidência conhecida" });
      return false;
    })
    .slice(0, 3);

  const textos = new Map<string, string>();
  for (const m of resposta.mensagens) {
    const c = porRef.get(m.ref);
    if (!c || c.tipo !== "whatsapp") {
      descartes.push({ ref: m.ref, motivo: "mensagem para candidato inexistente" });
      continue;
    }
    if (textos.has(m.ref)) continue;
    const texto = limparTexto(m.texto);
    if (!texto || texto.length > 700 || PROIBIDO.test(texto) || foraDaArea?.test(texto)) {
      descartes.push({ ref: m.ref, motivo: "texto fora da regra, usado o padrão" });
      continue;
    }
    textos.set(m.ref, texto);
  }
  for (const c of candidatos) if (c.tipo === "whatsapp" && !textos.has(c.ref)) textos.set(c.ref, c.textoPadrao);

  return {
    briefing: { fonte: "modelo", resumo: limparTexto(resposta.resumo), destaques },
    textos,
    descartes,
  };
}

/** Briefing sem modelo: contagem dos fatos e os três candidatos mais urgentes. */
export function briefingPorRegra(
  agente: "receita" | "clientes",
  candidatos: Candidato[],
  resumoNumeros: string
): Briefing {
  const urgentes = [...candidatos].sort((a, b) => a.prioridade - b.prioridade).slice(0, 3);
  const n = candidatos.length;
  const pedido =
    n === 0
      ? agente === "receita"
        ? "Nenhum teste vencendo em 48 h e nenhum pagamento em atraso."
        : "Nenhum escritório sumido e nenhum feedback parado."
      : `${n} ${n === 1 ? "contato pedido" : "contatos pedidos"}.`;
  return {
    fonte: "regra",
    resumo: `${resumoNumeros} ${pedido}`.trim(),
    destaques: urgentes.map((c) => ({ texto: c.titulo, refs: [c.ref] })),
  };
}

export function textosPadrao(candidatos: Candidato[]): Map<string, string> {
  return new Map(candidatos.filter((c) => c.tipo === "whatsapp").map((c) => [c.ref, c.textoPadrao]));
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function resumoNumerosReceita(r: Receita): string {
  return `MRR ${brl.format(r.mrr)}, ${r.pagantes} ${r.pagantes === 1 ? "pagante" : "pagantes"}, ${r.cadastros} ${
    r.cadastros === 1 ? "cadastro" : "cadastros"
  } em 30 dias (${r.ativados} ativados), ${r.em_teste} em teste.`;
}

export function resumoNumerosClientes(saude: SaudeEmpresa[]): string {
  const risco = saude.filter((s) => s.faixa === "risco").length;
  const atencao = saude.filter((s) => s.faixa === "atencao").length;
  return `${saude.length} ${saude.length === 1 ? "escritório" : "escritórios"}: ${risco} em risco, ${atencao} em atenção.`;
}

// ─── Teto de custo ────────────────────────────────────────────────────────────

export function estourouTeto(gastoUsdNoMes: number, tetoBrl: number | null): boolean {
  if (tetoBrl === null || tetoBrl <= 0) return false;
  return gastoUsdNoMes * USD_BRL_REFERENCIA >= tetoBrl;
}

export function custoUsd(
  tokensIn: number,
  tokensOut: number,
  preco: { preco_input_por_milhao: number; preco_output_por_milhao: number } | null
): number | null {
  if (!preco) return null;
  return (tokensIn * preco.preco_input_por_milhao + tokensOut * preco.preco_output_por_milhao) / 1_000_000;
}

// ─── Resumo do dia (Chefe de gabinete) ────────────────────────────────────────

export type AcaoPendente = { agente_id: string; titulo: string; prioridade: number; prazo: string | null };

export function resumoDoDia(
  pendentes: AcaoPendente[],
  numeros: string[]
): { titulo: string; mensagem: string; prioridades: AcaoPendente[] } {
  const ordem = [...pendentes].sort((a, b) => {
    if (a.prioridade !== b.prioridade) return a.prioridade - b.prioridade;
    if (a.prazo && b.prazo) return a.prazo < b.prazo ? -1 : 1;
    if (a.prazo) return -1;
    if (b.prazo) return 1;
    return 0;
  });
  const top = ordem.slice(0, 3);
  const n = pendentes.length;
  const titulo =
    n === 0
      ? "Bom dia: nenhuma decisão esperando você"
      : `Bom dia: ${n} ${n === 1 ? "decisão espera" : "decisões esperam"} você`;
  const linhas = [
    ...(top.length > 0 ? ["Para hoje:", ...top.map((p, i) => `${i + 1}. ${p.titulo}`), ""] : []),
    ...numeros.filter(Boolean),
  ];
  return { titulo, mensagem: limparTexto(linhas.join("\n")), prioridades: top };
}
