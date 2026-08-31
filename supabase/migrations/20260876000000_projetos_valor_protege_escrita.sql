-- SPEC 073 / ADR 0034: fase 7, achado no teste ponta a ponta continuado.
--
-- Mesma classe do achado anterior (pessoas), mais grave: a policy
-- "projetos_write" (20260507300000) exige só user_has_feature('projetos',
-- 'editor') — qualquer membro da empresa desde o ADR 0029. O gate cirúrgico
-- que a migration 20260871000000 pôs em update_projeto_completo (só bloqueia
-- quando valor_contrato muda de verdade) é decorativo se a tabela base
-- aceita UPDATE direto sem passar pela RPC. Confirmado ao vivo: um `user`
-- comum, via UPDATE direto (não a RPC), reescreveu valor_contrato de
-- 200000 para 1 sem checagem nenhuma de financeiro.
--
-- Fix: mesmo padrão de trigger de tg_pessoas_protege_sensiveis
-- (20260872000000). Bloqueia só quando valor_contrato ou custo_indireto_pct
-- mudam (ou vêm preenchidos num INSERT) sem can_view_financeiro(). Resto de
-- projetos_write (nome, status, datas, disciplinas) segue igual — não é
-- sobre travar edição de projeto, é sobre fechar a mesma porta que a RPC já
-- fecha, agora também na tabela.

CREATE OR REPLACE FUNCTION public.tg_projetos_protege_valor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (
    NEW.valor_contrato IS DISTINCT FROM OLD.valor_contrato
    OR NEW.custo_indireto_pct IS DISTINCT FROM OLD.custo_indireto_pct
  ) AND NOT public.can_view_financeiro() THEN
    RAISE EXCEPTION 'Sem permissão para alterar valor de contrato ou margem'
      USING ERRCODE = '42501';
  END IF;

  -- custo_indireto_pct tem DEFAULT 15.0 (000_base_schema.sql): comparar com
  -- IS NOT NULL bloquearia todo INSERT sem can_view_financeiro(), inclusive
  -- criação normal de projeto sem tocar em margem nenhuma. O que importa é
  -- se veio DIFERENTE do default.
  IF TG_OP = 'INSERT' AND (
    (NEW.valor_contrato IS NOT NULL AND NEW.valor_contrato <> 0)
    OR NEW.custo_indireto_pct IS DISTINCT FROM 15.0
  ) AND NOT public.can_view_financeiro() THEN
    RAISE EXCEPTION 'Sem permissão para definir valor de contrato ou margem'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_projetos_protege_valor ON public.projetos;
CREATE TRIGGER trg_projetos_protege_valor
  BEFORE INSERT OR UPDATE ON public.projetos
  FOR EACH ROW EXECUTE FUNCTION public.tg_projetos_protege_valor();
