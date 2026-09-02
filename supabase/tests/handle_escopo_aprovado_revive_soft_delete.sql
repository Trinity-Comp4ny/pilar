-- pgTAP: handle_escopo_aprovado() (migration 20260892000000)
--
-- Reproduz o bug achado ao verificar a spec 084 ao vivo: quando o ON CONFLICT
-- (projeto_id, disciplina) de projeto_orcamento_fases colide com uma linha
-- SOFT-DELETADA, o trigger somava valor nela sem tirar o deleted_at — o aditivo
-- aprovado ficava invisível pra sempre (todo leitor do app filtra deleted_at IS
-- NULL). Este teste cobre os dois casos: revive a linha morta (o fix) e não muda
-- o comportamento de somar numa linha viva (guarda de regressão).

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(6);

INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features)
VALUES ('00000000-0000-0000-0000-0000000fd001', 'Empresa Handle Escopo Aprovado', NULL, TRUE, '{"projetos": true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features;

INSERT INTO public.projetos (id, empresa_id, nome, status, valor_contrato)
VALUES ('ffffffff-0000-0000-0000-0000000fd001', '00000000-0000-0000-0000-0000000fd001', 'Projeto Revive', 'Em andamento', 30000);

-- ── Caso A (guarda de regressão): linha VIVA já existe, aprovar aditivo soma ──
INSERT INTO public.projeto_orcamento_fases (empresa_id, projeto_id, disciplina, horas_estimadas, custo_hora)
VALUES ('00000000-0000-0000-0000-0000000fd001', 'ffffffff-0000-0000-0000-0000000fd001', 'Estrutural', 40, 150);

INSERT INTO public.escopos (id, empresa_id, projeto_id, descricao, tipo, status, valor_aditivo)
VALUES ('eeeeeeee-0000-0000-0000-0000000fd001', '00000000-0000-0000-0000-0000000fd001', 'ffffffff-0000-0000-0000-0000000fd001', 'Aditivo A', 'aditivo', 'rascunho', 5200);
INSERT INTO public.escopo_itens (escopo_id, descricao, disciplina, horas, custo)
VALUES ('eeeeeeee-0000-0000-0000-0000000fd001', 'Reforço', 'Estrutural', 20, 4000);

UPDATE public.escopos SET status = 'aprovado' WHERE id = 'eeeeeeee-0000-0000-0000-0000000fd001';

SELECT is(
  (SELECT horas_estimadas FROM public.projeto_orcamento_fases
   WHERE projeto_id = 'ffffffff-0000-0000-0000-0000000fd001' AND disciplina = 'Estrutural'),
  60::numeric,
  'Caso A: linha viva soma horas (40 + 20) — comportamento inalterado'
);
SELECT is(
  (SELECT deleted_at FROM public.projeto_orcamento_fases
   WHERE projeto_id = 'ffffffff-0000-0000-0000-0000000fd001' AND disciplina = 'Estrutural'),
  NULL::timestamptz,
  'Caso A: linha viva continua com deleted_at NULL'
);

-- ── Caso B (o fix): linha SOFT-DELETADA colide, aprovar aditivo revive do zero ──
INSERT INTO public.projeto_orcamento_fases (empresa_id, projeto_id, disciplina, horas_estimadas, custo_hora, deleted_at)
VALUES ('00000000-0000-0000-0000-0000000fd001', 'ffffffff-0000-0000-0000-0000000fd001', 'Elétrico', 999, 999, now());

INSERT INTO public.escopos (id, empresa_id, projeto_id, descricao, tipo, status, valor_aditivo)
VALUES ('eeeeeeee-0000-0000-0000-0000000fd002', '00000000-0000-0000-0000-0000000fd001', 'ffffffff-0000-0000-0000-0000000fd001', 'Aditivo B', 'aditivo', 'rascunho', 2600);
INSERT INTO public.escopo_itens (escopo_id, descricao, disciplina, horas, custo)
VALUES ('eeeeeeee-0000-0000-0000-0000000fd002', 'Revisão elétrica', 'Elétrico', 10, 2000);

UPDATE public.escopos SET status = 'aprovado' WHERE id = 'eeeeeeee-0000-0000-0000-0000000fd002';

SELECT is(
  (SELECT deleted_at FROM public.projeto_orcamento_fases
   WHERE projeto_id = 'ffffffff-0000-0000-0000-0000000fd001' AND disciplina = 'Elétrico'),
  NULL::timestamptz,
  'Caso B: linha soft-deletada é revivida (deleted_at volta a NULL)'
);
SELECT is(
  (SELECT horas_estimadas FROM public.projeto_orcamento_fases
   WHERE projeto_id = 'ffffffff-0000-0000-0000-0000000fd001' AND disciplina = 'Elétrico'),
  10::numeric,
  'Caso B: horas vêm só do item novo (10), não somam com o valor morto (999)'
);
SELECT is(
  (SELECT custo_hora FROM public.projeto_orcamento_fases
   WHERE projeto_id = 'ffffffff-0000-0000-0000-0000000fd001' AND disciplina = 'Elétrico'),
  200::numeric,
  'Caso B: custo_hora recalculado do item novo (2000/10=200), não fica o valor morto (999)'
);
SELECT is(
  (SELECT count(*)::integer FROM public.projeto_orcamento_fases
   WHERE projeto_id = 'ffffffff-0000-0000-0000-0000000fd001' AND disciplina = 'Elétrico'),
  1,
  'Caso B: revive a mesma linha, não cria uma segunda (UNIQUE projeto_id+disciplina continua valendo)'
);

SELECT * FROM finish();

ROLLBACK;
