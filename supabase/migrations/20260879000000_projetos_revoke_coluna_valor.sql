-- SPEC 073 / ADR 0034: fase 10 (final). Fecha o leak confirmado ao vivo:
-- `select nome, valor_contrato from projetos` como usuário comum retornava
-- o valor real, porque a tabela base nunca teve o SELECT dessas duas
-- colunas revogado — só `projetos_safe` (view) mascarava, e nenhuma tela
-- era obrigada a usar a view.
--
-- Pré-condição desta migration: todo `select` no front que expunha
-- `valor_contrato`/`custo_indireto_pct` (ou `select("*")`/`select("*, ...)"`)
-- foi migrado para `projetos_safe` nesta mesma sessão (usePagamentosProjeto,
-- useClienteDetalhe, dashboard/queries, MapaTab, useProjetosData,
-- useProjetoDetail — os únicos 6 arquivos que de fato tocavam essas colunas,
-- confirmado por grep fechado no restante do repo). Escritas continuam na
-- tabela base — RLS (`projetos_write`) e o trigger `tg_projetos_protege_valor`
-- (20260873000000) seguem sendo a autoridade de quem pode mudar o quê;
-- este REVOKE é só sobre leitura.
--
-- Mesmo padrão de pessoas_safe (20260715000050): revoga SELECT da tabela
-- inteira e reconcede coluna a coluna, exceto as duas mascaradas.

REVOKE SELECT ON public.projetos FROM authenticated, anon;

GRANT SELECT (
  id, empresa_id, cliente_id, codigo_projeto, nome, localizacao, latitude,
  longitude, status, status_data, data_inicio, data_previsao, data_final,
  observacao, parcelas, area_m2, prioridade, etapa_id, disciplinas,
  comentarios, links, deleted_at, created_at, created_by, updated_at,
  updated_by
) ON public.projetos TO authenticated, anon;
-- valor_contrato e custo_indireto_pct de propósito FORA da lista: só
-- legíveis via projetos_safe, condicionadas a can_view_financeiro().
