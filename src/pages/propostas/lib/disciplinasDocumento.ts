interface DisciplinaSalva {
  disciplina: string;
  horas_estimadas: number | null;
  custo_hora: number | null;
  valor_venda: number | null;
}

// Disciplinas para o documento enviado ao cliente: leva o valor de venda.
// Sem ele, as variáveis {{DISCIPLINAS_COM_VALOR}} caem em horas × custo/hora
// e o cliente veria o custo interno no lugar do preço.
export function disciplinasDoDocumento(lista: DisciplinaSalva[]) {
  return lista.map((d) => ({
    disciplina: d.disciplina,
    horas_estimadas: Number(d.horas_estimadas),
    custo_hora: Number(d.custo_hora),
    valor_venda: d.valor_venda == null ? undefined : Number(d.valor_venda),
  }));
}
