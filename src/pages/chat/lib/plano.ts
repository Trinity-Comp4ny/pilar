/** Lógica pura dos painéis de orçamento guiado e de prazo em risco (SPEC 148). */

/** "12,5" ou "12.5" viram 12.5; vazio, negativo ou texto viram 0. */
export function lerHoras(texto: string): number {
  const n = Number.parseFloat(texto.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export type LinhaCalculo = { horas: number; custoHora: number };

export type ResumoOrcamento = {
  horas: number;
  custo: number;
  /** Margem prevista em %, ou null sem valor de contrato. */
  margemPct: number | null;
  /** Custo orçado passa do contrato: o projeto nasce com margem negativa. */
  acimaDoContrato: boolean;
};

const arredondar = (n: number) => Math.round(n * 100) / 100;

export function calcularOrcamento(linhas: LinhaCalculo[], contrato: number | null): ResumoOrcamento {
  const validas = linhas.filter((l) => l.horas > 0 && l.custoHora > 0);
  const horas = validas.reduce((s, l) => s + l.horas, 0);
  const custo = arredondar(validas.reduce((s, l) => s + l.horas * l.custoHora, 0));
  const temContrato = contrato !== null && contrato > 0;
  return {
    horas,
    custo,
    margemPct: temContrato ? arredondar(((contrato - custo) / contrato) * 100) : null,
    acimaDoContrato: temContrato && custo > contrato,
  };
}

const DISCIPLINA_FECHADA = ["concluído", "concluido", "pausada"];

/** Disciplina ainda em aberto para o plano de prazo (não concluída nem pausada). */
export const disciplinaAberta = (status: string | null) => !DISCIPLINA_FECHADA.includes((status ?? "").toLowerCase());

export function textoComunicado(o: { cliente: string; projeto: string; entrega: string | null; abertas: number }): {
  assunto: string;
  mensagem: string;
} {
  const prevista = o.entrega ? `, prevista para ${o.entrega},` : "";
  return {
    assunto: `Projeto ${o.projeto}: acompanhamento da entrega`,
    mensagem:
      `Olá, ${o.cliente}.\n\n` +
      `Estamos acompanhando de perto a entrega do projeto ${o.projeto}${prevista} e ainda há ` +
      `${o.abertas} disciplina(s) em andamento. Vamos confirmar com você a data de entrega nos próximos dias.\n\n` +
      `Se preferir falar antes, é só responder este e-mail.`,
  };
}
