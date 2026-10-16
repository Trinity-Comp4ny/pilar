/**
 * Regras puras dos agentes de operação (SPEC 126 fase 1, ADR 0060). Sem I/O.
 *
 * O código decide QUEM precisa de contato e com qual evidência (fato do banco); o modelo
 * só escreve o texto. Tudo que o modelo devolve passa por `aterrar`: referência que não
 * existe é descartada e texto que promete preço, desconto ou link volta para o texto
 * padrão. Sem modelo (falha, teto de custo), o agente roda só com as regras.
 */

export type AgenteExecutavel = "receita" | "clientes" | "produto" | "chefe";

export const AGENTES_EXECUTAVEIS: readonly AgenteExecutavel[] = ["receita", "clientes", "produto", "chefe"];

/** Áreas que levantam fatos e gravam ações (o Chefe só junta). */
export type AgenteDeArea = Exclude<AgenteExecutavel, "chefe">;

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
  /** Áreas do produto mexidas em 28 dias (SPEC 129). */
  modulos_usados?: number;
  /** Nota de 7 dias atrás, do retrato diário; null se ainda não há retrato. */
  nota_7d?: number | null;
  estagio?: string;
  criada_em?: string;
  projetos_ativos?: number;
  usuarios?: number;
};

/** Queda de nota em 7 dias que vale um check-in, mesmo com o escritório entrando. */
export const QUEDA_NOTA_ALERTA = 20;

