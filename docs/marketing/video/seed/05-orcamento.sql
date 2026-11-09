-- Per-discipline budget from the seeded disciplines (hours x cost/hour, 35% target margin).
insert into public.projeto_orcamento_fases (empresa_id, projeto_id, disciplina, horas_estimadas, custo_hora, margem_alvo_pct, valor_venda, created_by)
select p.empresa_id, p.id, pd.nome, pd.horas_estimadas, pd.custo_hora, 35,
       round(pd.horas_estimadas * pd.custo_hora / 0.65), 'a1000000-0000-0000-0000-000000000010'
from public.projetos p join public.projeto_disciplinas pd on pd.projeto_id = p.id
where p.empresa_id = 'a1000000-0000-0000-0000-000000000001'
  and not exists (select 1 from public.projeto_orcamento_fases f where f.projeto_id = p.id);
-- Retrofit: real spending above budget, so the margin guardian has a case.
insert into public.despesas (empresa_id, descricao, valor, status, data_vencimento, data_pagamento, categoria_id, conta_id, projeto_id, forma_pagamento, created_by)
select 'a1000000-0000-0000-0000-000000000001', d.descricao, d.valor, 'Pago', current_date - d.dias, current_date - d.dias,
       'a1000000-0000-0000-0000-000000000625', 'a1000000-0000-0000-0000-000000000601', 'a1000000-0000-0000-0000-000000000406', 'PIX', 'a1000000-0000-0000-0000-000000000010'
from (values ('Projetista MEP terceirizado: redesenho dos dutos', 14800, 20), ('Levantamento cadastral dos forros', 6900, 12)) d(descricao, valor, dias)
where not exists (select 1 from public.despesas where descricao = 'Levantamento cadastral dos forros');
update public.agente_pendencias set status = 'resolvida', resolvida_motivo = 'condicao_sumiu', resolvida_em = now()
where empresa_id = 'a1000000-0000-0000-0000-000000000001' and titulo like 'Sem orçamento por disciplina%';
select public.agente_pendencias_varrer('a1000000-0000-0000-0000-000000000001');
select area, severidade, titulo from public.agente_pendencias where empresa_id = 'a1000000-0000-0000-0000-000000000001' and status = 'aberta';
