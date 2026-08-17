-- Drill-down da margem (spec 037): as LINHAS que compõem o número de cada projeto.
-- Retorna, para um projeto, as receitas, despesas diretas, custo de mão de obra e
-- parcelas que somam nos totais de rpc_dashboard_rentabilidade. É o que separa
-- "planilha bonita" de "número que o engenheiro audita".
--
-- Segurança: SECURITY DEFINER com guard de empresa explícito (padrão de
-- rpc_custo_real_projeto / 20260725000000), RAISE se o projeto não for do caller, e
-- EXECUTE só para authenticated (NÃO anon). Cada SELECT repete empresa_id como defesa
-- em profundidade. Os filtros de cada bloco replicam EXATAMENTE os do agregado para o
-- detalhe fechar com o total exibido (inclusive não excluir is_fatura_payment nas
-- despesas, igual ao dashboard).
--
-- Retorno jsonb: não altera o shape de nenhuma tabela em types.ts.

create or replace function public.get_projeto_rentabilidade_detalhe(p_projeto_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_empresa_id uuid := public.get_user_empresa_id();
  v_projeto_empresa uuid;
begin
  select empresa_id into v_projeto_empresa
  from projetos
  where id = p_projeto_id and deleted_at is null;

  if v_empresa_id is null or v_projeto_empresa is null or v_projeto_empresa <> v_empresa_id then
    raise exception 'Acesso negado';
  end if;

  return jsonb_build_object(
    'receitas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'descricao', r.descricao,
        'valor', r.valor,
        'status', r.status,
        'data', coalesce(r.data_recebimento, r.data_vencimento, r.data_competencia)
      ) order by coalesce(r.data_recebimento, r.data_vencimento))
      from receitas r
      where r.projeto_id = p_projeto_id and r.deleted_at is null
        and r.empresa_id = v_empresa_id and r.status in ('Recebido', 'Pendente')
    ), '[]'::jsonb),

    'despesas_diretas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'descricao', d.descricao,
        'valor', d.valor,
        'status', d.status,
        'data', coalesce(d.data_pagamento, d.data_vencimento),
        'fornecedor', f.nome
      ) order by coalesce(d.data_pagamento, d.data_vencimento))
      from despesas d
      left join fornecedores f on f.id = d.fornecedor_id
      where d.projeto_id = p_projeto_id and d.deleted_at is null
        and d.empresa_id = v_empresa_id and d.status in ('Pago', 'Pendente')
    ), '[]'::jsonb),

    'custo_mo', coalesce((
      select jsonb_agg(jsonb_build_object(
        'descricao', coalesce(pe.nome, '—') || ' · ' || coalesce(t.disciplina, 'Sem disciplina'),
        'horas', t.horas,
        'data', t.data,
        'valor', t.horas * coalesce(
          case when pe.salario_fixo > 0 and coalesce(pe.horas_semanais, 40) > 0
               then pe.salario_fixo / (coalesce(pe.horas_semanais, 40) * 4.33) end,
          (select case when sum(o.horas_estimadas) > 0
                       then sum(o.horas_estimadas * o.custo_hora) / sum(o.horas_estimadas)
                       else 0 end
           from projeto_orcamento_fases o
           where o.projeto_id = p_projeto_id and o.deleted_at is null),
          0
        )
      ) order by t.data)
      from timesheets t
      left join pessoas pe
        on pe.id = t.pessoa_id and pe.empresa_id = v_empresa_id and pe.deleted_at is null
      where t.projeto_id = p_projeto_id and t.deleted_at is null
        and t.empresa_id = v_empresa_id and t.status = 'aprovado'
    ), '[]'::jsonb),

    'parcelas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'descricao', m.nome,
        'valor', m.valor,
        'status', m.status,
        'percentual', m.percentual,
        'data', coalesce(m.data_faturada, m.data_prevista)
      ) order by m.data_prevista)
      from marcos_faturamento m
      where m.projeto_id = p_projeto_id and m.deleted_at is null
        and m.empresa_id = v_empresa_id
    ), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.get_projeto_rentabilidade_detalhe(uuid) from public, anon;
grant execute on function public.get_projeto_rentabilidade_detalhe(uuid) to authenticated;
