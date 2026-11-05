do $$
declare
  e uuid := 'a1000000-0000-0000-0000-000000000001';
  u uuid := 'a1000000-0000-0000-0000-000000000010';
  d date := current_date;
  o1 uuid := 'a1000000-0000-0000-0000-000000000a01';
  o2 uuid := 'a1000000-0000-0000-0000-000000000a02';
  jorge uuid := 'a1000000-0000-0000-0000-000000000505';
  f_fund uuid := 'a1000000-0000-0000-0000-000000000a11';
  f_estr uuid := 'a1000000-0000-0000-0000-000000000a12';
  f_alv  uuid := 'a1000000-0000-0000-0000-000000000a13';
  f_cob  uuid := 'a1000000-0000-0000-0000-000000000a14';
  f_inst uuid := 'a1000000-0000-0000-0000-000000000a15';
  f_acab uuid := 'a1000000-0000-0000-0000-000000000a16';
  forn uuid := 'a1000000-0000-0000-0000-000000000641';
begin
  if exists (select 1 from public.obras where id = o1) then return; end if;

  insert into public.fornecedores (id, empresa_id, nome, contato, email, telefone) values
    (forn, e, 'Concreteira Campinas', 'comercial', 'vendas@concreteira.exemplo', '(19) 3000-1000');

  insert into public.obras (id, empresa_id, projeto_id, cliente_id, nome, status, responsavel_id, modelo_cobranca, taxa_administracao_pct, data_inicio_prevista, data_fim_prevista, data_inicio_real, cidade, localizacao, latitude, longitude, visivel_portal, observacoes, created_by) values
    (o1, e, 'a1000000-0000-0000-0000-000000000404', 'a1000000-0000-0000-0000-000000000104', 'Obra Residência Toledo', 'em_andamento', jorge, 'administracao', 12, d - 60, d + 150, d - 58, 'Campinas', 'Rua das Paineiras, 210', -22.8305, -47.0418, true, 'Sobrado de 380 m², obra por administração.', u),
    (o2, e, 'a1000000-0000-0000-0000-000000000406', 'a1000000-0000-0000-0000-000000000106', 'Retrofit Hotel Serra Verde', 'em_andamento', jorge, 'preco_fechado', 0, d - 90, d + 30, d - 88, 'Atibaia', 'Estrada da Serra, 1500', -23.1171, -46.5563, false, 'Troca de instalações com o hotel em operação.', u);

  insert into public.obra_frente (id, empresa_id, obra_id, nome, ordem, data_inicio, data_fim) values
    (f_fund, e, o1, 'Fundação', 1, d - 58, d - 35),
    (f_estr, e, o1, 'Estrutura', 2, d - 34, d + 12),
    (f_alv,  e, o1, 'Alvenaria', 3, d - 10, d + 40),
    (f_cob,  e, o1, 'Cobertura', 4, d + 13, d + 45),
    (f_inst, e, o1, 'Instalações', 5, d + 20, d + 90),
    (f_acab, e, o1, 'Acabamento', 6, d + 80, d + 150);

  insert into public.obra_orcamento_etapa (empresa_id, obra_id, obra_frente_id, valor_previsto) values
    (e, o1, f_fund, 142000), (e, o1, f_estr, 238000), (e, o1, f_alv, 96000),
    (e, o1, f_cob, 74000), (e, o1, f_inst, 118000), (e, o1, f_acab, 212000);

  insert into public.tarefas (id, empresa_id, titulo, status, prioridade, responsavel_id, obra_id, obra_frente_id, data_inicio, prazo, sensivel_clima, created_by) values
    ('a1000000-0000-0000-0000-000000000c01', e, 'Escavação e locação', 'concluida', 'media', jorge, o1, f_fund, d - 58, d - 50, null, u),
    ('a1000000-0000-0000-0000-000000000c02', e, 'Concretagem das sapatas', 'concluida', 'alta', jorge, o1, f_fund, d - 49, d - 40, 'concretagem', u),
    ('a1000000-0000-0000-0000-000000000c03', e, 'Vigas baldrame', 'concluida', 'media', jorge, o1, f_fund, d - 40, d - 35, null, u),
    ('a1000000-0000-0000-0000-000000000c04', e, 'Pilares do térreo', 'concluida', 'alta', jorge, o1, f_estr, d - 34, d - 22, null, u),
    ('a1000000-0000-0000-0000-000000000c05', e, 'Laje do térreo', 'concluida', 'alta', jorge, o1, f_estr, d - 21, d - 12, 'concretagem', u),
    ('a1000000-0000-0000-0000-000000000c06', e, 'Pilares do pavimento superior', 'fazendo', 'alta', jorge, o1, f_estr, d - 11, d + 1, null, u),
    ('a1000000-0000-0000-0000-000000000c07', e, 'Concretagem da laje do pavimento superior', 'a_fazer', 'alta', jorge, o1, f_estr, d + 2, d + 2, 'concretagem', u),
    ('a1000000-0000-0000-0000-000000000c08', e, 'Impermeabilização da laje técnica', 'a_fazer', 'media', jorge, o1, f_estr, d + 7, d + 8, 'impermeabilizacao', u),
    ('a1000000-0000-0000-0000-000000000c09', e, 'Alvenaria do térreo', 'fazendo', 'media', jorge, o1, f_alv, d - 10, d + 15, null, u),
    ('a1000000-0000-0000-0000-000000000c10', e, 'Alvenaria do pavimento superior', 'a_fazer', 'media', jorge, o1, f_alv, d + 14, d + 40, null, u),
    ('a1000000-0000-0000-0000-000000000c11', e, 'Içamento das tesouras metálicas', 'a_fazer', 'alta', jorge, o1, f_cob, d + 13, d + 15, 'icamento', u),
    ('a1000000-0000-0000-0000-000000000c12', e, 'Telhamento', 'a_fazer', 'media', jorge, o1, f_cob, d + 16, d + 45, 'telhado', u),
    ('a1000000-0000-0000-0000-000000000c13', e, 'Tubulação elétrica e hidráulica', 'a_fazer', 'media', jorge, o1, f_inst, d + 20, d + 90, null, u),
    ('a1000000-0000-0000-0000-000000000c14', e, 'Pintura externa', 'a_fazer', 'baixa', jorge, o1, f_acab, d + 120, d + 140, 'pintura_externa', u);

  insert into public.obra_rdo (id, empresa_id, obra_id, data, clima, condicao_trabalho, efetivo, atividades, ocorrencias, pendencias, autor_id, created_by) values
    ('a1000000-0000-0000-0000-000000000a41', e, o1, d - 3, 'ensolarado', 'normal', 9, 'Armação dos pilares P7 a P12 do pavimento superior.', 'Sem ocorrências.', 'Confirmar caminhão-bomba para sábado.', jorge, u),
    ('a1000000-0000-0000-0000-000000000a42', e, o1, d - 2, 'nublado', 'normal', 10, 'Fôrmas dos pilares e primeira fiada da alvenaria do térreo.', 'Chegada de 6 mil blocos.', null, jorge, u),
    ('a1000000-0000-0000-0000-000000000a43', e, o1, d - 1, 'chuvoso', 'parcial', 8, 'Concretagem dos pilares P7 a P12. Alvenaria parada à tarde.', 'Chuva forte às 15h, equipe recolhida por 2 horas.', 'Proteger a armadura da laje com lona.', jorge, u);

  insert into public.obra_rdo_tarefa (empresa_id, rdo_id, tarefa_id, resultado, observacao, created_by) values
    (e, 'a1000000-0000-0000-0000-000000000a41', 'a1000000-0000-0000-0000-000000000c06', 'avancou', 'Armação P7 a P12', u),
    (e, 'a1000000-0000-0000-0000-000000000a42', 'a1000000-0000-0000-0000-000000000c09', 'avancou', 'Primeira fiada', u),
    (e, 'a1000000-0000-0000-0000-000000000a43', 'a1000000-0000-0000-0000-000000000c06', 'avancou', 'Pilares concretados', u),
    (e, 'a1000000-0000-0000-0000-000000000a43', 'a1000000-0000-0000-0000-000000000c09', 'parou', 'Chuva às 15h', u);

  insert into public.obra_registro (client_id, empresa_id, obra_id, rdo_id, autor_user_id, autor_nome, data_registro, tipo, texto_bruto, texto_organizado, extraido, status, visivel_cliente) values
    (gen_random_uuid(), e, o1, 'a1000000-0000-0000-0000-000000000a43', u, 'Jorge Matos', d - 1, 'texto',
     'concretamos os pilares do sete ao doze de manha, deu tudo certo, a tarde choveu forte umas tres horas e paramos a alvenaria, oito pessoas hoje, precisa lona pra cobrir a armacao da laje',
     'Concretagem dos pilares P7 a P12 concluída pela manhã. Chuva forte por volta das 15h: alvenaria do térreo parada por cerca de 2 horas. Efetivo: 8 pessoas. Pendência: cobrir a armadura da laje com lona.',
     '{}'::jsonb, 'pronto', true),
    (gen_random_uuid(), e, o1, null, u, 'Jorge Matos', d, 'texto',
     'hoje fechamos as formas da laje de cima, escoramento conferido, faltou chegar o aco da escada, dez pessoas',
     'Fôrmas da laje do pavimento superior fechadas e escoramento conferido. Aço da escada não chegou. Efetivo: 10 pessoas.',
     '{}'::jsonb, 'pronto', false);

  insert into public.obra_conta_lancamento (empresa_id, obra_id, obra_frente_id, tipo, data, descricao, valor, fornecedor_id, pago_por, created_by) values
    (e, o1, null, 'aporte', d - 58, 'Aporte inicial do cliente', 250000, null, 'cliente', u),
    (e, o1, f_fund, 'despesa', d - 45, 'Concreto e aço da fundação', 118400, forn, 'cliente', u),
    (e, o1, f_estr, 'despesa', d - 20, 'Concreto da laje do térreo', 64200, forn, 'cliente', u),
    (e, o1, null, 'aporte', d - 15, 'Segundo aporte do cliente', 150000, null, 'cliente', u),
    (e, o1, f_estr, 'despesa', d - 2, 'Fôrmas e escoramento', 38900, forn, 'cliente', u);
