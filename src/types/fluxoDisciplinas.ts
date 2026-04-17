export interface FluxoEtapaDisciplina {
  nome: string;
  responsavel_id?: string;
  responsavel_nome?: string;
}

export interface FluxoEtapa {
  ordem: number;
  nome: string;
  disciplinas: FluxoEtapaDisciplina[];
}

/** Backward compat: old fluxos may store disciplinas as string[] */
export type FluxoEtapaRaw = {
  ordem: number;
  nome: string;
  disciplinas: (string | FluxoEtapaDisciplina)[];
};

/** Normalize old string[] format to FluxoEtapaDisciplina[] */
export function normalizeEtapas(etapas: FluxoEtapaRaw[]): FluxoEtapa[] {
  return etapas.map((e) => ({
    ...e,
    disciplinas: e.disciplinas.map((d) => (typeof d === "string" ? { nome: d } : d)),
  }));
}

export interface FluxoDisciplinas {
  id: string;
  empresa_id: string;
  nome: string;
  descricao: string | null;
  etapas: FluxoEtapa[];
  ativo: boolean;
  created_at: string;
}

export interface FluxoInsert {
  nome: string;
  descricao?: string;
  etapas: FluxoEtapa[];
}
