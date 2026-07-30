-- Obras: vínculo com projeto vira OPCIONAL + obra ganha localização própria.
-- (spec 015 revisada 2026-07-30; ajusta o ADR 0011)
--
-- Decisão do CEO: a obra não precisa de projeto (não há dado a compartilhar por
-- padrão). O vínculo fica opcional; no front o campo só aparece se a empresa tem
-- o módulo Projetos. A obra passa a ter localização própria (CEP → lat/long) para
-- alimentar a tela de Clima.

-- 1. projeto_id opcional
ALTER TABLE public.obras ALTER COLUMN projeto_id DROP NOT NULL;

-- Com vínculo opcional, "1 obra por projeto" deixa de fazer sentido.
DROP INDEX IF EXISTS public.obras_projeto_ativa_uniq;

-- 2. Localização própria da obra
ALTER TABLE public.obras
  ADD COLUMN IF NOT EXISTS cep         text,
  ADD COLUMN IF NOT EXISTS localizacao text,
  ADD COLUMN IF NOT EXISTS cidade      text,
  ADD COLUMN IF NOT EXISTS latitude    double precision,
  ADD COLUMN IF NOT EXISTS longitude   double precision;

-- 3. RLS: as policies de insert/update validavam projeto_id com EXISTS, o que
--    rejeitava projeto nulo. Passa a aceitar nulo (padrão de tarefas).
DROP POLICY IF EXISTS obras_insert ON public.obras;
CREATE POLICY obras_insert ON public.obras
  FOR INSERT WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND (
      projeto_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.projetos pr
        WHERE pr.id = projeto_id AND pr.empresa_id = public.get_user_empresa_id()
      )
    )
    AND (
      responsavel_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.pessoas p
        WHERE p.id = responsavel_id AND p.empresa_id = public.get_user_empresa_id()
      )
    )
  );

DROP POLICY IF EXISTS obras_update ON public.obras;
CREATE POLICY obras_update ON public.obras
  FOR UPDATE USING (empresa_id = public.get_user_empresa_id())
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND (
      projeto_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.projetos pr
        WHERE pr.id = projeto_id AND pr.empresa_id = public.get_user_empresa_id()
      )
    )
    AND (
      responsavel_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.pessoas p
        WHERE p.id = responsavel_id AND p.empresa_id = public.get_user_empresa_id()
      )
    )
  );
