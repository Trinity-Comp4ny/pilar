// Peso de cada tarefa na Curva S: a parte do orçado da frente que ela ocupa.
// Frente com R$ 90 mil e 3 tarefas dá R$ 30 mil a cada; tarefa de frente sem orçado pesa a média das demais.

interface TarefaComFrente {
  id: string;
  obra_frente_id: string | null;
}

export function pesosPorTarefa(
  tarefas: ReadonlyArray<TarefaComFrente>,
  previstoPorFrente: ReadonlyMap<string, number>
): Map<string, number> {
  const porFrente = new Map<string, number>();
  for (const t of tarefas) {
    if (t.obra_frente_id) porFrente.set(t.obra_frente_id, (porFrente.get(t.obra_frente_id) ?? 0) + 1);
  }
  const pesos = new Map<string, number>();
  for (const t of tarefas) {
    const previsto = t.obra_frente_id ? (previstoPorFrente.get(t.obra_frente_id) ?? 0) : 0;
    const qtd = t.obra_frente_id ? (porFrente.get(t.obra_frente_id) ?? 1) : 1;
    if (previsto > 0) pesos.set(t.id, previsto / qtd);
  }
  if (pesos.size === 0) return pesos;
  const media = [...pesos.values()].reduce((a, b) => a + b, 0) / pesos.size;
  for (const t of tarefas) if (!pesos.has(t.id)) pesos.set(t.id, media);
  return pesos;
}
