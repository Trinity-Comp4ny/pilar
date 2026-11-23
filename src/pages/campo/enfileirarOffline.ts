import { analytics } from "@/lib/analytics";
import { filaOfflineDb } from "./campoOfflineDb";
import type {
  FilaDiaPayload,
  FilaEfetivo,
  FilaFoto,
  FilaImpedimento,
  FilaMedicao,
  FilaTarefaVinculo,
  FilaVisita,
} from "./campoOfflineQueue";

/** Grava o dia na fila offline (IndexedDB) para o `useCampoSync` reenviar depois. */
export async function enfileirarOffline(args: {
  dia: FilaDiaPayload;
  fotos: FilaFoto[];
  medicoes?: FilaMedicao[];
  tarefas?: FilaTarefaVinculo[];
  efetivos?: FilaEfetivo[];
  impedimentos?: FilaImpedimento[];
  visitas?: FilaVisita[];
  rdoId?: string;
}): Promise<void> {
  await filaOfflineDb.salvar({
    id: crypto.randomUUID(),
    criadoEm: Date.now(),
    dia: args.dia,
    fotos: args.fotos,
    medicoes: args.medicoes ?? [],
    tarefas: args.tarefas ?? [],
    efetivos: args.efetivos ?? [],
    impedimentos: args.impedimentos ?? [],
    visitas: args.visitas ?? [],
    rdoId: args.rdoId,
    tentativas: 0,
  });
  analytics.track("campo_dia_enfileirado", { parcial: Boolean(args.rdoId) });
}
