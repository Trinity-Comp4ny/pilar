// Limites de data de uma disciplina dentro do "guarda-chuva" do projeto (extraído de DisciplinasTableView).

export function isoSlice(d?: string | null): string | undefined {
  return d ? d.slice(0, 10) : undefined;
}

/** Maior data (limite inferior mais restritivo). */
export function laterOf(...ds: (string | null | undefined)[]): string | undefined {
  const v = ds.map(isoSlice).filter(Boolean) as string[];
  return v.length ? [...v].sort()[v.length - 1] : undefined;
}

/** Menor data (limite superior mais restritivo). */
export function earlierOf(...ds: (string | null | undefined)[]): string | undefined {
  const v = ds.map(isoSlice).filter(Boolean) as string[];
  return v.length ? [...v].sort()[0] : undefined;
}
