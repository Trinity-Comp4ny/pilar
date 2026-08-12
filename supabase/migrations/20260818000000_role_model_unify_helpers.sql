-- Frente 1 (spec 031): modelo de role unificado.
--
-- A conta (user/admin/ultra_admin) volta a ser a única autoridade.
-- owner/coordenador/colaborador deixam de decidir acesso no front; aqui
-- reconciliamos os dois predicados de mascaramento para que a RLS decida quem
-- vê dinheiro pela FEATURE (como o resto do financeiro já faz via
-- user_has_feature), não pelo role de contrato.
--
-- Gate 0 (12/08): SELECT role,count(*) FROM profiles em staging e prod não
-- retornou nenhum owner/coordenador/colaborador. O backfill abaixo é rede de
-- segurança, não migração de dados.

-- 1. can_view_financeiro: admin/ultra_admin OU feature 'financeiro' (viewer+).
--    Bypass explícito de admin porque admin cai na regra granular dentro de
--    user_has_feature e normalmente tem profiles.features vazio.
CREATE OR REPLACE FUNCTION public.can_view_financeiro()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT role IN ('admin', 'ultra_admin') FROM public.profiles WHERE id = auth.uid()),
    FALSE
  ) OR public.user_has_feature('financeiro', 'viewer');
$$;

-- 2. can_view_folha: salário/CPF/PIX são o dado mais sensível do financeiro.
--    Exige admin/ultra_admin OU 'financeiro' em nível EDITOR (não só viewer),
--    para NÃO ampliar quem enxerga folha ao trocar o gate de role para feature.
--    Usado no mascaramento da view pessoas_safe.
CREATE OR REPLACE FUNCTION public.can_view_folha()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT role IN ('admin', 'ultra_admin') FROM public.profiles WHERE id = auth.uid()),
    FALSE
  ) OR public.user_has_feature('financeiro', 'editor');
$$;

-- 3. Backfill de segurança: roles de contrato residuais caem no modelo de conta
--    sem perder acesso (owner tinha visão total → admin; coord/colab → user,
--    mantendo profiles.features que já tivessem).
UPDATE public.profiles SET role = 'admin' WHERE role = 'owner';
UPDATE public.profiles SET role = 'user'  WHERE role IN ('coordenador', 'colaborador');

-- Nota: o branch 'owner' de user_has_feature() (migration 20260715000001) vira
-- código morto após o backfill. Deixado no lugar de propósito — mexer numa
-- função usada por ~120 policies exige auditoria própria, fora desta frente.
