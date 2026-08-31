-- SPEC 073 / ADR 0034: fase 6, achado no teste ponta a ponta (não na
-- auditoria automatizada nem na revisão manual anterior).
--
-- pessoas_safe (20260715000050) fechou o vazamento de LEITURA de
-- salario_fixo/valor_m2/cpf/chaves_pix/contas_bancarias: revogou SELECT
-- dessas colunas na tabela base e criou a view que só devolve o valor real
-- com can_view_folha(). Nunca fechou o lado da ESCRITA: a policy
-- "pessoas_write" (20260507300000) segue exigindo só
-- user_has_feature('pessoas', 'editor') — desde o ADR 0029, qualquer membro
-- da empresa. Confirmado ao vivo: um usuário que vê salário mascarado via
-- pessoas_safe ainda consegue UPDATE pessoas SET salario_fixo = <qualquer
-- valor> direto na tabela base. Pior que vazamento de leitura: é escrita às
-- cegas em salário/CPF/PIX/conta bancária de qualquer pessoa da empresa.
--
-- Fix cirúrgico, mesmo padrão de tg_prevent_profile_tampering: um trigger
-- BEFORE INSERT/UPDATE bloqueia só quando uma das 5 colunas sensíveis muda
-- (ou vem preenchida num INSERT) sem can_view_folha(). O resto de
-- pessoas_write (nome, cargo, telefone, endereço) continua editável por
-- quem já edita hoje — não é sobre travar o cadastro de equipe, é sobre
-- proteger só o que já era pra estar protegido.

CREATE OR REPLACE FUNCTION public.tg_pessoas_protege_sensiveis()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (
    NEW.salario_fixo IS DISTINCT FROM OLD.salario_fixo
    OR NEW.valor_m2 IS DISTINCT FROM OLD.valor_m2
    OR NEW.cpf IS DISTINCT FROM OLD.cpf
    OR NEW.chaves_pix IS DISTINCT FROM OLD.chaves_pix
    OR NEW.contas_bancarias IS DISTINCT FROM OLD.contas_bancarias
  ) AND NOT public.can_view_folha() THEN
    RAISE EXCEPTION 'Sem permissão para alterar dados sensíveis da pessoa'
      USING ERRCODE = '42501';
  END IF;

  -- chaves_pix/contas_bancarias têm DEFAULT '[]'::jsonb (000_base_schema.sql):
  -- IS NOT NULL bloquearia todo INSERT de pessoa sem can_view_folha(), inclusive
  -- cadastro normal de equipe sem tocar em PIX/conta nenhuma. Comparar com o
  -- default em vez de NULL.
  IF TG_OP = 'INSERT' AND (
    NEW.salario_fixo IS NOT NULL
    OR NEW.valor_m2 IS NOT NULL
    OR NEW.cpf IS NOT NULL
    OR NEW.chaves_pix IS DISTINCT FROM '[]'::jsonb
    OR NEW.contas_bancarias IS DISTINCT FROM '[]'::jsonb
  ) AND NOT public.can_view_folha() THEN
    RAISE EXCEPTION 'Sem permissão para definir dados sensíveis da pessoa'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pessoas_protege_sensiveis ON public.pessoas;
CREATE TRIGGER trg_pessoas_protege_sensiveis
  BEFORE INSERT OR UPDATE ON public.pessoas
  FOR EACH ROW EXECUTE FUNCTION public.tg_pessoas_protege_sensiveis();
