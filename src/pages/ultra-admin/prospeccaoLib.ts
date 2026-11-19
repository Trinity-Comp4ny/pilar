// SPEC 172 fase 0: regras puras da prospecção no Ultra (telefone, segmento, canal, mensagem).
// Sem rede e sem banco: tudo aqui é testável. A tela e o importador só chamam estas funções.

export type Canal = "whatsapp" | "email" | "ligacao" | "nenhum";
export type TipoTelefone = "celular" | "fixo" | "sem";
export type Confianca = "pessoa" | "empresa";

export interface Segmento {
  slug: string;
  rotulo: string;
  /** Como a mensagem chama o público: "um software de gestão para {publico}". */
  publico: string;
  /** O que a Pilar faz por esse público, em uma frase. */
  oferta: string;
  /** ICP vigente (DECISOES). Os demais são teste de mercado. */
  icp: boolean;
}

const OFERTA_PADRAO = "reúne orçamentos, projetos, equipe e financeiro em um só lugar";

export const SEGMENTOS: Record<string, Segmento> = {
  arquitetura: {
    slug: "arquitetura",
    rotulo: "Arquitetura",
    publico: "escritórios de arquitetura",
    oferta: OFERTA_PADRAO,
    icp: true,
  },
  engenharia: {
    slug: "engenharia",
    rotulo: "Engenharia",
    publico: "escritórios de engenharia",
    oferta: OFERTA_PADRAO,
    icp: true,
  },
  construtoras: {
    slug: "construtoras",
    rotulo: "Construtoras",
    publico: "construtoras",
    oferta: "reúne orçamentos, obras, equipe e financeiro em um só lugar",
    icp: false,
  },
  moveis_planejados: {
    slug: "moveis_planejados",
    rotulo: "Móveis planejados e marcenaria",
    publico: "empresas de móveis planejados e marcenaria",
    oferta: "reúne orçamentos, projetos sob medida, equipe e cobranças em um só lugar",
    icp: false,
  },
  marmorarias: {
    slug: "marmorarias",
    rotulo: "Marmorarias",
    publico: "marmorarias",
    oferta: "reúne orçamentos, projetos sob medida, equipe e cobranças em um só lugar",
    icp: false,
  },
  vidracarias: {
    slug: "vidracarias",
    rotulo: "Vidraçarias",
    publico: "vidraçarias",
    oferta: "reúne orçamentos, projetos sob medida, equipe e cobranças em um só lugar",
    icp: false,
  },
  esquadrias: {
    slug: "esquadrias",
    rotulo: "Esquadrias e alumínio",
    publico: "empresas de esquadrias e alumínio",
    oferta: "reúne orçamentos, projetos sob medida, equipe e cobranças em um só lugar",
    icp: false,
  },
  serralherias: {
    slug: "serralherias",
    rotulo: "Serralherias e estruturas",
    publico: "serralherias",
    oferta: "reúne orçamentos, projetos sob medida, equipe e cobranças em um só lugar",
    icp: false,
  },
};

const semAcento = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/** Reconhece o segmento pelo rótulo da planilha. Devolve null quando não encaixa em nenhum. */
export function segmentoPorRotulo(rotulo: string | null | undefined): Segmento | null {
  const t = semAcento(rotulo ?? "");
  if (!t) return null;
  if (t.includes("arquitet")) return SEGMENTOS.arquitetura;
  if (t.includes("engenh")) return SEGMENTOS.engenharia;
  if (t.includes("constru")) return SEGMENTOS.construtoras;
  if (t.includes("movel") || t.includes("moveis") || t.includes("marcen") || t.includes("planejad")) {
    return SEGMENTOS.moveis_planejados;
  }
  if (t.includes("marmor")) return SEGMENTOS.marmorarias;
  if (t.includes("vidrac")) return SEGMENTOS.vidracarias;
  if (t.includes("esquadri") || t.includes("alumin")) return SEGMENTOS.esquadrias;
  if (t.includes("serralh")) return SEGMENTOS.serralherias;
  return null;
}