end $$;

insert into public.resumos_semanais (empresa_id, escopo, user_id, semana_inicio, conteudo, fatos, modelo)
select 'a1000000-0000-0000-0000-000000000001', 'empresa', null,
  date_trunc('week', (now() at time zone 'America/Sao_Paulo')::date)::date,
  jsonb_build_object('manchete', 'Semana de caixa positivo, mas o Retrofit Serra Verde passou do orçamento de horas',
    'destaques', jsonb_build_array(
      jsonb_build_object('tom', 'positivo', 'texto', 'R$ 108 mil recebidos em 3 parcelas, todas no prazo.'),
      jsonb_build_object('tom', 'atencao', 'texto', 'MEP do Retrofit Hotel Serra Verde está 17% acima das horas previstas; o aditivo está pronto para revisão.'),
      jsonb_build_object('tom', 'atencao', 'texto', 'Parcela 3 do Colégio Monte Azul (R$ 35,5 mil) venceu há 4 dias.'),
      jsonb_build_object('tom', 'neutro', 'texto', 'Duas propostas em negociação somam R$ 307 mil.'))),
  '{}'::jsonb, 'seed'
where not exists (select 1 from public.resumos_semanais where empresa_id = 'a1000000-0000-0000-0000-000000000001');

select public.agente_pendencias_varrer('a1000000-0000-0000-0000-000000000001');
select area, severidade, titulo from public.agente_pendencias where empresa_id = 'a1000000-0000-0000-0000-000000000001' and status = 'aberta';
