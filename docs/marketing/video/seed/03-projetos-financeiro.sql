do $$
declare
  e uuid := 'a1000000-0000-0000-0000-000000000001';
  u uuid := 'a1000000-0000-0000-0000-000000000010';
  d date := current_date;
  conta uuid := 'a1000000-0000-0000-0000-000000000601';
  c_hon uuid := 'a1000000-0000-0000-0000-000000000621';
  c_fol uuid := 'a1000000-0000-0000-0000-000000000623';
  c_sw  uuid := 'a1000000-0000-0000-0000-000000000624';
  c_ter uuid := 'a1000000-0000-0000-0000-000000000625';
  c_esc uuid := 'a1000000-0000-0000-0000-000000000626';
  m int;
begin
  if exists (select 1 from public.projetos where id = 'a1000000-0000-0000-0000-000000000401') then return; end if;

  insert into public.contas (id, empresa_id, nome, banco, saldo_inicial, saldo_atual, cor) values
    (conta, e, 'Conta Corrente', 'Itaú', 180000, 180000, '#2E7D32');
  insert into public.categorias_financeiras (id, empresa_id, nome, tipo) values
    (c_hon, e, 'Honorários de projeto', 'Receita'),
    (c_fol, e, 'Folha e pró-labore', 'Despesa'),
    (c_sw,  e, 'Software e licenças', 'Despesa'),
    (c_ter, e, 'Serviços terceirizados', 'Despesa'),
    (c_esc, e, 'Despesas de escritório', 'Despesa');

  insert into public.projetos (id, empresa_id, cliente_id, codigo_projeto, nome, localizacao, status, prioridade, data_inicio, data_previsao, valor_contrato, area_m2, created_by) values
    ('a1000000-0000-0000-0000-000000000401', e, 'a1000000-0000-0000-0000-000000000101', 'PRJ-2026-014', 'Edifício Alameda Jardins', 'Campinas, SP', 'Em andamento', 'Alta', d - 150, d + 90, 480000, 6800, u),
    ('a1000000-0000-0000-0000-000000000402', e, 'a1000000-0000-0000-0000-000000000102', 'PRJ-2026-019', 'Clínica Vitta Cambuí', 'Campinas, SP', 'Em andamento', 'Alta', d - 80, d + 60, 186000, 1450, u),
    ('a1000000-0000-0000-0000-000000000403', e, 'a1000000-0000-0000-0000-000000000103', 'PRJ-2026-021', 'Ampliação Colégio Monte Azul', 'Valinhos, SP', 'Revisão', 'Media', d - 70, d + 20, 142000, 1100, u),
    ('a1000000-0000-0000-0000-000000000404', e, 'a1000000-0000-0000-0000-000000000104', 'PRJ-2026-011', 'Residência Toledo', 'Campinas, SP', 'Em andamento', 'Media', d - 95, d + 150, 96000, 380, u),
    ('a1000000-0000-0000-0000-000000000405', e, 'a1000000-0000-0000-0000-000000000105', 'PRJ-2026-024', 'Galpão Anhanguera', 'Jundiaí, SP', 'Planejamento', 'Media', d + 5, d + 155, 210000, 6200, u),
    ('a1000000-0000-0000-0000-000000000406', e, 'a1000000-0000-0000-0000-000000000106', 'PRJ-2026-017', 'Retrofit Hotel Serra Verde', 'Atibaia, SP', 'Em andamento', 'Alta', d - 110, d + 15, 158000, 3200, u),
    ('a1000000-0000-0000-0000-000000000407', e, 'a1000000-0000-0000-0000-000000000107', 'PRJ-2026-006', 'Sede Grupo Solaris', 'Hortolândia, SP', 'Concluído', 'Media', d - 260, d - 30, 230000, 2400, u);

  insert into public.projeto_disciplinas (id, projeto_id, nome, status, prioridade, horas_estimadas, horas_realizadas, custo_hora, data_inicio, data_fim) values
    ('a1000000-0000-0000-0000-000000000411', 'a1000000-0000-0000-0000-000000000401', 'Fundações', 'Concluído', 'Alta', 260, 248, 190, d - 150, d - 90),
    ('a1000000-0000-0000-0000-000000000412', 'a1000000-0000-0000-0000-000000000401', 'Estrutural', 'Em Andamento', 'Alta', 900, 610, 180, d - 120, d + 40),
    ('a1000000-0000-0000-0000-000000000413', 'a1000000-0000-0000-0000-000000000401', 'Instalações (MEP)', 'Em Andamento', 'Media', 700, 340, 160, d - 60, d + 85),
    ('a1000000-0000-0000-0000-000000000414', 'a1000000-0000-0000-0000-000000000402', 'Arquitetura', 'Concluído', 'Alta', 320, 300, 150, d - 80, d - 30),
    ('a1000000-0000-0000-0000-000000000415', 'a1000000-0000-0000-0000-000000000402', 'Instalações (MEP)', 'Em Andamento', 'Alta', 420, 260, 160, d - 40, d + 55),
    ('a1000000-0000-0000-0000-000000000416', 'a1000000-0000-0000-0000-000000000403', 'Estrutural', 'Em Andamento', 'Media', 380, 350, 180, d - 70, d + 20),
    ('a1000000-0000-0000-0000-000000000417', 'a1000000-0000-0000-0000-000000000404', 'Arquitetura', 'Concluído', 'Media', 180, 176, 150, d - 95, d - 40),
    ('a1000000-0000-0000-0000-000000000418', 'a1000000-0000-0000-0000-000000000404', 'Estrutural', 'Concluído', 'Media', 120, 112, 180, d - 70, d - 35),
    ('a1000000-0000-0000-0000-000000000419', 'a1000000-0000-0000-0000-000000000405', 'Estrutural', 'Não Iniciado', 'Media', 820, 0, 180, d + 5, d + 140),
    ('a1000000-0000-0000-0000-00000000041a', 'a1000000-0000-0000-0000-000000000406', 'Instalações (MEP)', 'Em Andamento', 'Alta', 520, 610, 160, d - 110, d + 15),
    ('a1000000-0000-0000-0000-00000000041b', 'a1000000-0000-0000-0000-000000000406', 'Climatização (HVAC)', 'Em Andamento', 'Alta', 260, 230, 170, d - 90, d + 15),
    ('a1000000-0000-0000-0000-00000000041c', 'a1000000-0000-0000-0000-000000000407', 'Estrutural', 'Concluído', 'Media', 700, 690, 180, d - 260, d - 40);

  insert into public.projeto_disciplina_responsaveis (projeto_disciplina_id, pessoa_id) values
    ('a1000000-0000-0000-0000-000000000412', 'a1000000-0000-0000-0000-000000000502'),
    ('a1000000-0000-0000-0000-000000000413', 'a1000000-0000-0000-0000-000000000503'),
    ('a1000000-0000-0000-0000-000000000415', 'a1000000-0000-0000-0000-000000000503'),
    ('a1000000-0000-0000-0000-000000000416', 'a1000000-0000-0000-0000-000000000502'),
    ('a1000000-0000-0000-0000-00000000041a', 'a1000000-0000-0000-0000-000000000503'),
    ('a1000000-0000-0000-0000-00000000041b', 'a1000000-0000-0000-0000-000000000503');

  insert into public.escopos (id, empresa_id, projeto_id, descricao, tipo, status, horas_estimadas, custo_estimado, valor_aditivo, impacto_prazo_dias, justificativa, aprovado_por, aprovado_em, created_by) values
    ('a1000000-0000-0000-0000-000000000421', e, 'a1000000-0000-0000-0000-000000000406', 'Escopo original: MEP e climatização do retrofit', 'original', 'aprovado', 780, 127400, null, 0, null, u, now() - interval '108 days', u),
    ('a1000000-0000-0000-0000-000000000422', e, 'a1000000-0000-0000-0000-000000000406', 'Aditivo: novo traçado de dutos após a troca dos forros', 'aditivo', 'pendente_aprovacao', 120, 19200, 26500, 12, 'O cliente trocou o forro de 3 pavimentos depois da compatibilização. As horas extras de MEP vêm das despesas e apontamentos do projeto.', null, null, u);

  -- 6 months of revenue and expenses so the cash flow chart has history
  for m in 0..5 loop
    insert into public.receitas (empresa_id, descricao, valor, status, data_vencimento, data_recebimento, projeto_id, categoria_id, conta_id, forma_pagamento, created_by) values
      (e, 'Parcela Edifício Alameda Jardins', 48000 + m * 1500, 'Recebido', (date_trunc('month', d) - (m || ' months')::interval)::date + 9, (date_trunc('month', d) - (m || ' months')::interval)::date + 9, 'a1000000-0000-0000-0000-000000000401', c_hon, conta, 'PIX', u),
      (e, 'Parcela Clínica Vitta Cambuí', 31000, 'Recebido', (date_trunc('month', d) - (m || ' months')::interval)::date + 14, (date_trunc('month', d) - (m || ' months')::interval)::date + 15, 'a1000000-0000-0000-0000-000000000402', c_hon, conta, 'Boleto', u),
      (e, 'Parcela Retrofit Hotel Serra Verde', 26000, 'Recebido', (date_trunc('month', d) - (m || ' months')::interval)::date + 19, (date_trunc('month', d) - (m || ' months')::interval)::date + 19, 'a1000000-0000-0000-0000-000000000406', c_hon, conta, 'PIX', u);
    insert into public.despesas (empresa_id, descricao, valor, status, data_vencimento, data_pagamento, categoria_id, conta_id, forma_pagamento, created_by) values
      (e, 'Folha e pró-labore', 66700, 'Pago', (date_trunc('month', d) - (m || ' months')::interval)::date + 4, (date_trunc('month', d) - (m || ' months')::interval)::date + 4, c_fol, conta, 'Transferência', u),
      (e, 'Aluguel do escritório', 6500, 'Pago', (date_trunc('month', d) - (m || ' months')::interval)::date + 9, (date_trunc('month', d) - (m || ' months')::interval)::date + 9, c_esc, conta, 'Boleto', u),
      (e, 'Licenças Revit, TQS e AutoCAD', 4200, 'Pago', (date_trunc('month', d) - (m || ' months')::interval)::date + 11, (date_trunc('month', d) - (m || ' months')::interval)::date + 11, c_sw, conta, 'Cartão', u),
      (e, 'Topografia e sondagem terceirizadas', 5800 + m * 400, 'Pago', (date_trunc('month', d) - (m || ' months')::interval)::date + 17, (date_trunc('month', d) - (m || ' months')::interval)::date + 17, c_ter, conta, 'PIX', u);
  end loop;

  -- open items: upcoming, overdue
  insert into public.receitas (empresa_id, descricao, valor, status, data_vencimento, projeto_id, categoria_id, conta_id, forma_pagamento, created_by) values
    (e, 'Entrada Galpão Anhanguera (30%)', 63000, 'Pendente', d + 6, 'a1000000-0000-0000-0000-000000000405', c_hon, conta, 'PIX', u),
    (e, 'Parcela 3 Ampliação Colégio Monte Azul', 35500, 'Atrasado', d - 4, 'a1000000-0000-0000-0000-000000000403', c_hon, conta, 'Boleto', u),
    (e, 'Parcela 4 Residência Toledo', 16000, 'Pendente', d + 12, 'a1000000-0000-0000-0000-000000000404', c_hon, conta, 'PIX', u);
end $$;
