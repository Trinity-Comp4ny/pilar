-- pgTAP: papel owner aposentado (migration 20261202000000).
--
-- Prova: nenhum perfil sai com owner, perfil não pode virar owner (nem por
-- service_role), convite novo não nasce com cargo owner, e admin segue normal.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(4);

INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role, email_confirmed_at)
VALUES ('0a11e000-0000-0000-0000-00000000000a'::uuid, 'owner_aposentado@empresareal.com.br',
        jsonb_build_object('company_name', 'Owner Aposentado'), 'authenticated', 'authenticated', now());

SELECT is(
  (SELECT count(*)::int FROM public.profiles WHERE role = 'owner'),
  0,
  'nenhum perfil com papel owner'
);

SELECT throws_ok(
  $$UPDATE public.profiles SET role = 'owner' WHERE id = '0a11e000-0000-0000-0000-00000000000a'$$,
  '23514', NULL,
  'perfil não pode virar owner'
);

SELECT lives_ok(
  $$UPDATE public.profiles SET role = 'admin' WHERE id = '0a11e000-0000-0000-0000-00000000000a'$$,
  'perfil continua podendo ser admin'
);

SELECT ok(
  EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'convites_cargo_sem_owner'
          AND conrelid = 'public.convites'::regclass),
  'convites tem a trava de cargo owner'
);

SELECT * FROM finish();
ROLLBACK;
