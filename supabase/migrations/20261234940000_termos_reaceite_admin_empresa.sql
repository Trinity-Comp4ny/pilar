-- O fluxo de reaceite representa a empresa e exige administrador no próprio tenant.
-- Os aceites de cadastro e conclusão de perfil continuam com a regra de autoria.
ALTER POLICY "Terms Acceptances Insert Own" ON public.terms_acceptances
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND (
    source <> 'reaceite'
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.role = 'admin'
        AND p.empresa_id = terms_acceptances.empresa_id
    )
  )
);
