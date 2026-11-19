-- Placa de obra: situação da placa em projetos e obras, para o mapa mostrar o que ainda falta instalar.
--
-- 1. placa_status em projetos e obras: nao_instalada (padrão), instalada ou retirada.
-- 2. placa_data: quando a placa mudou de situação por último (opcional, preenchida pelo front).
-- 3. projetos_safe passa a expor as colunas (o front lê projetos por ela). Obras são lidas direto da tabela.

ALTER TABLE public.projetos
  ADD COLUMN IF NOT EXISTS placa_status text NOT NULL DEFAULT 'nao_instalada'
    CHECK (placa_status IN ('nao_instalada', 'instalada', 'retirada')),
  ADD COLUMN IF NOT EXISTS placa_data date;

ALTER TABLE public.obras
  ADD COLUMN IF NOT EXISTS placa_status text NOT NULL DEFAULT 'nao_instalada'
    CHECK (placa_status IN ('nao_instalada', 'instalada', 'retirada')),
  ADD COLUMN IF NOT EXISTS placa_data date;

COMMENT ON COLUMN public.projetos.placa_status IS 'Situação da placa: nao_instalada, instalada ou retirada.';
COMMENT ON COLUMN public.obras.placa_status IS 'Situação da placa: nao_instalada, instalada ou retirada.';

-- Colunas novas no fim (CREATE OR REPLACE não deixa mudar a ordem das existentes). O WITH é repetido
-- de propósito: CREATE OR REPLACE sem ele zera o security_barrier.
CREATE OR REPLACE VIEW public.projetos_safe WITH (security_barrier = true) AS
SELECT
  p.id,
  p.empresa_id,
  p.cliente_id,
  p.codigo_projeto,
  p.nome,
  p.localizacao,
  p.latitude,
  p.longitude,
  p.status,
  p.status_data,
  p.data_inicio,
  p.data_previsao,
  p.data_final,
  p.observacao,
  p.parcelas,
  p.area_m2,
  p.prioridade,
  p.etapa_id,
  p.disciplinas,
  p.comentarios,
  p.links,
  p.deleted_at,
  p.created_at,
  p.created_by,
  p.updated_at,
  p.updated_by,
  public.can_view_financeiro() AS pode_ver_valor,
  CASE WHEN public.can_view_financeiro() THEN p.valor_contrato END AS valor_contrato,
  CASE WHEN public.can_view_financeiro() THEN p.custo_indireto_pct END AS custo_indireto_pct,
  p.ordem_prioridade,
  p.placa_status,
  p.placa_data
FROM public.projetos p
WHERE p.empresa_id = public.get_user_empresa_id()
  AND p.deleted_at IS NULL
  AND public.user_has_feature('projetos', 'viewer');