// ─── Telefone ────────────────────────────────────────────────────────────────

export interface TelefoneBr {
  /** Só dígitos com 55, ex.: 5514999990000. */
  e164: string;
  tipo: Exclude<TipoTelefone, "sem">;
  /** Como exibir: (14) 99999-0000. */
  exibicao: string;
}

/** Extrai todos os telefones brasileiros válidos de um texto livre (um campo pode ter mais de um). */
export function extrairTelefones(texto: string | null | undefined): TelefoneBr[] {
  if (!texto) return [];
  const achados: TelefoneBr[] = [];
  const vistos = new Set<string>();
  const re = /(?:\+?55\s*)?\(?(\d{2})\)?[\s.-]*(9?\d{4})[\s.-]?(\d{4})/g;
  for (const m of texto.matchAll(re)) {
    const ddd = m[1];
    const meio = m[2];
    const fim = m[3];
    if (ddd.startsWith("0") || ddd === "00") continue;
    const celular = meio.length === 5;
    const e164 = `55${ddd}${meio}${fim}`;
    if (vistos.has(e164)) continue;
    vistos.add(e164);
    achados.push({
      e164,
      tipo: celular ? "celular" : "fixo",
      exibicao: `(${ddd}) ${meio}-${fim}`,
    });
  }
  return achados;
}

export interface TelefoneEscolhido {
  e164: string | null;
  tipo: TipoTelefone;
}

/** Escolhe o telefone do lead: o primeiro celular (WhatsApp), senão o primeiro fixo. */
export function escolherTelefone(...campos: Array<string | null | undefined>): TelefoneEscolhido {
  const todos = campos.flatMap((c) => extrairTelefones(c));
  const celular = todos.find((t) => t.tipo === "celular");
  if (celular) return { e164: celular.e164, tipo: "celular" };
  const fixo = todos[0];
  return fixo ? { e164: fixo.e164, tipo: "fixo" } : { e164: null, tipo: "sem" };
}

