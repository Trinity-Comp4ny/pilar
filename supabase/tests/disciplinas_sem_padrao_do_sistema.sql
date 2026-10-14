-- pgTAP: sem disciplinas "padrão do sistema". Migration 20261030000000.
-- O banco montado das migrations não tem nenhuma disciplina global, e a cópia
-- por empresa (antes do DELETE) preserva as opções de quem já usa.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(5);

SELECT is(
  (SELECT count(*)::int FROM public.disciplinas WHERE empresa_id IS NULL),
  0,
  'o banco não tem disciplina padrão do sistema'
);

-- ── Reexecuta o corpo da migration numa fixture com semente global ───────────
INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features) VALUES
  ('00000000-0000-0000-0000-0000000d1001', 'Empresa Usa Padrao', NULL, TRUE, '{"projetos": true}'::jsonb),
  ('00000000-0000-0000-0000-0000000d1002', 'Empresa Sem Uso', NULL, TRUE, '{"projetos": true}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.projetos (id, empresa_id, nome, status)
VALUES ('d1000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000d1001', 'Projeto Usa Padrao', 'Em andamento');

INSERT INTO public.projeto_disciplinas (id, projeto_id, nome, status)
VALUES ('d1000000-0000-0000-0000-0000000001a1', 'd1000000-0000-0000-0000-0000000000f1', 'Estrutural pgtap', 'Em Andamento');

INSERT INTO public.disciplinas (nome, empresa_id) VALUES
  ('Estrutural pgtap', NULL),
  ('Nunca usada pgtap', NULL);

INSERT INTO public.disciplinas (nome, empresa_id)
SELECT DISTINCT ON (p.empresa_id, lower(g.nome)) g.nome, p.empresa_id
FROM public.projeto_disciplinas pd
JOIN public.projetos p ON p.id = pd.projeto_id
JOIN public.disciplinas g ON g.empresa_id IS NULL AND lower(g.nome) = lower(pd.nome)
WHERE p.empresa_id IS NOT NULL
ORDER BY p.empresa_id, lower(g.nome)
ON CONFLICT DO NOTHING;

DELETE FROM public.disciplinas WHERE empresa_id IS NULL;

SELECT is(
  (SELECT count(*)::int FROM public.disciplinas WHERE empresa_id IS NULL),
  0,
  'a semente global some'
);
SELECT is(
  (SELECT count(*)::int FROM public.disciplinas
    WHERE nome = 'Estrutural pgtap' AND empresa_id = '00000000-0000-0000-0000-0000000d1001'),
  1,
  'quem usava a disciplina padrão ganha uma cópia própria'
);
SELECT is(
  (SELECT count(*)::int FROM public.disciplinas WHERE nome = 'Nunca usada pgtap'),
  0,
  'disciplina padrão que ninguém usa some de vez'
);
SELECT is(
  (SELECT count(*)::int FROM public.projeto_disciplinas WHERE nome = 'Estrutural pgtap'),
  1,
  'a disciplina do projeto continua intacta'
);

SELECT * FROM finish();
ROLLBACK;
