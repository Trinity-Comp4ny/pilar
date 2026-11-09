-- Papel `owner` aposentado (DECISOES.md, 2026-11-07).
--
-- O modelo de acesso tem só administrador, coordenador e usuário (ADR 0029).
-- `owner` ficou no enum `user_role` desde 20260715000000, mas desde
-- 20260818000000 nenhum perfil usa: o backfill owner → admin rodou em staging e
-- produção sem achar nenhuma linha (Gate 0), e convite com cargo owner já é
-- recusado (20260715000002, 20261006000000).
--
-- O valor fica no enum: tirar valor de enum no Postgres exige recriar o tipo, e
-- ele é usado por colunas, funções e políticas de RLS. Em vez disso, esta
-- migration garante que nenhuma linha volte a usar o papel:
--
--   1. Rede de segurança: qualquer perfil owner residual vira admin (owner tinha
--      visão total, admin é o equivalente).
--   2. CHECK em profiles.role: nenhum perfil novo ou alterado vira owner.
--   3. CHECK em convites.cargo (NOT VALID: convite antigo não é reescrito; ele
--      já não pode ser aceito): nenhum convite novo com cargo owner.
--
-- Os ramos `owner` que sobram em funções antigas viram código morto e saem
-- quando cada função for recriada por outro motivo.

BEGIN;

UPDATE public.profiles SET role = 'admin' WHERE role = 'owner';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_sem_owner;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_sem_owner CHECK (role IS DISTINCT FROM 'owner');

ALTER TABLE public.convites
  DROP CONSTRAINT IF EXISTS convites_cargo_sem_owner;
ALTER TABLE public.convites
  ADD CONSTRAINT convites_cargo_sem_owner CHECK (cargo IS DISTINCT FROM 'owner') NOT VALID;

COMMENT ON CONSTRAINT profiles_role_sem_owner ON public.profiles IS
  'Papel owner aposentado (2026-11-07): o modelo de acesso é admin, coordenador e usuário.';

COMMIT;
