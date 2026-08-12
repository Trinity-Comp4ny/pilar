// Colunas personalizáveis da visão em lista de "Meu trabalho" (estilo ClickUp).
// A escolha do usuário fica no navegador (localStorage), como a preferência de
// visão (lista/quadro/agenda). "Nome" é fixo e não entra aqui.
import { useCallback, useEffect, useState } from "react";

export type ColunaLista = "projeto" | "responsavel" | "prazo" | "prioridade" | "etiquetas" | "horas" | "horasreais";

export const COLUNAS_ORDEM: readonly ColunaLista[] = [
  "projeto",
  "responsavel",
  "prazo",
  "prioridade",
  "etiquetas",
  "horas",
  "horasreais",
];

export const COLUNA_LABEL: Record<ColunaLista, string> = {
  projeto: "Projeto",
  responsavel: "Responsável",
  prazo: "Prazo",
  prioridade: "Prioridade",
  etiquetas: "Etiquetas",
  horas: "Horas est.",
  horasreais: "Horas reais",
};

// Largura de cada coluna na grade (o Nome ocupa parte do restante como 1fr).
export const COLUNA_LARGURA: Record<ColunaLista, string> = {
  projeto: "minmax(180px, 1fr)",
  responsavel: "180px",
  prazo: "132px",
  prioridade: "128px",
  etiquetas: "180px",
  horas: "104px",
  horasreais: "104px",
};

const PADRAO: Record<ColunaLista, boolean> = {
  projeto: true,
  responsavel: true,
  prazo: true,
  prioridade: true,
  etiquetas: false,
  horas: false,
  horasreais: false,
};

const LS_KEY = "pilar.meu-trabalho.colunas";

function ler(): Record<ColunaLista, boolean> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { ...PADRAO };
    const parsed = JSON.parse(raw) as Partial<Record<ColunaLista, boolean>>;
    // Mescla com o padrão: coluna nova entra com o default, valor inválido some.
    const merged = { ...PADRAO };
    for (const c of COLUNAS_ORDEM) {
      if (typeof parsed[c] === "boolean") merged[c] = parsed[c] as boolean;
    }
    return merged;
  } catch {
    return { ...PADRAO };
  }
}

export type ColunasLista = {
  visiveis: Record<ColunaLista, boolean>;
  /** Colunas ligadas, na ordem canônica. */
  ativas: ColunaLista[];
  alternar: (coluna: ColunaLista) => void;
};

export function useColunasLista(): ColunasLista {
  const [visiveis, setVisiveis] = useState<Record<ColunaLista, boolean>>(() => ler());

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(visiveis));
    } catch {
      // sem persistência, sem erro.
    }
  }, [visiveis]);

  const alternar = useCallback((coluna: ColunaLista) => {
    setVisiveis((prev) => ({ ...prev, [coluna]: !prev[coluna] }));
  }, []);

  const ativas = COLUNAS_ORDEM.filter((c) => visiveis[c]);
  return { visiveis, ativas, alternar };
}