export function emailValido(email: string | null | undefined): string | null {
  const e = (email ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

/** Celular vai para WhatsApp; fixo com e-mail vai por e-mail; fixo sem e-mail vai por ligação. */
export function decidirCanal(tipo: TipoTelefone, email: string | null): Canal {
  if (tipo === "celular") return "whatsapp";
  if (email) return "email";
  if (tipo === "fixo") return "ligacao";
  return "nenhum";
}

/** Só "pessoa" quando há nome público, celular e WhatsApp indicado na fonte (decisão de 2026-11-19). */
export function decidirConfianca(args: {
  contatoNome: string | null;
  tipo: TipoTelefone;
  whatsappNaFonte: boolean;
}): Confianca {
  return args.contatoNome && args.tipo === "celular" && args.whatsappNaFonte ? "pessoa" : "empresa";
}

export function notaPorPrioridade(prioridade: string | null | undefined, icp: boolean): number {
  const p = semAcento(prioridade ?? "");
  let base = 50;
  if (["alta", "high", "urgent", "urgente"].includes(p)) base = 90;
  else if (["media", "medium", "normal"].includes(p)) base = 60;
  else if (["baixa", "low"].includes(p)) base = 30;
  return Math.min(100, base + (icp ? 5 : 0));
}

// ─── Linha da planilha → lead ────────────────────────────────────────────────

const ALIASES = {
  nome: ["Empresa", "Task Name"],
  segmento: ["Segmento", "Segment"],
  cidade: ["Cidade", "City"],
  telefone: ["Telefone principal", "Telefone público", "Phone"],
  telefoneAdicional: ["Telefone adicional", "Phone 2"],
  whatsapp: ["WhatsApp"],
  email: ["E-mail", "Email"],
  site: ["Site / Instagram", "Website"],
  contato: ["Nome público associado", "Contact"],
  endereco: ["Endereço", "Address"],
  prioridade: ["Prioridade sugerida", "Prioridade", "Priority"],
  qualidade: ["Qualidade do contato"],
} as const;

export interface LeadImportado {
  nome: string;
  segmento: string;
  segmento_teste: boolean;
  uf: string | null;
  cidade: string | null;
  telefone: string | null;
  telefone_adicional: string | null;
  telefone_e164: string | null;
  tipo_telefone: TipoTelefone;
  email: string | null;
  site: string | null;
  endereco: string | null;
  contato_nome: string | null;
  whatsapp_na_fonte: boolean;
  qualidade: string | null;
  canal: Canal;
  confianca_contato: Confianca;
  nota_encaixe: number;
}

export type MotivoDescarte = "sem_nome" | "segmento_desconhecido" | "sem_contato";

function campo(linha: Record<string, unknown>, chaves: readonly string[]): string | null {
  for (const k of chaves) {
    const v = linha[k];
    if (v === undefined || v === null) continue;
    const t = String(v).trim();
    if (t) return t;
  }
  return null;
}

/** Converte uma linha (cabeçalho → valor) em lead, ou diz por que foi descartada. */
export function linhaParaLead(
  linha: Record<string, unknown>
): { lead: LeadImportado } | { descarte: MotivoDescarte } {
  const nome = campo(linha, ALIASES.nome);
  if (!nome) return { descarte: "sem_nome" };
  const segmento = segmentoPorRotulo(campo(linha, ALIASES.segmento));
  if (!segmento) return { descarte: "segmento_desconhecido" };

  const telefone = campo(linha, ALIASES.telefone);
  const telefoneAdicional = campo(linha, ALIASES.telefoneAdicional);
  const escolhido = escolherTelefone(telefone, telefoneAdicional);
  const email = emailValido(campo(linha, ALIASES.email));
  if (escolhido.tipo === "sem" && !email) return { descarte: "sem_contato" };

  const contatoNome = campo(linha, ALIASES.contato);
  const whatsappNaFonte = semAcento(campo(linha, ALIASES.whatsapp) ?? "").startsWith("sim");

  return {
    lead: {
      nome,
      segmento: segmento.slug,
      segmento_teste: !segmento.icp,
      uf: null,
      cidade: campo(linha, ALIASES.cidade),
      telefone,
      telefone_adicional: telefoneAdicional,
      telefone_e164: escolhido.e164,
      tipo_telefone: escolhido.tipo,
      email,
      site: campo(linha, ALIASES.site),
      endereco: campo(linha, ALIASES.endereco),
      contato_nome: contatoNome,
      whatsapp_na_fonte: whatsappNaFonte,
      qualidade: campo(linha, ALIASES.qualidade),
      canal: decidirCanal(escolhido.tipo, email),
      confianca_contato: decidirConfianca({ contatoNome, tipo: escolhido.tipo, whatsappNaFonte }),
      nota_encaixe: notaPorPrioridade(campo(linha, ALIASES.prioridade), segmento.icp),
    },
  };
}

// ─── Mensagem ────────────────────────────────────────────────────────────────

const CIDADES_DA_REGIAO = new Set(
  ["marilia", "garca", "tupa", "oriente", "pompeia", "vera cruz", "lucelia", "assis", "bauru", "echapora"]
);

export function ehDaRegiao(cidade: string | null | undefined): boolean {
  return CIDADES_DA_REGIAO.has(semAcento(cidade ?? ""));
}

/** Saudação pelo horário de Brasília. O texto original do fundador fixava "Bom dia". */
export function saudacao(agora: Date = new Date()): "Bom dia" | "Boa tarde" | "Boa noite" {
  const hora = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "America/Sao_Paulo" }).format(agora)
  );
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

export interface LeadParaMensagem {
  nome: string;
  segmento: string;
  cidade: string | null;
  canal: Canal;
  confianca_contato: Confianca;
  contato_nome: string | null;
  telefone_e164: string | null;
  email: string | null;
}

