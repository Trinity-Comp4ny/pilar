import type { DisciplinaResponsavel } from "@/types/projetos";

/** Colunas iguais continuam em paralelo; só uma coluna anterior pode impedir o avanço. */
export function terceirizadaPendenteAnterior(disc: DisciplinaResponsavel, disciplinas: DisciplinaResponsavel[]) {
  if (disc.etapa == null) return null;
  return (
    disciplinas.find(
      (d) =>
        d !== disc &&
        d.etapa != null &&
        d.etapa < disc.etapa! &&
        d.tipo_execucao === "terceirizada" &&
        d.status !== "Concluído" &&
        !d.data_final
    ) ?? null
  );
}
