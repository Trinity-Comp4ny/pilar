/**
 * Regra de retenção pós-trial (SPEC 098 Fase 3, ADR 0042/0043): aviso no dia 60,
 * aviso no dia 85, exclusão a partir do dia 90.
 *
 * A exclusão exige que o aviso final tenha saído e que o cliente tenha tido
 * PRAZO_APOS_AVISO dias depois dele. Sem isso, um cron parado por semanas, ao
 * voltar, apagaria empresas que nunca foram avisadas. Nesse caso o aviso sai
 * primeiro e a exclusão espera.
 */

export const DIA_MS = 24 * 60 * 60 * 1000;
export const DIA_AVISO_1 = 60;
export const DIA_AVISO_2 = 85;
export const DIA_EXCLUSAO = 90;
export const PRAZO_APOS_AVISO = 5;

export interface EmpresaEmLeitura {
  id: string;
  nome: string;
  leitura_desde: string;
  retencao_aviso_60d_sent_at: string | null;
  retencao_aviso_85d_sent_at: string | null;
}

export type Acao =
  | { tipo: "excluir"; diasEmLeitura: number }
  | {
      tipo: "avisar";
      dias: 60 | 85;
      coluna: "retencao_aviso_60d_sent_at" | "retencao_aviso_85d_sent_at";
      diasEmLeitura: number;
      diasRestantes: number;
    }
  | null;

const diasEntre = (de: number, ate: number) => Math.floor((ate - de) / DIA_MS);

export function proximaAcao(empresa: EmpresaEmLeitura, agora: number): Acao {
  const inicio = new Date(empresa.leitura_desde).getTime();
  if (!Number.isFinite(inicio)) return null;
  const dias = diasEntre(inicio, agora);

  const aviso2 = empresa.retencao_aviso_85d_sent_at ? new Date(empresa.retencao_aviso_85d_sent_at).getTime() : NaN;
  const aviso2Enviado = Number.isFinite(aviso2);

  if (dias >= DIA_EXCLUSAO && aviso2Enviado && diasEntre(aviso2, agora) >= PRAZO_APOS_AVISO) {
    return { tipo: "excluir", diasEmLeitura: dias };
  }

  if (dias >= DIA_AVISO_2 && !aviso2Enviado) {
    return {
      tipo: "avisar",
      dias: 85,
      coluna: "retencao_aviso_85d_sent_at",
      diasEmLeitura: dias,
      // Atrasado (cron parado): o prazo conta a partir do aviso, não do calendário.
      diasRestantes: Math.max(DIA_EXCLUSAO - dias, PRAZO_APOS_AVISO),
    };
  }

  if (dias >= DIA_AVISO_1 && dias < DIA_AVISO_2 && !empresa.retencao_aviso_60d_sent_at) {
    return {
      tipo: "avisar",
      dias: 60,
      coluna: "retencao_aviso_60d_sent_at",
      diasEmLeitura: dias,
      diasRestantes: DIA_EXCLUSAO - dias,
    };
  }

  return null;
}
