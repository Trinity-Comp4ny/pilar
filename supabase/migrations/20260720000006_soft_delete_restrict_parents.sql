-- ACH-DEL-02: o soft delete de um projeto/cliente deixava os filhos (receitas,
-- despesas) vivos apontando para um pai oculto, e como a RLS só filtra o
-- deleted_at do próprio filho, esses valores continuavam entrando nos rollups
-- financeiros (dinheiro errado). Em vez de deixar o estado órfão nascer,
-- bloqueamos a exclusão na fonte quando há filhos financeiros vivos (RESTRICT
-- lógico) — as FKs ON DELETE eram letra morta porque o trigger converte todo
-- DELETE em soft delete. Ver ADR 0006.

CREATE OR REPLACE FUNCTION public.soft_delete_generic()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_filhos int;
BEGIN
  IF TG_TABLE_NAME = 'projetos' THEN
    SELECT count(*) INTO v_filhos FROM (
      SELECT 1 FROM receitas WHERE projeto_id = OLD.id AND deleted_at IS NULL
      UNION ALL
      SELECT 1 FROM despesas WHERE projeto_id = OLD.id AND deleted_at IS NULL
    ) s;
    IF v_filhos > 0 THEN
      RAISE EXCEPTION 'Não é possível excluir: há % lançamento(s) financeiro(s) vinculado(s) a este projeto. Exclua ou desvincule os lançamentos antes.', v_filhos
        USING ERRCODE = 'foreign_key_violation';
    END IF;
  ELSIF TG_TABLE_NAME = 'clientes' THEN
    SELECT count(*) INTO v_filhos FROM (
      SELECT 1 FROM projetos WHERE cliente_id = OLD.id AND deleted_at IS NULL
      UNION ALL
      SELECT 1 FROM receitas WHERE cliente_id = OLD.id AND deleted_at IS NULL
    ) s;
    IF v_filhos > 0 THEN
      RAISE EXCEPTION 'Não é possível excluir: há % projeto(s) ou lançamento(s) vinculado(s) a este cliente. Trate-os antes de excluir.', v_filhos
        USING ERRCODE = 'foreign_key_violation';
    END IF;
  END IF;

  EXECUTE format('UPDATE %I.%I SET deleted_at = NOW() WHERE id = $1', TG_TABLE_SCHEMA, TG_TABLE_NAME) USING OLD.id;
  RETURN NULL;
END;
$function$;