export interface Contato {
  canal: Canal;
  texto: string;
  assunto?: string;
  /** Link que abre o app certo (wa.me, mailto ou tel). Nulo quando não há canal. */
  href: string | null;
}

const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0] ?? nome;

export function linkWhatsapp(e164: string, texto: string): string {
  return `https://wa.me/${e164}?text=${encodeURIComponent(texto)}`;
}

function textoWhatsapp(lead: LeadParaMensagem, agora: Date): string {
  const seg = SEGMENTOS[lead.segmento] ?? SEGMENTOS.arquitetura;
  const local = ehDaRegiao(lead.cidade);
  const origem = local ? "aqui em Marília" : "em Marília (SP)";
  const s = saudacao(agora);

  if (lead.confianca_contato === "pessoa" && lead.contato_nome) {
    const alvo = local ? "empresas da região" : "empresas do setor";
    return [
      `${s}, ${primeiroNome(lead.contato_nome)}! Tudo bem?`,
      `Sou o Matheus, fundador da Pilar, um software de gestão para ${seg.publico} que nasceu ${origem}.`,
      `A Pilar ${seg.oferta}, e estamos apresentando para ${alvo}.`,
      "Podemos marcar uma reunião para te apresentar?",
    ].join("\n");
  }
  return [
    `${s}! Aqui é o Matheus, fundador da Pilar. Falo com a ${lead.nome}?`,
    `A Pilar é um software de gestão para ${seg.publico} que nasceu ${origem}: ${seg.oferta}.`,
    "Com quem eu falo sobre a gestão por aí? Queria te apresentar rapidinho.",
  ].join("\n");
}

/** Monta o texto e o link do canal do lead. Quem envia é sempre o fundador. */
export function montarContato(lead: LeadParaMensagem, agora: Date = new Date()): Contato {
  const seg = SEGMENTOS[lead.segmento] ?? SEGMENTOS.arquitetura;

  if (lead.canal === "whatsapp" && lead.telefone_e164) {
    const texto = textoWhatsapp(lead, agora);
    return { canal: "whatsapp", texto, href: linkWhatsapp(lead.telefone_e164, texto) };
  }

  if (lead.canal === "email" && lead.email) {
    const assunto = `Gestão para ${seg.publico} | Pilar`;
    const texto = [
      `Olá, equipe da ${lead.nome}!`,
      `Sou o Matheus, da Pilar, uma plataforma de gestão para ${seg.publico}: ${seg.oferta}.`,
      "Poderiam indicar quem cuida da organização do trabalho? Se fizer sentido, mostro em 15 minutos um exemplo.",
    ].join("\n\n");
    return {
      canal: "email",
      assunto,
      texto,
      href: `mailto:${lead.email}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(texto)}`,
    };
  }

  if (lead.canal === "ligacao" && lead.telefone_e164) {
    const texto =
      "Olá! Aqui é o Matheus, da Pilar. Gostaria de saber quem na empresa cuida da gestão dos projetos e orçamentos. " +
      "Posso falar rapidamente ou enviar uma apresentação por e-mail?";
    return { canal: "ligacao", texto, href: `tel:+${lead.telefone_e164}` };
  }

  return { canal: "nenhum", texto: "", href: null };
}

export const ROTULO_CANAL: Record<Canal, string> = {
  whatsapp: "WhatsApp",
  email: "E-mail",
  ligacao: "Ligação",
  nenhum: "Sem canal",
};

export const ROTULO_STATUS: Record<string, string> = {
  novo: "Novo",
  fila: "Na fila",
  enviado: "Enviado",
  respondeu: "Respondeu",
  reuniao_marcada: "Reunião marcada",
  sem_interesse: "Sem interesse",
  numero_errado: "Número errado",
  parar: "Não contatar",
};

/** Formata 5514999990000 como (14) 99999-0000. */
export function formatarTelefone(e164: string | null): string {
  if (!e164) return "";
  return extrairTelefones(e164)[0]?.exibicao ?? e164;
}