/** Semana ISO ("2026-W42"): a queda vira no máximo um contato por semana. */
export function semanaIso(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dia = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dia);
  const inicioAno = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const semana = Math.ceil(((t.getTime() - inicioAno.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(semana).padStart(2, "0")}`;
}

export type Candidato = {
  /** Referência curta e estável dentro da execução ("c1", "c2"...), a única que o modelo vê. */
  ref: string;
  /** Chave natural: o mesmo fato não vira duas ações pendentes. */
  chave: string;
  tipo: "whatsapp" | "alerta";
  /** Null em fato da plataforma toda (Produto: módulo, feedback). */
  empresaId: string | null;
  empresaNome: string;
  contatoNome: string | null;
  telefone: string | null;
  titulo: string;
  prioridade: 1 | 2;
  prazo: string | null;
  /** Evidência gravada na ação e mostrada antes de aprovar (ADR 0050). */
  fatos: Record<string, string | number | null>;
  textoPadrao: string;
  /** Para onde a tarefa leva no Ultra (só alerta). Sem link, a fila abre a empresa. */
  link?: string;
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
export const FORA_DA_AREA: Record<AgenteDeArea, RegExp | null> = {
  receita: null,
  clientes: /(pagamento|cobran|atras|fatura|boleto|assinatura)/i,
  produto: null,
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

/** Quem entra na régua de ativação: em teste a Receita já conversa (o teste é curto). */
const SITUACOES_DA_ATIVACAO = new Set(["pagante", "convidada"]);

export type MarcoAtivacao = "primeiro_projeto" | "equipe" | "segundo_modulo";

/** Dia a partir do qual cada marco faltando vira contato (régua D2, D5, D9). */
export const DIA_DO_MARCO: Record<MarcoAtivacao, number> = { primeiro_projeto: 2, equipe: 5, segundo_modulo: 9 };

/** Dias de calendário (Brasília) desde o cadastro. */
export function diasDesde(iso: string, agora: Date): number {
  return Math.max(0, Math.round((diaBrasilia(agora) - diaBrasilia(new Date(iso))) / DIA));
}

/**
 * Primeiro marco de ativação que falta, na ordem em que o valor aparece: projeto
 * cadastrado, equipe dentro, segunda área do produto (em geral o Financeiro, que mostra a
 * margem). Um marco por vez: o escritório recebe um pedido, não uma lista.
 */
export function marcoQueFalta(s: SaudeEmpresa, agora: Date): { marco: MarcoAtivacao; dias: number } | null {
  if (s.estagio !== "onboarding" || !s.criada_em) return null;
  if (!SITUACOES_DA_ATIVACAO.has(s.situacao_cobranca)) return null;
  const dias = diasDesde(s.criada_em, agora);
  if ((s.projetos_ativos ?? 0) === 0)
    return dias >= DIA_DO_MARCO.primeiro_projeto ? { marco: "primeiro_projeto", dias } : null;
  if ((s.usuarios ?? 0) <= 1) return dias >= DIA_DO_MARCO.equipe ? { marco: "equipe", dias } : null;
  if ((s.modulos_usados ?? 0) <= 1)
    return dias >= DIA_DO_MARCO.segundo_modulo ? { marco: "segundo_modulo", dias } : null;
  return null;
}

function candidatoAtivacao(s: SaudeEmpresa, remetente: string, agora: Date): Omit<Candidato, "ref"> | null {
  const falta = marcoQueFalta(s, agora);
  if (!falta) return null;
  const { marco, dias } = falta;
  const saud = saudacao(s.contato_nome, remetente);
  const porMarco: Record<MarcoAtivacao, { titulo: string; texto: string }> = {
    primeiro_projeto: {
      titulo: `${s.empresa_nome}: ${dias} dias no Pilar e nenhum projeto cadastrado`,
      texto: `${saud} Faz ${dias} dias que o escritório entrou no Pilar e ainda não tem projeto cadastrado. Quer montar o primeiro comigo? Em 15 minutos fica com disciplinas e orçamento, e a margem começa a aparecer.`,
    },
    equipe: {
      titulo: `${s.empresa_nome}: só uma pessoa usando o Pilar`,
      texto: `${saud} Vi que por enquanto só você usa o Pilar aí. Quer ajuda para chamar a equipe? Com cada um atualizando as próprias tarefas, o andamento dos projetos fica certo sem você precisar cobrar.`,
    },
    segundo_modulo: {
      titulo: `${s.empresa_nome}: usa só uma área do Pilar`,
      texto: `${saud} O escritório já usa o Pilar, mas só numa parte. O que mais ajuda a ver se cada projeto dá lucro é ter projetos e Financeiro juntos. Quer que eu mostre em 15 minutos como ligar os dois?`,
    },
  };
  return {
    chave: `ativacao:${s.empresa_id}:${marco}`,
    tipo: "whatsapp",
    empresaId: s.empresa_id,
    empresaNome: s.empresa_nome,
    contatoNome: s.contato_nome,
    telefone: s.contato_telefone,
    titulo: porMarco[marco].titulo,
    prioridade: 2,
    prazo: null,
    fatos: {
      motivo: "ativacao",
      marco,
      dias_desde_cadastro: dias,
      projetos_ativos: s.projetos_ativos ?? null,
      pessoas: s.usuarios ?? null,
      areas_usadas_28d: s.modulos_usados ?? null,
    },
    textoPadrao: porMarco[marco].texto,
  };
}

export function candidatosClientes(saude: SaudeEmpresa[], remetente: string, agora: Date = new Date()): Candidato[] {
  const lista: Omit<Candidato, "ref">[] = [];

  for (const s of saude) {
    if (!SITUACOES_QUE_IMPORTAM.has(s.situacao_cobranca)) continue;
    const dias = s.dias_sem_acesso;
    const sumido = dias !== null && dias >= DIAS_SEM_ACESSO_ALERTA;
    const queda = s.nota_7d != null ? s.nota_7d - s.nota : 0;
    if (!sumido && queda >= QUEDA_NOTA_ALERTA) {
      lista.push({
        chave: `queda:${s.empresa_id}:${semanaIso(agora)}`,
        tipo: "whatsapp",
        empresaId: s.empresa_id,
        empresaNome: s.empresa_nome,
        contatoNome: s.contato_nome,
        telefone: s.contato_telefone,
        titulo: `${s.empresa_nome}: uso caiu (nota ${s.nota_7d} para ${s.nota} em 7 dias)`,
        prioridade: 2,
        prazo: null,
        fatos: {
          motivo: "queda_de_uso",
          nota_7_dias_atras: s.nota_7d ?? null,
          nota_agora: s.nota,
          modulos_usados: s.modulos_usados ?? null,
          estagio: s.estagio ?? null,
        },
        textoPadrao: `${saudacao(s.contato_nome, remetente)} Vi que o Pilar foi menos usado aí nesta semana. Mudou algo no escritório ou travou em alguma parte? Se quiser, marco 15 minutos para ajustar.`,
      });
    }
    if (sumido) {
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
        fatos: {
          motivo: "sem_acesso",
          dias_sem_acesso: dias,
          nota_saude: s.nota,
          situacao: s.situacao_cobranca,
          estagio: s.estagio ?? null,
        },
        textoPadrao: `${saudacao(s.contato_nome, remetente)} Faz ${dias} dias que vocês não entram no sistema. Travou em alguma coisa? Se quiser, marco 15 minutos para ajustar o Pilar ao jeito do escritório.`,
      });
    }
    // Ativação só para quem não sumiu: sumido já tem o contato de "sem acesso".
    const ativacao = sumido ? null : candidatoAtivacao(s, remetente, agora);
    if (ativacao) lista.push(ativacao);
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

// ─── Produto ──────────────────────────────────────────────────────────────────

export type Produto = {
  escritorios: number;
  modulos: Array<{ modulo: string; empresas_28d: number; empresas_28d_anteriores: number }>;
  feedback_30d: { total: number; bugs: number; sugestoes: number; bugs_sem_triagem: number };
};

const NOME_DA_AREA: Record<string, string> = {
  projetos: "Projetos",
  financeiro: "Financeiro",
  propostas: "Propostas",
  leads: "Leads",
  obras: "Obras",
  clientes: "Clientes",
  pessoas: "Pessoas",
};

/** Área em queda: perdeu ao menos 2 escritórios e 30% deles de um período de 28 dias ao outro. */
export const QUEDA_AREA_MIN = 2;
export const QUEDA_AREA_FRACAO = 0.3;
/** Área ignorada: menos de 1 em 5 escritórios, só contando a partir de 5 escritórios. */
export const IGNORADA_FRACAO = 0.2;
export const IGNORADA_BASE_MIN = 5;
/** Ignorada vira tarefa só para área de produto; Clientes e Pessoas são cadastro de apoio. */
const AREAS_DE_PRODUTO = new Set(["projetos", "financeiro", "propostas", "leads", "obras"]);
/** No máximo duas áreas ignoradas por mês (a chave é mensal), as menos usadas: o resto é ruído. */
export const IGNORADAS_POR_RODADA = 2;
/** Bugs sem triagem que viram tarefa da semana. */
export const BUGS_PARADOS_ALERTA = 3;

/** "2026-10": a mesma área vira no máximo uma tarefa por mês. */
function mesIso(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d).slice(0, 7);
}

function tarefa(
  c: Omit<Candidato, "ref" | "tipo" | "empresaId" | "empresaNome" | "contatoNome" | "telefone" | "prazo">
) {
  return {
    ...c,
    tipo: "alerta" as const,
    empresaId: null,
    empresaNome: "",
    contatoNome: null,
    telefone: null,
    prazo: null,
  };
}

/**
 * Produto, toda segunda: área que perdeu escritórios, área que quase ninguém usa e bug
 * parado na triagem. Vira tarefa para o fundador (perguntar a quem parou, triar), nunca
 * mensagem a cliente.
 */
export function candidatosProduto(p: Produto, agora: Date): Candidato[] {
  const lista: Omit<Candidato, "ref">[] = [];
  const ignoradas: Omit<Candidato, "ref">[] = [];
  const mes = mesIso(agora);

  for (const m of p.modulos) {
    const nome = NOME_DA_AREA[m.modulo] ?? m.modulo;
    const antes = m.empresas_28d_anteriores;
    const perdeu = antes - m.empresas_28d;
    if (antes > 0 && perdeu >= QUEDA_AREA_MIN && perdeu / antes >= QUEDA_AREA_FRACAO) {
      lista.push(
        tarefa({
          chave: `area_em_queda:${m.modulo}:${mes}`,
          titulo: `${nome}: de ${antes} para ${m.empresas_28d} escritórios usando em 28 dias`,
          prioridade: 1,
          fatos: {
            motivo: "area_em_queda",
            area: m.modulo,
            escritorios_28d: m.empresas_28d,
            escritorios_28d_anteriores: antes,
          },
          textoPadrao: "Veja na Atividade quem parou de usar e pergunte o motivo a um desses escritórios.",
          link: "/ultra-admin/atividade",
        })
      );
      continue;
    }
    if (
      AREAS_DE_PRODUTO.has(m.modulo) &&
      p.escritorios >= IGNORADA_BASE_MIN &&
      m.empresas_28d / p.escritorios < IGNORADA_FRACAO
    ) {
      ignoradas.push(
        tarefa({
          chave: `area_ignorada:${m.modulo}:${mes}`,
          titulo:
            m.empresas_28d === 0
              ? `${nome}: nenhum dos ${p.escritorios} escritórios usou em 28 dias`
              : `${nome}: só ${m.empresas_28d} de ${p.escritorios} escritórios usaram em 28 dias`,
          prioridade: 2,
          fatos: {
            motivo: "area_ignorada",
            area: m.modulo,
            escritorios_28d: m.empresas_28d,
            escritorios: p.escritorios,
          },
          textoPadrao: "Pergunte a dois escritórios se não precisam desta área ou se não acharam onde fica.",
          link: "/ultra-admin/atividade",
        })
      );
    }
  }

  ignoradas.sort((a, b) => Number(a.fatos.escritorios_28d) - Number(b.fatos.escritorios_28d));
  lista.push(...ignoradas.slice(0, IGNORADAS_POR_RODADA));

  const parados = p.feedback_30d.bugs_sem_triagem;
  if (parados >= BUGS_PARADOS_ALERTA) {
    lista.push(
      tarefa({
        chave: `bugs_parados:${semanaIso(agora)}`,
        titulo: `${parados} bugs relatados esperando triagem`,
        prioridade: 1,
        fatos: { motivo: "bugs_parados", bugs_sem_triagem: parados, bugs_30d: p.feedback_30d.bugs },
        textoPadrao: "Trie os bugs: responder fecha o ciclo com quem relatou e separa o que é urgente.",
        link: "/ultra-admin/feedback",
      })
    );
  }

  return lista.map((c, i) => ({ ...c, ref: `c${i + 1}` }));
}

export function indicadoresProduto(p: Produto): Record<string, number> {
  return {
    escritorios: p.escritorios,
    feedback_30d: p.feedback_30d.total,
    bugs_30d: p.feedback_30d.bugs,
    sugestoes_30d: p.feedback_30d.sugestoes,
    bugs_sem_triagem: p.feedback_30d.bugs_sem_triagem,
    ...Object.fromEntries(p.modulos.map((m) => [`escritorios_28d_${m.modulo}`, m.empresas_28d])),
  };
}

export function resumoNumerosProduto(p: Produto): string {
  const top = [...p.modulos]
    .filter((m) => m.empresas_28d > 0)
    .sort((a, b) => b.empresas_28d - a.empresas_28d)
    .slice(0, 3)
    .map((m) => `${NOME_DA_AREA[m.modulo] ?? m.modulo} (${m.empresas_28d})`);
  const fb = p.feedback_30d;
  const areas = top.length ? `áreas mais usadas em 28 dias: ${top.join(", ")}` : "nenhuma área usada em 28 dias";
  return `${p.escritorios} ${p.escritorios === 1 ? "escritório" : "escritórios"}, ${areas}. Feedback em 30 dias: ${fb.bugs} ${
    fb.bugs === 1 ? "bug" : "bugs"
  } e ${fb.sugestoes} ${fb.sugestoes === 1 ? "sugestão" : "sugestões"}.`;
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
const NADA_A_PEDIR: Record<AgenteDeArea, string> = {
  receita: "Nenhum teste vencendo em 48 h e nenhum pagamento em atraso.",
  clientes: "Nenhum escritório sumido e nenhum feedback parado.",
  produto: "Nenhuma área perdendo escritório e nenhum bug parado na triagem.",
};

export function briefingPorRegra(agente: AgenteDeArea, candidatos: Candidato[], resumoNumeros: string): Briefing {
  const urgentes = [...candidatos].sort((a, b) => a.prioridade - b.prioridade).slice(0, 3);
  const n = candidatos.length;
  const pedido =
    n === 0
      ? NADA_A_PEDIR[agente]
      : agente === "produto"
        ? `${n} ${n === 1 ? "tarefa" : "tarefas"} para a semana.`
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

// ─── Um contato por escritório ────────────────────────────────────────────────

/** Dias depois de um contato enviado em que outra área não manda nova mensagem. */
export const RESPIRO_DIAS = 3;

/**
 * Tira os WhatsApps de escritório que já tem contato de outra área pendente ou enviado há
 * menos de RESPIRO_DIAS dias. Em staging, a Receita (atraso) e a Clientes (sem acesso)
 * escreviam para o mesmo dono no mesmo dia.
 */
export function semContatoDuplo(
  candidatos: Candidato[],
  empresasOcupadas: Map<string, string>
): { manter: Candidato[]; descartes: Array<{ ref: string; motivo: string }> } {
  const manter: Candidato[] = [];
  const descartes: Array<{ ref: string; motivo: string }> = [];
  for (const c of candidatos) {
    const outra = c.tipo === "whatsapp" && c.empresaId ? empresasOcupadas.get(c.empresaId) : undefined;
    if (outra) {
      descartes.push({ ref: c.ref, motivo: `escritório já tem contato de ${outra}` });
      continue;
    }
    manter.push(c);
  }
  return { manter, descartes };
}

// ─── Retrato diário e o que mudou ─────────────────────────────────────────────

export type Retrato = Record<string, number>;

const ROTULO: Record<string, { nome: string; dinheiro?: boolean; ruimSubir?: boolean }> = {
  "receita.mrr": { nome: "MRR", dinheiro: true },
  "receita.pagantes": { nome: "pagantes" },
  "receita.cadastros_30d": { nome: "cadastros em 30 dias" },
  "receita.em_teste": { nome: "em teste" },
  "clientes.risco": { nome: "escritórios em risco", ruimSubir: true },
};

/** "Desde ontem: MRR +R$ 490,00, pagantes +1." Vazio quando nada mudou ou não há ontem. */
export function mudancasDesde(hoje: Retrato, ontem: Retrato): string {
  const partes: string[] = [];
  for (const [chave, r] of Object.entries(ROTULO)) {
    if (!(chave in hoje) || !(chave in ontem)) continue;
    const d = hoje[chave] - ontem[chave];
    if (d === 0) continue;
    const sinal = d > 0 ? "+" : "-";
    const valor = r.dinheiro ? brl.format(Math.abs(d)) : String(Math.abs(d));
    partes.push(`${r.nome} ${sinal}${valor}`);
  }
  return partes.length ? `Desde ontem: ${partes.join(", ")}.` : "";
}

/** "Contatos de 30 dias com resultado medido: 3 de 5 funcionaram." */
export function resumoEfeito(efeitos: string[]): string {
  if (efeitos.length === 0) return "";
  const ok = efeitos.filter((e) => e === "funcionou").length;
  return `Contatos dos últimos 30 dias com resultado medido: ${ok} de ${efeitos.length} funcionaram.`;
}
