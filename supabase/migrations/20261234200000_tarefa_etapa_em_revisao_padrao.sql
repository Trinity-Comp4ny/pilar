-- Quadro de Tarefas: "Em revisão" passa a ser coluna padrão, entre "Em andamento"
-- e "Concluído". É coluna extra (bucket nulo): vale só para tarefa, e a empresa
-- pode renomear, mover ou excluir como qualquer coluna personalizada.

-- 1) Empresa nova já nasce com as 4 colunas.
CREATE OR REPLACE FUNCTION public.seed_tarefa_etapas_padrao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.tarefa_etapas WHERE empresa_id = NEW.id) THEN
    INSERT INTO public.tarefa_etapas (empresa_id, nome, ordem, cor, bucket)
    VALUES
      (NEW.id, 'A fazer',      0, '#94a3b8', 'a_fazer'),
      (NEW.id, 'Em andamento', 1, '#f59e0b', 'fazendo'),
      (NEW.id, 'Em revisão',   2, '#8b5cf6', NULL),
      (NEW.id, 'Concluído',    3, '#10b981', 'concluida');
  END IF;
  RETURN NEW;
END;
$$;

-- 2) Backfill: empresas com a âncora "Em andamento" e sem coluna "Em revisão"
-- ganham a coluna logo depois dela; as colunas seguintes descem uma posição.
-- O backfill e uma operacao do sistema. A conexao de db push nao tem JWT
-- e o trigger de somente leitura exige uma role explicita para esse caso.
DO $$
DECLARE
  role_anterior text := current_setting('request.jwt.claim.role', true);
BEGIN
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);

  WITH alvo AS (
    SELECT f.empresa_id, f.ordem AS ordem_fazendo
    FROM public.tarefa_etapas f
    WHERE f.bucket = 'fazendo'
      AND NOT EXISTS (
        SELECT 1 FROM public.tarefa_etapas r
        WHERE r.empresa_id = f.empresa_id AND lower(r.nome) = 'em revisão'
      )
  ),
  deslocadas AS (
    UPDATE public.tarefa_etapas t
    SET ordem = t.ordem + 1
    FROM alvo a
    WHERE t.empresa_id = a.empresa_id AND t.ordem > a.ordem_fazendo
    RETURNING t.id
  )
  INSERT INTO public.tarefa_etapas (empresa_id, nome, ordem, cor, bucket)
  SELECT empresa_id, 'Em revisão', ordem_fazendo + 1, '#8b5cf6', NULL FROM alvo;

  PERFORM set_config('request.jwt.claim.role', COALESCE(role_anterior, ''), true);
END;
$$;
