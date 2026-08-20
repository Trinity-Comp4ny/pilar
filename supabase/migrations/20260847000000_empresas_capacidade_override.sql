-- SPEC 052, fase 2: visibilidade e override de capacidade por empresa.
--
-- `pilar_subscription_plans.max_projetos`/`max_usuarios` já definem o padrão
-- por plano, mas não há como negociar um limite diferente pra uma empresa
-- específica sem trocar o plano dela inteiro. Estas duas colunas nullable em
-- `empresas` guardam esse override: `NULL` = usa o padrão do plano.
--
-- Sem enforcement nesta migration (ver spec 052, requisito 9, adiado): o
-- valor fica visível e editável no ultra-admin, mas ainda não bloqueia a
-- criação de projeto. `create_projeto_completo` tem 3 overloads ativos em
-- produção hoje; mexer nela com segurança é trabalho à parte.

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS max_projetos_override integer,
  ADD COLUMN IF NOT EXISTS max_usuarios_override integer;

ALTER TABLE public.empresas
  ADD CONSTRAINT empresas_max_projetos_override_check CHECK (max_projetos_override IS NULL OR max_projetos_override >= 0),
  ADD CONSTRAINT empresas_max_usuarios_override_check CHECK (max_usuarios_override IS NULL OR max_usuarios_override >= 0);

COMMENT ON COLUMN public.empresas.max_projetos_override IS
  'Override de max_projetos só pra esta empresa (negociado fora do plano padrão). NULL = usa o limite do plano.';
COMMENT ON COLUMN public.empresas.max_usuarios_override IS
  'Override de max_usuarios só pra esta empresa (negociado fora do plano padrão). NULL = usa o limite do plano.';
