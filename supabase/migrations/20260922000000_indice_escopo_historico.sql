-- Spec 093 (PR 2): escopo_historico hoje só tem PK. O braço de escopo da view
-- v_projeto_timeline (próxima migration) filtra por escopo_id via join até escopos;
-- sem este índice, esse braço do UNION cai em seq scan a cada consulta da aba Histórico.

CREATE INDEX IF NOT EXISTS idx_escopo_historico_escopo
  ON public.escopo_historico (escopo_id);
