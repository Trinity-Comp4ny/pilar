// SPEC 135: registros de obra (áudio, foto, texto) e o que a IA extraiu deles. Tipos e
// helpers puros que o Pilar Campo e a aba Diário do escritório compartilham.

export type StatusRegistro = "enviado" | "organizando" | "pronto" | "falhou";
export type ResultadoServico = "comecou" | "avancou" | "concluiu" | "parou";

/** O que fica em `obra_registro.extraido` (a edge grava, o app só lê). */
export interface ExtraidoRegistro {
  efetivo_total?: number | null;
  equipes?: Array<{ nome: string; quantidade: number }>;
  servicos?: Array<{ descricao: string; resultado: ResultadoServico }>;
  materiais_faltando?: string[];
  problemas?: string[];
  pendencias?: string[];
  pergunta?: string | null;
}

export type TomChip = "neutro" | "positivo" | "atencao";
export interface ChipRegistro {
  id: string;
  tom: TomChip;
  texto: string;
}

const VERBO_SERVICO: Record<ResultadoServico, string> = {
  comecou: "começou",
  avancou: "avançou",
  concluiu: "concluído",
  parou: "parou",
};

/** Pergunta que o servidor devolve quando falta o efetivo; o campo responde com um número. */
export const PERGUNTA_EFETIVO = "Quantas pessoas trabalharam hoje?";
/** Pergunta de volta quando o áudio não tinha fala. */
export const PERGUNTA_SEM_FALA = "O que foi feito hoje?";

const MAX_CHIPS = 8;

/** Chips do card: o que a IA entendeu do relato, em frases curtas. Vazio quando não extraiu nada. */
export function chipsDoExtraido(e: ExtraidoRegistro | null | undefined): ChipRegistro[] {
  if (!e) return [];
  const chips: ChipRegistro[] = [];
  if (typeof e.efetivo_total === "number") {
    chips.push({
      id: "efetivo",
      tom: "neutro",
      texto: `${e.efetivo_total} ${e.efetivo_total === 1 ? "pessoa" : "pessoas"}`,
    });
  }
  (e.servicos ?? []).forEach((s, i) =>
    chips.push({
      id: `servico-${i}`,
      tom: s.resultado === "parou" ? "atencao" : "positivo",
      texto: `${s.descricao}: ${VERBO_SERVICO[s.resultado]}`,
    })
  );
  (e.materiais_faltando ?? []).forEach((m, i) =>
    chips.push({ id: `material-${i}`, tom: "atencao", texto: `Falta: ${m}` })
  );
  (e.problemas ?? []).forEach((p, i) => chips.push({ id: `problema-${i}`, tom: "atencao", texto: `Problema: ${p}` }));
  (e.pendencias ?? []).forEach((p, i) => chips.push({ id: `pendencia-${i}`, tom: "neutro", texto: `Pendente: ${p}` }));
  return chips.slice(0, MAX_CHIPS);
}

/** "0:48", "3:00". */
export function formatarDuracao(segundos: number): string {
  const s = Math.max(0, Math.round(segundos));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** O que dizer a quem registrou quando a IA não organizou: o registro está salvo, sempre. */
export function mensagemDoErro(erro: string | null | undefined): string {
  switch (erro) {
    case "sem_tokens":
      return "Os créditos de IA da empresa acabaram. Seu registro está salvo e o escritório pode organizar depois.";
    case "audio_indisponivel":
      return "Não encontramos o áudio deste registro. Grave de novo se for importante.";
    case "tempo_esgotado":
    case "provedor_indisponivel":
    case "limite_do_provedor":
      return "A IA demorou para responder. Seu registro está salvo.";
    default:
      return "Não deu para organizar agora. Seu registro está salvo.";
  }
}

/** Enquanto algum registro está sendo organizado, a lista se atualiza sozinha. */
export function temOrganizacaoEmCurso(registros: ReadonlyArray<{ status: StatusRegistro }>): boolean {
  return registros.some((r) => r.status === "enviado" || r.status === "organizando");
}

/** "2026-10-19" na data LOCAL do aparelho (toISOString voltaria o dia em UTC e erraria à noite). */
export function dataLocalIso(d: Date = new Date()): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/** "Hoje, 19 out", "Ontem, 18 out" ou "sexta, 17 out". */
export function rotuloDoDia(iso: string, hoje: Date = new Date()): string {
  const [a, m, d] = iso.split("-").map(Number);
  const dia = new Date(a, m - 1, d);
  const curto = `${d} ${MESES[m - 1]}`;
  const base = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const diff = Math.round((base.getTime() - dia.getTime()) / 86_400_000);
  if (diff === 0) return `Hoje, ${curto}`;
  if (diff === 1) return `Ontem, ${curto}`;
  return `${DIAS[dia.getDay()]}, ${curto}`;
}
