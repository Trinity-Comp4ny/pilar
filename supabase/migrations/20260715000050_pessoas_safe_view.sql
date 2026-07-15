-- =====================================================================
-- pessoas_safe: fecha, NO BANCO, o vazamento de PII/dados financeiros.
--
-- Problema (auditoria, ALTO): a tela de Equipe fazia select('*') em pessoas.
-- A RLS pessoas_select só filtra empresa + feature 'pessoas' viewer, sem
-- proteção por COLUNA, e a tabela dá GRANT ALL para authenticated. Assim
-- salário (salario_fixo/valor_m2), contas bancárias, chaves PIX e CPF
-- completo trafegavam no payload para QUALQUER não-admin. A UI só escondia
-- no cliente: o dado já tinha chegado no browser, e um select('*') cru na
-- tabela continuava vazando mesmo trocando a tela.
--
-- Correção em duas partes (a decisão fica no banco, não no front):
--   1. REVOGA o SELECT das 5 colunas sensíveis na tabela base para
--      authenticated/anon. A partir daqui, ninguém lê essas colunas
--      direto de public.pessoas via API (select('*') passa a falhar nelas).
--   2. Cria a view pessoas_safe (roda com o privilégio do dono, por omitir
--      security_invoker) que é o ÚNICO caminho de leitura dessas colunas:
--      expõe os valores reais só quando
--      can_view_folha() (owner/admin/ultra_admin); para os demais papéis
--      retorna NULL / '[]' / CPF mascarado.
--
-- Escopo (casado com a auditoria): mascara exatamente salario_fixo,
-- valor_m2, contas_bancarias, chaves_pix e o CPF completo. RG, PIS/NIT,
-- CNPJ, data de nascimento e endereço seguem legíveis pelo viewer como
-- hoje (fora do escopo desta auditoria).
--
-- Por que privilégio do dono (omitindo security_invoker): a view PRECISA ler
-- as colunas sensíveis para poder mascará-las condicionalmente; com o SELECT
-- revogado do invoker, uma view security_invoker não conseguiria lê-las nem
-- para o admin. Como a view roda com o privilégio do dono, ela bypassa a RLS
-- da base, então o predicado multi-tenant (empresa + feature viewer) é
-- replicado no WHERE da view. can_view_folha(),
-- get_user_empresa_id() e user_has_feature() são SECURITY DEFINER e resolvem
-- o usuário real via auth.uid() (o JWT não muda por a view ser definer).
--
-- Compat: right()/regexp_replace/cast jsonb estáveis em PG15 (prod) e PG17
-- (staging). GRANT por coluna é privilégio, não mudança de schema.
--
-- Impacto verificado nos demais consumidores: todo o resto do código lê
-- pessoas com lista de colunas explícita e não-sensível (id, nome, cargo,
-- horas_semanais); RPCs de folha e edge functions rodam como definer/
-- service_role. Portanto o revoke não quebra outras telas.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Lockdown por coluna na tabela base (authenticated + anon).
--    Mantém INSERT/UPDATE/DELETE (escritas continuam na tabela) e o
--    SELECT das colunas não-sensíveis. service_role mantém GRANT ALL.
-- ---------------------------------------------------------------------
REVOKE SELECT ON public.pessoas FROM authenticated;
REVOKE SELECT ON public.pessoas FROM anon;

GRANT SELECT (
  id, empresa_id, profile_id, nome, primeiro_nome, sobrenome, cargo,
  email, telefone, tipo_contrato, status, endereco, rg, data_nascimento,
  data_admissao, data_demissao, cnpj, razao_social, pis_nit,
  horas_semanais, deleted_at, created_at, created_by, updated_at, updated_by
) ON public.pessoas TO authenticated;

GRANT SELECT (
  id, empresa_id, profile_id, nome, primeiro_nome, sobrenome, cargo,
  email, telefone, tipo_contrato, status, endereco, rg, data_nascimento,
  data_admissao, data_demissao, cnpj, razao_social, pis_nit,
  horas_semanais, deleted_at, created_at, created_by, updated_at, updated_by
) ON public.pessoas TO anon;

-- ---------------------------------------------------------------------
-- 2. View segura: único caminho de leitura das colunas sensíveis.
-- ---------------------------------------------------------------------
DROP VIEW IF EXISTS public.pessoas_safe;

-- security_barrier: a view é fronteira de segurança (roda com o privilégio
-- do dono e mascara colunas). Impede que um predicado do chamador "vaze" para
-- dentro (ex.: função LEAKPROOF-falsa avaliada antes do filtro de tenant).
CREATE VIEW public.pessoas_safe WITH (security_barrier = true) AS
SELECT
  p.id,
  p.empresa_id,
  p.profile_id,
  p.nome,
  p.primeiro_nome,
  p.sobrenome,
  p.cargo,
  p.email,
  p.telefone,
  p.tipo_contrato,
  p.status,
  p.endereco,
  p.rg,
  p.data_nascimento,
  p.data_admissao,
  p.data_demissao,
  p.cnpj,
  p.razao_social,
  p.pis_nit,
  p.horas_semanais,
  p.deleted_at,
  p.created_at,
  p.updated_at,
  -- Flag para o cliente saber (sem round-trip extra) se recebeu os dados reais.
  public.can_view_folha() AS pode_ver_sensivel,
  -- CPF: completo só para quem vê folha; senão mascara para ***.***.***-NN.
  CASE
    WHEN public.can_view_folha() THEN p.cpf
    WHEN p.cpf IS NULL OR p.cpf = '' THEN p.cpf
    ELSE '***.***.***-' || right(regexp_replace(p.cpf, '\D', '', 'g'), 2)
  END AS cpf,
  -- Dados de folha/pagamento: só para quem vê folha.
  CASE WHEN public.can_view_folha() THEN p.salario_fixo END AS salario_fixo,
  CASE WHEN public.can_view_folha() THEN p.valor_m2 END AS valor_m2,
  CASE WHEN public.can_view_folha() THEN p.contas_bancarias ELSE '[]'::jsonb END AS contas_bancarias,
  CASE WHEN public.can_view_folha() THEN p.chaves_pix ELSE '[]'::jsonb END AS chaves_pix
FROM public.pessoas p
-- View roda com privilégio do dono (bypassa a RLS da base): replicar o
-- predicado da policy pessoas_select para manter o multi-tenant e o gate.
WHERE p.empresa_id = public.get_user_empresa_id()
  AND public.user_has_feature('pessoas', 'viewer');

-- authenticated lê a view; anon não (equipe é dado interno).
GRANT SELECT ON public.pessoas_safe TO authenticated;

COMMENT ON VIEW public.pessoas_safe IS
  'Leitura segura de pessoas: único caminho para salário, contas, PIX e CPF completo (só com can_view_folha(); senão mascarado). Multi-tenant + feature viewer replicados no WHERE. Escritas continuam em public.pessoas.';

COMMIT;
