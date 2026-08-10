-- Dados de DEMONSTRAÇÃO para o ambiente local (empresa/admin criados por seed-local).
-- Popula os módulos de produção: clientes, leads, propostas, projetos (disciplinas,
-- escopos, aditivos, marcos), financeiro (contas, cartões, categorias, receitas,
-- despesas, faturas), pessoas/folha e obras (frentes, orçamento, conta, RDO).
--
-- Idempotente: se o primeiro cliente demo já existe, não faz nada.
-- IDs fixos por faixa para amarrar as FKs e permitir reexecução limpa.

do $$
declare
  v_emp  uuid := '00000000-0000-0000-0000-000000000001';  -- empresa dev
  v_usr  uuid := '00000000-0000-0000-0000-000000000010';  -- admin dev
  d date := current_date;
begin
  if not exists (select 1 from public.empresas where id = v_emp) then
    raise exception 'Empresa dev não existe. Rode `npm run seed:local` primeiro.';
  end if;
  if exists (select 1 from public.clientes where id = '00000000-0000-0000-0000-000000000101') then
    raise notice 'Dados demo já existem, nada a fazer.';
    return;
  end if;

  -- =====================================================================
  -- CLIENTES
  -- =====================================================================
  insert into public.clientes (id, empresa_id, nome, sobrenome, tipo_pessoa, cpf_cnpj, email, contato, origem, created_by) values
    ('00000000-0000-0000-0000-000000000101', v_emp, 'Construtora Horizonte', null, 'PJ', '12.345.678/0001-90', 'contato@horizonte.com.br', '(11) 3200-1000', 'Indicação', v_usr),
    ('00000000-0000-0000-0000-000000000102', v_emp, 'Incorporadora Vale Verde', null, 'PJ', '98.765.432/0001-10', 'projetos@valeverde.com.br', '(11) 3400-2000', 'Site', v_usr),
    ('00000000-0000-0000-0000-000000000103', v_emp, 'Marcelo', 'Andrade', 'PF', '123.456.789-00', 'marcelo.andrade@email.com', '(11) 99876-5432', 'Indicação', v_usr),
    ('00000000-0000-0000-0000-000000000104', v_emp, 'Condomínio Parque das Águas', null, 'PJ', '45.678.912/0001-33', 'sindico@parquedasaguas.com.br', '(11) 3600-3000', 'Evento', v_usr);

  -- =====================================================================
  -- LEADS (vários estágios; um convertido aponta para cliente)
  -- =====================================================================
  insert into public.leads (id, empresa_id, nome, sobrenome, empresa_lead, email, contato, status, origem, valor_estimado, previsao_fechamento, responsavel_id, notas, cliente_id, convertido_em, created_by) values
    ('00000000-0000-0000-0000-000000000201', v_emp, 'Patrícia', 'Lima', 'Retrofit Engenharia', 'patricia@retrofit.com.br', '(11) 98111-2222', 'Novo', 'Site', 85000, d + 30, null, 'Reforma de galpão logístico.', null, null, v_usr),
    ('00000000-0000-0000-0000-000000000202', v_emp, 'Roberto', 'Nunes', 'RN Empreendimentos', 'roberto@rnemp.com.br', '(11) 98333-4444', 'Em contato', 'Indicação', 140000, d + 45, null, 'Projeto estrutural de edifício residencial.', null, null, v_usr),
    ('00000000-0000-0000-0000-000000000203', v_emp, 'Fernanda', 'Souza', 'Vale Verde', 'fernanda@valeverde.com.br', '(11) 98555-6666', 'Ganho', 'Site', 210000, d - 10, null, 'Convertido em cliente PJ.', '00000000-0000-0000-0000-000000000102', now() - interval '10 days', v_usr),
    ('00000000-0000-0000-0000-000000000204', v_emp, 'Carlos', 'Pereira', 'CP Construções', 'carlos@cpconstrucoes.com.br', '(11) 98777-8888', 'Perdido', 'Evento', 60000, d - 20, null, 'Optou por concorrente.', null, null, v_usr);

  -- =====================================================================
  -- PESSOAS (equipe) + folha
  -- =====================================================================
  insert into public.pessoas (id, empresa_id, primeiro_nome, sobrenome, nome, email, cargo, tipo_contrato, status, salario_fixo, valor_m2, horas_semanais, data_admissao, telefone, profile_id, created_by) values
    ('00000000-0000-0000-0000-000000000501', v_emp, 'Dev', 'Local', 'Dev Local', 'dev@local.test', 'Sócio-diretor', 'socio', 'ativo', 18000, 0, 44, d - 400, '(11) 99000-0001', v_usr, v_usr),
    ('00000000-0000-0000-0000-000000000502', v_emp, 'Juliana', 'Costa', 'Juliana Costa', 'juliana@empresa.dev', 'Engenheira estrutural', 'clt', 'ativo', 9500, 0, 44, d - 300, '(11) 99000-0002', null, v_usr),
    ('00000000-0000-0000-0000-000000000503', v_emp, 'Rafael', 'Mendes', 'Rafael Mendes', 'rafael@empresa.dev', 'Engenheiro MEP', 'pj', 'ativo', 11000, 0, 40, d - 250, '(11) 99000-0003', null, v_usr),
    ('00000000-0000-0000-0000-000000000504', v_emp, 'Beatriz', 'Rocha', 'Beatriz Rocha', 'beatriz@empresa.dev', 'Estagiária', 'estagiario', 'ativo', 2000, 0, 30, d - 120, '(11) 99000-0004', null, v_usr),
    ('00000000-0000-0000-0000-000000000505', v_emp, 'Thiago', 'Alves', 'Thiago Alves', 'thiago@empresa.dev', 'Coordenador de obras', 'clt', 'ativo', 12000, 0, 44, d - 200, '(11) 99000-0005', null, v_usr);

  insert into public.folha_pagamento (id, empresa_id, pessoa_id, mes, ano, salario_fixo, adicional_variavel, total_receber, status) values
    ('00000000-0000-0000-0000-000000000b01', v_emp, '00000000-0000-0000-0000-000000000502', extract(month from d)::int, extract(year from d)::int, 9500, 500, 10000, 'pago'),
    ('00000000-0000-0000-0000-000000000b02', v_emp, '00000000-0000-0000-0000-000000000503', extract(month from d)::int, extract(year from d)::int, 11000, 0, 11000, 'pendente');

  -- =====================================================================
  -- FINANCEIRO: contas, cartões, categorias, centros de custo, fornecedores
  -- =====================================================================
  insert into public.contas (id, empresa_id, nome, banco, saldo_inicial, saldo_atual, cor) values
    ('00000000-0000-0000-0000-000000000601', v_emp, 'Conta Corrente', 'Itaú', 50000, 50000, '#2E7D32'),
    ('00000000-0000-0000-0000-000000000602', v_emp, 'Conta Reserva', 'Nubank', 120000, 120000, '#7C3AED');

  insert into public.cartoes (id, empresa_id, nome, dia_fechamento, dia_vencimento, limite, conta_pagamento_id, cor) values
    ('00000000-0000-0000-0000-000000000611', v_emp, 'Cartão Corporativo', 25, 5, 30000, '00000000-0000-0000-0000-000000000601', '#111827');

  insert into public.categorias_financeiras (id, empresa_id, nome, tipo) values
    ('00000000-0000-0000-0000-000000000621', v_emp, 'Honorários de projeto', 'Receita'),
    ('00000000-0000-0000-0000-000000000622', v_emp, 'Consultoria', 'Receita'),
    ('00000000-0000-0000-0000-000000000623', v_emp, 'Folha e pró-labore', 'Despesa'),
    ('00000000-0000-0000-0000-000000000624', v_emp, 'Software e licenças', 'Despesa'),
    ('00000000-0000-0000-0000-000000000625', v_emp, 'Serviços terceirizados', 'Despesa'),
    ('00000000-0000-0000-0000-000000000626', v_emp, 'Despesas de escritório', 'Despesa');

  insert into public.centros_custo (id, empresa_id, codigo, nome, ativo, created_by) values
    ('00000000-0000-0000-0000-000000000631', v_emp, 'ADM', 'Administrativo', true, v_usr),
    ('00000000-0000-0000-0000-000000000632', v_emp, 'PROJ', 'Projetos', true, v_usr);

  insert into public.fornecedores (id, empresa_id, nome, cnpj, contato, email, telefone) values
    ('00000000-0000-0000-0000-000000000641', v_emp, 'Autodesk', '00.000.000/0001-00', 'suporte', 'billing@autodesk.com', '0800-000-000'),
    ('00000000-0000-0000-0000-000000000642', v_emp, 'Ferro & Cia Materiais', '11.111.111/0001-11', 'vendas', 'vendas@ferrocia.com.br', '(11) 3000-0000'),
    ('00000000-0000-0000-0000-000000000643', v_emp, 'Topografia Precisa', '22.222.222/0001-22', 'comercial', 'contato@topoprecisa.com.br', '(11) 3100-0000');

  -- =====================================================================
  -- PROJETOS + disciplinas + escopos (original e aditivo) + marcos
  -- =====================================================================
  insert into public.projetos (id, empresa_id, cliente_id, codigo_projeto, nome, localizacao, status, prioridade, data_inicio, data_previsao, valor_contrato, area_m2, created_by) values
    ('00000000-0000-0000-0000-000000000401', v_emp, '00000000-0000-0000-0000-000000000101', 'PRJ-2026-001', 'Edifício Comercial Horizonte', 'São Paulo, SP', 'Em andamento', 'Alta', d - 60, d + 120, 320000, 4200, v_usr),
    ('00000000-0000-0000-0000-000000000402', v_emp, '00000000-0000-0000-0000-000000000102', 'PRJ-2026-002', 'Residencial Vale Verde', 'Campinas, SP', 'Planejamento', 'Media', d - 15, d + 200, 210000, 3100, v_usr),
    ('00000000-0000-0000-0000-000000000403', v_emp, '00000000-0000-0000-0000-000000000104', 'PRJ-2025-018', 'Reforma Parque das Águas', 'Santo André, SP', 'Concluído', 'Media', d - 300, d - 30, 95000, 1800, v_usr);

  insert into public.projeto_disciplinas (id, projeto_id, nome, status, prioridade, horas_estimadas, custo_hora, data_inicio, data_fim) values
    ('00000000-0000-0000-0000-000000000411', '00000000-0000-0000-0000-000000000401', 'Estrutural', 'Em Andamento', 'Alta', 320, 180, d - 55, d + 40),
    ('00000000-0000-0000-0000-000000000412', '00000000-0000-0000-0000-000000000401', 'Instalações (MEP)', 'Em Andamento', 'Media', 240, 160, d - 40, d + 60),
    ('00000000-0000-0000-0000-000000000413', '00000000-0000-0000-0000-000000000401', 'Fundações', 'Concluído', 'Alta', 120, 190, d - 55, d - 20),
    ('00000000-0000-0000-0000-000000000414', '00000000-0000-0000-0000-000000000402', 'Estrutural', 'Não Iniciado', 'Media', 260, 180, d + 5, d + 120),
    ('00000000-0000-0000-0000-000000000415', '00000000-0000-0000-0000-000000000403', 'Estrutural', 'Concluído', 'Media', 140, 170, d - 290, d - 40);

  insert into public.projeto_disciplina_responsaveis (projeto_disciplina_id, pessoa_id) values
    ('00000000-0000-0000-0000-000000000411', '00000000-0000-0000-0000-000000000502'),
    ('00000000-0000-0000-0000-000000000412', '00000000-0000-0000-0000-000000000503'),
    ('00000000-0000-0000-0000-000000000414', '00000000-0000-0000-0000-000000000502');

  insert into public.escopos (id, empresa_id, projeto_id, descricao, tipo, status, horas_estimadas, custo_estimado, valor_aditivo, impacto_prazo_dias, justificativa, aprovado_por, aprovado_em, created_by) values
    ('00000000-0000-0000-0000-000000000421', v_emp, '00000000-0000-0000-0000-000000000401', 'Escopo original: projeto estrutural e MEP completo', 'original', 'aprovado', 560, 98000, null, 0, null, v_usr, now() - interval '58 days', v_usr),
    ('00000000-0000-0000-0000-000000000422', v_emp, '00000000-0000-0000-0000-000000000401', 'Aditivo: reforço estrutural por mudança de carga do cliente', 'aditivo', 'pendente_aprovacao', 80, 15200, 22000, 15, 'Cliente alterou uso do 3º pavimento para arquivo pesado.', null, null, v_usr);

  insert into public.escopo_itens (id, escopo_id, descricao, disciplina, horas, custo) values
    ('00000000-0000-0000-0000-000000000431', '00000000-0000-0000-0000-000000000421', 'Dimensionamento de vigas e pilares', 'Estrutural', 200, 36000),
    ('00000000-0000-0000-0000-000000000432', '00000000-0000-0000-0000-000000000421', 'Projeto de instalações hidráulicas e elétricas', 'MEP', 240, 38400),
    ('00000000-0000-0000-0000-000000000433', '00000000-0000-0000-0000-000000000422', 'Recálculo de laje do 3º pavimento', 'Estrutural', 80, 15200);

  -- RECEITAS (inseridas antes dos marcos, que referenciam receita_id)
  insert into public.receitas (id, empresa_id, descricao, valor, status, data_vencimento, data_recebimento, projeto_id, cliente_id, categoria_id, conta_id, centro_custo_id, forma_pagamento, created_by) values
    ('00000000-0000-0000-0000-000000000701', v_emp, 'Entrada contrato Horizonte (30%)', 96000, 'Recebido', d - 58, d - 58, '00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000621', '00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000632', 'PIX', v_usr),
    ('00000000-0000-0000-0000-000000000702', v_emp, 'Pagamento final Parque das Águas', 95000, 'Recebido', d - 38, d - 38, '00000000-0000-0000-0000-000000000403', '00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000621', '00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000632', 'Transferência', v_usr),
    ('00000000-0000-0000-0000-000000000703', v_emp, 'Parcela 2 contrato Horizonte', 128000, 'Pendente', d + 10, null, '00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000621', '00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000632', 'Boleto', v_usr),
    ('00000000-0000-0000-0000-000000000704', v_emp, 'Consultoria avulsa Marcelo Andrade', 12000, 'Atrasado', d - 6, null, null, '00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000622', '00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000631', 'PIX', v_usr),
    ('00000000-0000-0000-0000-000000000705', v_emp, 'Entrada Residencial Vale Verde', 63000, 'Pendente', d + 25, null, '00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000621', '00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000632', 'PIX', v_usr);

  insert into public.marcos_faturamento (id, empresa_id, projeto_id, nome, disciplina, percentual, valor, data_prevista, data_faturada, status, receita_id, created_by) values
    ('00000000-0000-0000-0000-000000000441', v_emp, '00000000-0000-0000-0000-000000000401', 'Assinatura do contrato', 'Geral', 30, 96000, d - 60, d - 58, 'recebido', '00000000-0000-0000-0000-000000000701', v_usr),
    ('00000000-0000-0000-0000-000000000442', v_emp, '00000000-0000-0000-0000-000000000401', 'Entrega do projeto estrutural', 'Estrutural', 40, 128000, d + 10, null, 'pendente', null, v_usr),
    ('00000000-0000-0000-0000-000000000443', v_emp, '00000000-0000-0000-0000-000000000401', 'Entrega final', 'Geral', 30, 96000, d + 120, null, 'pendente', null, v_usr),
    ('00000000-0000-0000-0000-000000000444', v_emp, '00000000-0000-0000-0000-000000000403', 'Marco único concluído', 'Geral', 100, 95000, d - 40, d - 38, 'recebido', '00000000-0000-0000-0000-000000000702', v_usr);

  -- =====================================================================
  -- PROPOSTAS (rascunho / enviada / aceita) + disciplinas
  -- =====================================================================
  insert into public.propostas (id, empresa_id, lead_id, cliente_id, codigo, titulo, localizacao, area_m2, valor_proposto, custo_estimado, margem_estimada_pct, prazo_estimado_dias, status, validade, created_by) values
    ('00000000-0000-0000-0000-000000000301', v_emp, '00000000-0000-0000-0000-000000000202', null, 'PROP-2026-001', 'Projeto estrutural edifício residencial', 'São Paulo, SP', 3600, 140000, 92000, 34, 90, 'enviada', d + 20, v_usr),
    ('00000000-0000-0000-0000-000000000302', v_emp, null, '00000000-0000-0000-0000-000000000102', 'PROP-2026-002', 'Projeto completo Residencial Vale Verde', 'Campinas, SP', 3100, 210000, 138000, 34, 150, 'aceita', d - 15, v_usr),
    ('00000000-0000-0000-0000-000000000303', v_emp, '00000000-0000-0000-0000-000000000201', null, 'PROP-2026-003', 'Retrofit galpão logístico', 'Guarulhos, SP', 5000, 85000, 60000, 29, 60, 'rascunho', d + 30, v_usr);

  insert into public.proposta_disciplinas (id, empresa_id, proposta_id, disciplina, horas_estimadas, custo_hora, valor_venda) values
    ('00000000-0000-0000-0000-000000000311', v_emp, '00000000-0000-0000-0000-000000000301', 'Estrutural', 400, 180, 90000),
    ('00000000-0000-0000-0000-000000000312', v_emp, '00000000-0000-0000-0000-000000000301', 'Fundações', 200, 190, 50000),
    ('00000000-0000-0000-0000-000000000313', v_emp, '00000000-0000-0000-0000-000000000302', 'Estrutural', 500, 180, 120000),
    ('00000000-0000-0000-0000-000000000314', v_emp, '00000000-0000-0000-0000-000000000302', 'Instalações (MEP)', 380, 160, 90000);

  -- =====================================================================
  -- DESPESAS (mix; algumas no cartão, ligadas a fornecedor/categoria)
  -- =====================================================================
  insert into public.despesas (id, empresa_id, descricao, valor, status, data_vencimento, data_pagamento, categoria_id, fornecedor_id, conta_id, centro_custo_id, projeto_id, forma_pagamento, created_by) values
    ('00000000-0000-0000-0000-000000000801', v_emp, 'Pró-labore sócio', 18000, 'Pago', d - 5, d - 5, '00000000-0000-0000-0000-000000000623', null, '00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000631', null, 'Transferência', v_usr),
    ('00000000-0000-0000-0000-000000000802', v_emp, 'Salário engenheira estrutural', 9500, 'Pago', d - 5, d - 5, '00000000-0000-0000-0000-000000000623', null, '00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000632', '00000000-0000-0000-0000-000000000401', 'Transferência', v_usr),
    ('00000000-0000-0000-0000-000000000803', v_emp, 'Serviço de topografia', 6800, 'Pendente', d + 8, null, '00000000-0000-0000-0000-000000000625', '00000000-0000-0000-0000-000000000643', '00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000632', '00000000-0000-0000-0000-000000000401', 'Boleto', v_usr),
    ('00000000-0000-0000-0000-000000000804', v_emp, 'Aluguel do escritório', 5200, 'Atrasado', d - 3, null, '00000000-0000-0000-0000-000000000626', null, '00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000631', null, 'Boleto', v_usr);

  -- despesas no cartão (compõem a fatura)
  insert into public.despesas (id, empresa_id, descricao, valor, status, data_vencimento, data_pagamento, categoria_id, fornecedor_id, cartao_id, centro_custo_id, forma_pagamento, created_by) values
    ('00000000-0000-0000-0000-000000000805', v_emp, 'Assinatura AutoCAD + Revit', 3200, 'Pendente', d + 5, null, '00000000-0000-0000-0000-000000000624', '00000000-0000-0000-0000-000000000641', '00000000-0000-0000-0000-000000000611', '00000000-0000-0000-0000-000000000631', 'Cartão', v_usr),
    ('00000000-0000-0000-0000-000000000806', v_emp, 'Materiais de escritório', 780, 'Pendente', d + 5, null, '00000000-0000-0000-0000-000000000626', '00000000-0000-0000-0000-000000000642', '00000000-0000-0000-0000-000000000611', '00000000-0000-0000-0000-000000000631', 'Cartão', v_usr);

  insert into public.faturas (id, empresa_id, cartao_id, mes_referencia, ano_referencia, data_inicio, data_fim, data_vencimento, valor_total, valor_pago, status, conta_pagamento_id) values
    ('00000000-0000-0000-0000-000000000901', v_emp, '00000000-0000-0000-0000-000000000611', extract(month from d)::int, extract(year from d)::int, date_trunc('month', d)::date, (date_trunc('month', d) + interval '1 month' - interval '1 day')::date, d + 5, 3980, 0, 'Aberta', '00000000-0000-0000-0000-000000000601');

  -- =====================================================================
  -- OBRAS (administração + preço fechado) + frentes, orçamento, conta, RDO
  -- =====================================================================
  insert into public.obras (id, empresa_id, projeto_id, nome, status, responsavel_id, modelo_cobranca, taxa_administracao_pct, data_inicio_prevista, data_fim_prevista, data_inicio_real, cidade, localizacao, observacoes, created_by) values
    ('00000000-0000-0000-0000-000000000a01', v_emp, '00000000-0000-0000-0000-000000000401', 'Obra Edifício Horizonte', 'em_andamento', '00000000-0000-0000-0000-000000000505', 'administracao', 12, d - 30, d + 150, d - 25, 'São Paulo', 'Rua das Palmeiras, 500', 'Obra por administração, prestação de contas mensal.', v_usr),
    ('00000000-0000-0000-0000-000000000a02', v_emp, '00000000-0000-0000-0000-000000000403', 'Reforma Parque das Águas', 'concluida', '00000000-0000-0000-0000-000000000505', 'preco_fechado', 0, d - 200, d - 40, d - 195, 'Santo André', 'Av. Central, 1200', 'Reforma concluída dentro do prazo.', v_usr);

  insert into public.obra_frente (id, empresa_id, obra_id, nome, ordem) values
    ('00000000-0000-0000-0000-000000000a11', v_emp, '00000000-0000-0000-0000-000000000a01', 'Fundação', 1),
    ('00000000-0000-0000-0000-000000000a12', v_emp, '00000000-0000-0000-0000-000000000a01', 'Estrutura', 2),
    ('00000000-0000-0000-0000-000000000a13', v_emp, '00000000-0000-0000-0000-000000000a01', 'Acabamento', 3);

  insert into public.obra_orcamento_etapa (id, empresa_id, obra_id, obra_frente_id, valor_previsto) values
    ('00000000-0000-0000-0000-000000000a21', v_emp, '00000000-0000-0000-0000-000000000a01', '00000000-0000-0000-0000-000000000a11', 180000),
    ('00000000-0000-0000-0000-000000000a22', v_emp, '00000000-0000-0000-0000-000000000a01', '00000000-0000-0000-0000-000000000a12', 320000),
    ('00000000-0000-0000-0000-000000000a23', v_emp, '00000000-0000-0000-0000-000000000a01', '00000000-0000-0000-0000-000000000a13', 150000);

  -- conta da obra: aportes do cliente e despesas (prestação de contas)
  insert into public.obra_conta_lancamento (id, empresa_id, obra_id, obra_frente_id, tipo, data, descricao, valor, fornecedor_id, pago_por, created_by) values
    ('00000000-0000-0000-0000-000000000a31', v_emp, '00000000-0000-0000-0000-000000000a01', null, 'aporte', d - 24, 'Aporte inicial do cliente', 200000, null, 'cliente', v_usr),
    ('00000000-0000-0000-0000-000000000a32', v_emp, '00000000-0000-0000-0000-000000000a01', '00000000-0000-0000-0000-000000000a11', 'despesa', d - 20, 'Concreto e aço para fundação', 85000, '00000000-0000-0000-0000-000000000642', 'cliente', v_usr),
    ('00000000-0000-0000-0000-000000000a33', v_emp, '00000000-0000-0000-0000-000000000a01', '00000000-0000-0000-0000-000000000a12', 'despesa', d - 8, 'Fôrmas e escoramento', 32000, '00000000-0000-0000-0000-000000000642', 'cliente', v_usr),
    ('00000000-0000-0000-0000-000000000a34', v_emp, '00000000-0000-0000-0000-000000000a01', null, 'despesa', d - 6, 'Serviço de topografia (reembolsável)', 4200, '00000000-0000-0000-0000-000000000643', 'escritorio_reembolsavel', v_usr),
    ('00000000-0000-0000-0000-000000000a35', v_emp, '00000000-0000-0000-0000-000000000a01', null, 'aporte', d - 3, 'Segundo aporte do cliente', 100000, null, 'cliente', v_usr);

  insert into public.obra_rdo (id, empresa_id, obra_id, data, clima, condicao_trabalho, efetivo, atividades, ocorrencias, pendencias, autor_id, created_by) values
    ('00000000-0000-0000-0000-000000000a41', v_emp, '00000000-0000-0000-0000-000000000a01', d - 5, 'ensolarado', 'normal', 12, 'Concretagem da sapata S1 a S8.', 'Sem ocorrências.', 'Aguardando liberação de aço.', '00000000-0000-0000-0000-000000000505', v_usr),
    ('00000000-0000-0000-0000-000000000a42', v_emp, '00000000-0000-0000-0000-000000000a01', d - 3, 'nublado', 'parcial', 14, 'Montagem de fôrmas dos pilares P1 a P6.', 'Chuva leve à tarde, parada de 1h.', null, '00000000-0000-0000-0000-000000000505', v_usr),
    ('00000000-0000-0000-0000-000000000a43', v_emp, '00000000-0000-0000-0000-000000000a01', d - 1, 'ensolarado', 'normal', 14, 'Armação de pilares e início da concretagem.', 'Sem ocorrências.', 'Programar bomba de concreto.', '00000000-0000-0000-0000-000000000505', v_usr);

  -- =====================================================================
  -- TAREFAS (projeto e obra)
  -- =====================================================================
  insert into public.tarefas (id, empresa_id, titulo, descricao, status, prioridade, responsavel_id, projeto_id, obra_id, obra_frente_id, prazo, horas_estimadas, created_by) values
    ('00000000-0000-0000-0000-000000000451', v_emp, 'Revisar memorial de cálculo estrutural', 'Conferir dimensionamento das vigas do 3º pavimento.', 'fazendo', 'alta', '00000000-0000-0000-0000-000000000502', '00000000-0000-0000-0000-000000000401', null, null, d + 3, 8, v_usr),
    ('00000000-0000-0000-0000-000000000452', v_emp, 'Compatibilizar projeto MEP', 'Rodar clash detection com o estrutural.', 'a_fazer', 'media', '00000000-0000-0000-0000-000000000503', '00000000-0000-0000-0000-000000000401', null, null, d + 7, 12, v_usr),
    ('00000000-0000-0000-0000-000000000453', v_emp, 'Emitir RDO da semana', 'Consolidar diários de obra e enviar ao cliente.', 'a_fazer', 'media', '00000000-0000-0000-0000-000000000505', null, '00000000-0000-0000-0000-000000000a01', '00000000-0000-0000-0000-000000000a12', d + 1, 2, v_usr),
    ('00000000-0000-0000-0000-000000000454', v_emp, 'Fechar prestação de contas do mês', 'Bater aportes x despesas da obra Horizonte.', 'a_fazer', 'alta', '00000000-0000-0000-0000-000000000501', null, '00000000-0000-0000-0000-000000000a01', null, d + 5, 3, v_usr),
    ('00000000-0000-0000-0000-000000000455', v_emp, 'Enviar proposta ao RN Empreendimentos', 'Follow-up da proposta PROP-2026-001.', 'concluida', 'media', '00000000-0000-0000-0000-000000000501', null, null, null, d - 2, 1, v_usr);

  raise notice 'Dados demo inseridos com sucesso.';
end $$;
