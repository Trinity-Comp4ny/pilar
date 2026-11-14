// Agrupamento das perguntas sem resposta da ajuda (SPEC 155) para a lista do Ultra admin.
export interface LacunaBruta {
  texto: string;
  rota: string | null;
  origem: string;
  empresa_id: string | null;
  created_at: string;
}

export interface LacunaAgrupada {
  texto: string;
  vezes: number;
  escritorios: number;
  telas: string[];
  ultima: string;
}

/** Mesma pergunta (já normalizada na gravação) vira uma linha; mais repetida primeiro. */
export function agruparLacunas(linhas: LacunaBruta[]): LacunaAgrupada[] {
  const grupos = new Map<string, { vezes: number; empresas: Set<string>; telas: Set<string>; ultima: string }>();
  for (const l of linhas) {
    const g = grupos.get(l.texto) ?? { vezes: 0, empresas: new Set(), telas: new Set(), ultima: l.created_at };
    g.vezes += 1;
    if (l.empresa_id) g.empresas.add(l.empresa_id);
    if (l.rota) g.telas.add(l.rota);
    if (l.created_at > g.ultima) g.ultima = l.created_at;
    grupos.set(l.texto, g);
  }
  return [...grupos.entries()]
    .map(([texto, g]) => ({
      texto,
      vezes: g.vezes,
      escritorios: g.empresas.size,
      telas: [...g.telas].sort(),
      ultima: g.ultima,
    }))
    .sort((a, b) => b.vezes - a.vezes || b.ultima.localeCompare(a.ultima));
}
