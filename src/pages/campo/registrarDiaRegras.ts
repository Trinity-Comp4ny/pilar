import type { FilaMedicao } from "./campoOfflineQueue";

/**
 * Regras do "Registrar o dia" do Pilar Campo, sem tela: o que vale como
 * quantidade de pessoas, quais medições entram e quando a recusa do servidor
 * significa sessão vencida. Ficam fora do componente para serem testadas
 * diretamente e manterem o formulário enxuto.
 */

/** Quantidade de pessoas: inteiro maior que zero. "dez" ou "2,5" viravam NaN e travavam a fila. */
export function pessoasValidas(quantidade: string): number | null {
  const n = Number(quantidade.trim());
  return Number.isInteger(n) && n > 0 ? n : null;
}

export interface MedicaoDigitada {
  item: string;
  quantidade: string;
  unidade: string;
}

export const medicaoVazia = (): MedicaoDigitada => ({ item: "", quantidade: "", unidade: "" });

/**
 * Só medição completa entra; linha em branco fica de fora em silêncio (a pessoa só
 * clicou "+"). Quantidade que não é número positivo (ex.: "muitos") barra o envio.
 */
export function separarMedicoes(medicoes: MedicaoDigitada[]): {
  invalida: MedicaoDigitada | null;
  validas: FilaMedicao[];
} {
  const completas = medicoes.filter(
    (m) => m.item.trim() !== "" && m.quantidade.trim() !== "" && m.unidade.trim() !== ""
  );
  const invalida = completas.find((m) => !(Number(m.quantidade) > 0)) ?? null;
  const validas = completas.map((m) => ({
    item: m.item.trim(),
    quantidade: Number(m.quantidade),
    unidade: m.unidade.trim(),
    enviada: false,
  }));
  return { invalida, validas };
}

/** Recusa do servidor que significa sessão do campo vencida: volta ao login. */
export function sessaoVencida(erro: string | null | undefined): boolean {
  return erro === "Sessão inválida";
}
