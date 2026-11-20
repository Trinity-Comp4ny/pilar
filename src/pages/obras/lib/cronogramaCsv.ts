// Exportação do cronograma da obra em CSV: uma linha por fase, etapa, serviço e tarefa, na ordem da árvore.
import { formatDate } from "@/lib/format";
import { achatarArvore, NIVEL_LABEL, type NoArvore, type NoInput, type TarefaInput } from "./obraArvore";

const CABECALHO = ["Nível", "Item", "Início", "Fim", "Avanço (%)"];

// Célula começada por = + - @ vira fórmula no Excel: prefixa com apóstrofo (mesma regra do relatório financeiro).
const celula = (v: string | number) => {
  const s = String(v);
  const seguro = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${seguro.replace(/"/g, '""')}"`;
};

const data = (iso: string | null | undefined) => (iso ? formatDate(iso) : "");

export function cronogramaParaCsv<N extends NoInput, T extends TarefaInput & { titulo: string }>(
  fases: ReadonlyArray<NoArvore<N, T>>
): string {
  const linhas = achatarArvore(fases, new Set()).map((l) =>
    l.tipo === "no"
      ? [
          NIVEL_LABEL[l.arvore.nivel],
          `${"  ".repeat(l.profundidade)}${l.arvore.no.nome}`,
          data(l.arvore.periodo?.inicio),
          data(l.arvore.periodo?.fim),
          l.arvore.progresso,
        ]
      : [
          "Tarefa",
          `${"  ".repeat(l.profundidade)}${l.tarefa.titulo}`,
          data(l.tarefa.data_inicio),
          data(l.tarefa.prazo),
          l.tarefa.status === "concluida" ? 100 : 0,
        ]
  );
  return [CABECALHO, ...linhas].map((r) => r.map(celula).join(";")).join("\n");
}

/** Baixa o CSV com BOM, para o Excel abrir os acentos certos. */
export function baixarCsv(conteudo: string, nomeArquivo: string) {
  const url = URL.createObjectURL(new Blob(["﻿" + conteudo], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nomeArquivo}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
