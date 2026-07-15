-- =====================================================================
-- Perfis de acesso do ICP: adiciona owner / coordenador / colaborador
-- ao enum user_role (aditivo, não-destrutivo).
--
-- Contexto: o ICP (engenharia multidisciplinar) exige 3 perfis prontos
-- que escondam financeiro/folha da equipe. Ver docs/strategy/TODO_CONFIG_ADMIN.
--
--   owner       → sócio: vê tudo (dinheiro, margem, folha), empresa toda
--   coordenador → projetos dele, horas, prazo; SEM financeiro nem folha
--   colaborador → só a tarefa dele, lança hora; SEM nenhum dado de dinheiro
--
-- Contrato compartilhado — nomes EXATOS (usados também no app_metadata.role
-- do JWT). NÃO renomeia os enums legados (user/admin/ultra_admin): eles
-- continuam válidos e a semântica atual fica intacta.
--
-- ATENÇÃO: ADD VALUE precisa ser committado antes de ser usado em queries.
-- Por isso esta migration SÓ adiciona os valores; helpers e presets que os
-- consomem ficam na migration seguinte (20260715000001).
-- =====================================================================

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'owner';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'coordenador';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'colaborador';
