// Situação da placa de obra, compartilhada entre projetos, obras e o mapa.
export const PLACA_STATUS = ["nao_instalada", "instalada", "retirada"] as const;
export type PlacaStatus = (typeof PLACA_STATUS)[number];

export const PLACA_LABEL: Record<PlacaStatus, string> = {
  nao_instalada: "Não instalada",
  instalada: "Instalada",
  retirada: "Retirada",
};

/** Normaliza o valor vindo do banco (texto livre ou nulo) para um estado conhecido. */
export function placaStatusDe(valor: string | null | undefined): PlacaStatus {
  return (PLACA_STATUS as readonly string[]).includes(valor ?? "") ? (valor as PlacaStatus) : "nao_instalada";
}

/** Data de hoje (AAAA-MM-DD), gravada quando a placa muda de situação. */
export function dataDaPlaca(status: PlacaStatus, hoje = new Date()): string | null {
  return status === "nao_instalada" ? null : hoje.toISOString().slice(0, 10);
}
