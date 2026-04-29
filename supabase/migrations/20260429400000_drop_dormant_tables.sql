-- Remove tabelas de módulos dormentes: IA Hub, Capacidade, WIP, Timesheet, Saúde Operacional
-- Módulos mantidos (ativos ou planejados): metas, fluxos_disciplinas, templates_projeto

DROP TABLE IF EXISTS ai_insights CASCADE;
DROP TABLE IF EXISTS ai_usage CASCADE;
DROP TABLE IF EXISTS alocacoes CASCADE;
DROP TABLE IF EXISTS timesheets CASCADE;
DROP TABLE IF EXISTS wip_snapshots CASCADE;
DROP TABLE IF EXISTS saude_operacional_snapshots CASCADE;
