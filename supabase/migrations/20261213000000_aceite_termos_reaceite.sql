-- Reaceite dos Termos de Uso pelo administrador dentro do app (Termos v2.0).
--
-- O aceite só era pedido no cadastro ('signup') ou ao entrar por convite/Google
-- ('profile_setup'). Mudança material nos Termos (v2.0: IA e responsabilidade técnica,
-- teto de responsabilidade, foro) passa a ser aceita de novo pelo administrador da
-- conta, que responde pela empresa no contrato: a faixa do app grava a versão aceita
-- com source 'reaceite'. Membro da equipe não precisa reaceitar.
--
-- RLS da tabela não muda: cada usuário só grava e lê o próprio aceite.

ALTER TABLE public.terms_acceptances DROP CONSTRAINT IF EXISTS terms_acceptances_source_check;
ALTER TABLE public.terms_acceptances
  ADD CONSTRAINT terms_acceptances_source_check CHECK (source IN ('signup', 'profile_setup', 'reaceite'));
