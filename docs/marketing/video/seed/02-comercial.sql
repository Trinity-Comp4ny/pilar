do $$
declare
  e uuid := 'a1000000-0000-0000-0000-000000000001';
  u uuid := 'a1000000-0000-0000-0000-000000000010';
  d date := current_date;
begin
  if exists (select 1 from public.clientes where id = 'a1000000-0000-0000-0000-000000000101') then return; end if;

  insert into public.pessoas (id, empresa_id, primeiro_nome, sobrenome, nome, email, cargo, tipo_contrato, status, salario_fixo, valor_m2, horas_semanais, data_admissao, profile_id, created_by) values
    ('a1000000-0000-0000-0000-000000000501', e, 'Marina', 'Prado', 'Marina Prado', 'video@local.test', 'Sócia-diretora', 'socio', 'ativo', 22000, 0, 44, d - 900, u, u),
    ('a1000000-0000-0000-0000-000000000502', e, 'Lucas', 'Ferreira', 'Lucas Ferreira', 'lucas@atrium.dev', 'Engenheiro estrutural', 'clt', 'ativo', 11500, 0, 44, d - 600, null, u),
    ('a1000000-0000-0000-0000-000000000503', e, 'Camila', 'Duarte', 'Camila Duarte', 'camila@atrium.dev', 'Engenheira MEP', 'pj', 'ativo', 12000, 0, 40, d - 420, null, u),
    ('a1000000-0000-0000-0000-000000000504', e, 'Pedro', 'Saraiva', 'Pedro Saraiva', 'pedro@atrium.dev', 'Arquiteto', 'clt', 'ativo', 10500, 0, 44, d - 380, null, u),
    ('a1000000-0000-0000-0000-000000000505', e, 'Jorge', 'Matos', 'Jorge Matos', 'jorge@atrium.dev', 'Mestre de obras', 'clt', 'ativo', 8500, 0, 44, d - 300, null, u),
    ('a1000000-0000-0000-0000-000000000506', e, 'Ana', 'Ribeiro', 'Ana Ribeiro', 'ana@atrium.dev', 'Estagiária de engenharia', 'estagiario', 'ativo', 2200, 0, 30, d - 90, null, u);

  insert into public.clientes (id, empresa_id, nome, sobrenome, tipo_pessoa, email, contato, origem, created_by) values
    ('a1000000-0000-0000-0000-000000000101', e, 'Incorporadora Alameda', null, 'PJ', 'projetos@alameda.exemplo', '(19) 3200-1000', 'Indicação', u),
    ('a1000000-0000-0000-0000-000000000102', e, 'Clínica Vitta', null, 'PJ', 'obras@vitta.exemplo', '(19) 3300-2000', 'Site', u),
    ('a1000000-0000-0000-0000-000000000103', e, 'Colégio Monte Azul', null, 'PJ', 'adm@monteazul.exemplo', '(19) 3400-3000', 'Indicação', u),
    ('a1000000-0000-0000-0000-000000000104', e, 'Ricardo', 'Toledo', 'PF', 'ricardo.toledo@exemplo.com', '(19) 99800-4000', 'Instagram', u),
    ('a1000000-0000-0000-0000-000000000105', e, 'Galpões Anhanguera', null, 'PJ', 'eng@anhanguera.exemplo', '(19) 3500-5000', 'Evento', u),
    ('a1000000-0000-0000-0000-000000000106', e, 'Hotel Serra Verde', null, 'PJ', 'manutencao@serraverde.exemplo', '(19) 3600-6000', 'Site', u),
    ('a1000000-0000-0000-0000-000000000107', e, 'Grupo Solaris', null, 'PJ', 'facilities@solaris.exemplo', '(19) 3700-7000', 'Indicação', u);

  insert into public.leads (id, empresa_id, nome, sobrenome, empresa_lead, email, contato, status, origem, valor_estimado, previsao_fechamento, notas, created_by) values
    ('a1000000-0000-0000-0000-000000000201', e, 'Helena', 'Castro', 'Castro Empreendimentos', 'helena@castro.exemplo', '(19) 98100-1111', 'Novo', 'Instagram', 120000, d + 40, 'Edifício residencial de 8 pavimentos.', u),
    ('a1000000-0000-0000-0000-000000000202', e, 'Otávio', 'Lins', 'Rede Bem Estar', 'otavio@bemestar.exemplo', '(19) 98200-2222', 'Novo', 'Site', 64000, d + 35, 'Reforma de 3 lojas.', u),
    ('a1000000-0000-0000-0000-000000000203', e, 'Sérgio', 'Almeida', 'Logística Viracopos', 'sergio@viracopos.exemplo', '(19) 98300-3333', 'Em contato', 'Indicação', 260000, d + 30, 'Galpão de 12 mil m².', u),
    ('a1000000-0000-0000-0000-000000000204', e, 'Juliana', 'Reis', 'Residencial Reis', 'juliana@reis.exemplo', '(19) 98400-4444', 'Proposta', 'Instagram', 88000, d + 15, 'Casa de alto padrão em condomínio.', u),
    ('a1000000-0000-0000-0000-000000000205', e, 'Márcio', 'Pacheco', 'Pacheco Saúde', 'marcio@pacheco.exemplo', '(19) 98500-5555', 'Negociação', 'Indicação', 175000, d + 10, 'Clínica com centro cirúrgico.', u),
    ('a1000000-0000-0000-0000-000000000206', e, 'Renata', 'Moura', 'Colégio Horizonte', 'renata@horizonte.exemplo', '(19) 98600-6666', 'Negociação', 'Evento', 132000, d + 12, 'Ampliação de 6 salas.', u);

  insert into public.propostas (id, empresa_id, lead_id, cliente_id, codigo, titulo, localizacao, area_m2, valor_proposto, custo_estimado, margem_estimada_pct, prazo_estimado_dias, status, validade, created_by) values
    ('a1000000-0000-0000-0000-000000000301', e, 'a1000000-0000-0000-0000-000000000204', null, 'PROP-2026-041', 'Residência Reis: arquitetura e estrutural', 'Valinhos, SP', 420, 88000, 57000, 35, 75, 'enviada', d + 15, u),
    ('a1000000-0000-0000-0000-000000000302', e, 'a1000000-0000-0000-0000-000000000205', null, 'PROP-2026-042', 'Clínica Pacheco: estrutural e MEP', 'Campinas, SP', 1800, 175000, 112000, 36, 120, 'enviada', d + 20, u),
    ('a1000000-0000-0000-0000-000000000303', e, 'a1000000-0000-0000-0000-000000000206', null, 'PROP-2026-043', 'Ampliação Colégio Horizonte', 'Sumaré, SP', 950, 132000, 86000, 35, 90, 'rascunho', d + 30, u),
    ('a1000000-0000-0000-0000-000000000304', e, null, 'a1000000-0000-0000-0000-000000000105', 'PROP-2026-038', 'Galpão Anhanguera: estrutural', 'Jundiaí, SP', 6200, 210000, 138000, 34, 150, 'aceita', d - 10, u),
    ('a1000000-0000-0000-0000-000000000305', e, null, 'a1000000-0000-0000-0000-000000000104', 'PROP-2026-031', 'Residência Toledo: projeto e acompanhamento de obra', 'Campinas, SP', 380, 96000, 61000, 36, 240, 'aceita', d - 95, u);

  insert into public.proposta_disciplinas (id, empresa_id, proposta_id, disciplina, horas_estimadas, custo_hora, valor_venda) values
    ('a1000000-0000-0000-0000-000000000311', e, 'a1000000-0000-0000-0000-000000000302', 'Estrutural', 360, 180, 95000),
    ('a1000000-0000-0000-0000-000000000312', e, 'a1000000-0000-0000-0000-000000000302', 'Instalações (MEP)', 300, 160, 80000),
    ('a1000000-0000-0000-0000-000000000313', e, 'a1000000-0000-0000-0000-000000000301', 'Arquitetura', 220, 150, 52000),
    ('a1000000-0000-0000-0000-000000000314', e, 'a1000000-0000-0000-0000-000000000301', 'Estrutural', 150, 180, 36000);
end $$;
