-- SPEC 136 / ADR 0063: estimativa paramétrica de obra (custo em faixa e cronograma).
--
-- A IA só estrutura a ficha; o motor (src/lib/estimativaObra.ts) calcula com o CUB
-- importado e com os parâmetros abaixo. Tudo que o cálculo usa vive no banco, então
-- trocar CUB, adicional ou percentual não exige deploy.
--
-- Os valores semeados em estimativa_parametros são PLACEHOLDER do protótipo v0, não
-- referência de mercado: validado_em nasce nulo, a tela avisa e o PDF fica bloqueado
-- até o ultra admin validar com obras reais (BEZ-16). O CUB não é semeado: entra pela
-- importação do ultra admin (BEZ-13).

-- ---------------------------------------------------------------------------
-- 1. CUB (global): preço de referência por UF, subtipo, padrão e mês
-- ---------------------------------------------------------------------------
CREATE TABLE public.cub_valores (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uf            text NOT NULL CHECK (uf ~ '^[A-Z]{2}$'),
  -- Código do CUB da NBR 12721: R1, PP-4, R8, R16, CSL-8, CAL-8, GI.
  subtipo       text NOT NULL CHECK (subtipo ~ '^[A-Z]{1,3}[0-9]{0,2}(-[0-9]{1,2})?$'),
  -- 'unico' para o que não tem divisão por padrão (ex.: GI).
  padrao        text NOT NULL CHECK (padrao IN ('baixo', 'normal', 'alto', 'unico')),
  mes_base      date NOT NULL CHECK (mes_base = date_trunc('month', mes_base)::date),
  valor_m2      numeric(10, 2) NOT NULL CHECK (valor_m2 > 0 AND valor_m2 < 100000),
  fonte         text NOT NULL CHECK (length(btrim(fonte)) > 0 AND length(fonte) <= 200),
  importado_por uuid DEFAULT auth.uid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (uf, subtipo, padrao, mes_base)
);

CREATE INDEX idx_cub_valores_busca ON public.cub_valores (uf, subtipo, mes_base DESC);

COMMENT ON TABLE public.cub_valores IS
  'SPEC 136: CUB (R$/m²) por UF, subtipo, padrão e mês-base. Global: só o ultra admin escreve, toda empresa lê.';

ALTER TABLE public.cub_valores ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.cub_valores FROM anon;

CREATE POLICY cub_valores_select ON public.cub_valores
  FOR SELECT TO authenticated USING (true);
CREATE POLICY cub_valores_insert ON public.cub_valores
  FOR INSERT TO authenticated WITH CHECK (public.is_ultra_admin());
CREATE POLICY cub_valores_update ON public.cub_valores
  FOR UPDATE TO authenticated USING (public.is_ultra_admin()) WITH CHECK (public.is_ultra_admin());
CREATE POLICY cub_valores_delete ON public.cub_valores
  FOR DELETE TO authenticated USING (public.is_ultra_admin());

-- ---------------------------------------------------------------------------
-- 2. Parâmetros do motor (singleton global)
-- ---------------------------------------------------------------------------
CREATE TABLE public.estimativa_parametros (
  id          text PRIMARY KEY DEFAULT 'default' CHECK (id = 'default'),
  parametros  jsonb NOT NULL CHECK (jsonb_typeof(parametros) = 'object'),
  -- Nulo = placeholder: a tela avisa e PDF e anexo ficam bloqueados.
  validado_em timestamptz,
  validado_por uuid,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid
);

COMMENT ON TABLE public.estimativa_parametros IS
  'SPEC 136: percentual por etapa, adicionais, natureza, produtividade e fases do cronograma. Global, só o ultra admin escreve.';
COMMENT ON COLUMN public.estimativa_parametros.validado_em IS
  'Nulo enquanto os valores forem placeholder do protótipo. Preenchido pelo ultra admin depois de calibrar com obras reais.';

ALTER TABLE public.estimativa_parametros ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.estimativa_parametros FROM anon;

CREATE POLICY estimativa_parametros_select ON public.estimativa_parametros
  FOR SELECT TO authenticated USING (true);
CREATE POLICY estimativa_parametros_update ON public.estimativa_parametros
  FOR UPDATE TO authenticated USING (public.is_ultra_admin()) WITH CHECK (public.is_ultra_admin());

CREATE OR REPLACE FUNCTION public.tg_estimativa_parametros_auditoria()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  -- Mexer nos valores invalida a validação anterior; só validar de novo quem confere.
  IF NEW.parametros IS DISTINCT FROM OLD.parametros AND NEW.validado_em IS NOT DISTINCT FROM OLD.validado_em THEN
    NEW.validado_em := NULL;
    NEW.validado_por := NULL;
  ELSIF NEW.validado_em IS NOT NULL AND NEW.validado_em IS DISTINCT FROM OLD.validado_em THEN
    NEW.validado_por := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.tg_estimativa_parametros_auditoria() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_estimativa_parametros_auditoria
  BEFORE UPDATE ON public.estimativa_parametros
  FOR EACH ROW EXECUTE FUNCTION public.tg_estimativa_parametros_auditoria();

INSERT INTO public.estimativa_parametros (id, parametros) VALUES ('default', $json$
{
  "versao": 1,
  "adm_padrao": 12,
  "faixa_padrao": 12,
  "equipe_padrao": 6,
  "horas_mes_por_pessoa": 176,
  "faixa_extra_mes_antigo": 4,
  "faixa_extra_uf_vizinha": 8,
  "produtividade_h_m2": { "baixo": 28, "normal": 34, "alto": 42, "industrial": 18 },
  "natureza_base": { "material": 50, "mao_de_obra": 43, "equipamentos": 2, "despesas": 5 },
  "natureza_adicionais": { "material": 60, "mao_de_obra": 40 },
  "etapas": [
    { "id": "preliminares", "nome": "Serviços preliminares", "fase": "prel", "percentual": 3 },
    { "id": "estrutura", "nome": "Estrutura", "fase": "estr", "percentual": 18 },
    { "id": "alvenaria", "nome": "Alvenaria", "fase": "alv", "percentual": 8 },
    { "id": "cobertura", "nome": "Cobertura", "fase": "alv", "percentual": 6 },
    { "id": "instalacoes", "nome": "Instalações elétricas e hidráulicas", "fase": "inst", "percentual": 14 },
    { "id": "esquadrias", "nome": "Esquadrias", "fase": "acab", "percentual": 9 },
    { "id": "revestimentos", "nome": "Revestimentos", "fase": "rev", "percentual": 16 },
    { "id": "pisos", "nome": "Pisos", "fase": "rev", "percentual": 8 },
    { "id": "pintura", "nome": "Pintura", "fase": "acab", "percentual": 6 },
    { "id": "loucas", "nome": "Louças e metais", "fase": "acab", "percentual": 5 },
    { "id": "limpeza", "nome": "Limpeza e entrega", "fase": "ent", "percentual": 7 }
  ],
  "fases": [
    { "id": "prel", "nome": "Serviços preliminares", "inicio": 0, "fim": 0.07, "etapas": [
      { "nome": "Canteiro", "servicos": ["Ligações provisórias", "Tapume e barracão"] },
      { "nome": "Locação", "servicos": ["Locação da obra"] } ] },
    { "id": "fund", "nome": "Fundação", "inicio": 0.05, "fim": 0.16, "etapas": [
      { "nome": "Fundação", "servicos": ["Escavação", "Estacas e blocos", "Vigas baldrame"] },
      { "nome": "Impermeabilização", "servicos": ["Baldrame"] } ] },
    { "id": "estr", "nome": "Estrutura", "inicio": 0.14, "fim": 0.38, "etapas": [
      { "nome": "Pilares e vigas", "servicos": ["Formas", "Armação", "Concretagem"] },
      { "nome": "Lajes", "servicos": ["Laje do térreo", "Laje do pavimento superior"] } ] },
    { "id": "alv", "nome": "Alvenaria e cobertura", "inicio": 0.32, "fim": 0.52, "etapas": [
      { "nome": "Alvenaria", "servicos": ["Vedação", "Vergas e contravergas"] },
      { "nome": "Cobertura", "servicos": ["Estrutura do telhado", "Telhamento", "Calhas e rufos"] } ] },
    { "id": "inst", "nome": "Instalações", "inicio": 0.45, "fim": 0.70, "etapas": [
      { "nome": "Elétrica", "servicos": ["Infraestrutura", "Fiação", "Quadros"] },
      { "nome": "Hidrossanitária", "servicos": ["Água fria e quente", "Esgoto", "Águas pluviais"] } ] },
    { "id": "rev", "nome": "Revestimentos e pisos", "inicio": 0.60, "fim": 0.80, "etapas": [
      { "nome": "Revestimentos", "servicos": ["Chapisco e reboco", "Gesso", "Cerâmica de parede"] },
      { "nome": "Pisos", "servicos": ["Contrapiso", "Porcelanato"] } ] },
    { "id": "acab", "nome": "Esquadrias e acabamentos", "inicio": 0.75, "fim": 0.97, "etapas": [
      { "nome": "Esquadrias", "servicos": ["Portas", "Janelas", "Vidros"] },
      { "nome": "Acabamentos", "servicos": ["Pintura", "Louças e metais", "Bancadas"] } ] },
    { "id": "adic", "nome": "Adicionais", "inicio": 0.66, "fim": 0.97, "etapas": [] },
    { "id": "ent", "nome": "Limpeza e entrega", "inicio": 0.96, "fim": 1, "etapas": [
      { "nome": "Entrega", "servicos": ["Limpeza final", "Vistoria com o cliente", "Entrega das chaves"] } ] }
  ],
  "adicionais": {
    "fundacao": { "rotulo": "Fundação", "tipo": "percentual_base", "valor": 6, "valor_industrial": 8, "nota": "não entra no CUB", "fase": "fund", "servicos": [] },
    "piscina": { "rotulo": "Piscina", "tipo": "por_m2", "valor": 2500, "nota": "por m² de piscina", "fase": "adic", "servicos": ["Escavação e estrutura", "Revestimento e equipamentos"] },
    "gourmet": { "rotulo": "Área gourmet", "tipo": "por_padrao", "valores": { "baixo": 25000, "normal": 45000, "alto": 80000 }, "nota": "pelo padrão da obra", "fase": "adic", "servicos": ["Execução"] },
    "marcenaria": { "rotulo": "Marcenaria", "tipo": "percentual_base_por_nivel", "valores": { "basica": 6, "completa": 11 }, "nota": "percentual da base do CUB", "fase": "adic", "servicos": ["Medição", "Produção", "Instalação"] },
    "paisagismo": { "rotulo": "Paisagismo", "tipo": "por_m2_area_livre", "valor": 110, "nota": "por m² de área livre do terreno", "fase": "adic", "servicos": ["Preparo do solo", "Plantio"] },
    "elevador": { "rotulo": "Elevador", "tipo": "valor_fixo", "valor": 180000, "nota": "valor de referência", "fase": "adic", "servicos": ["Execução"] },
    "subsolo": { "rotulo": "Subsolo", "tipo": "a_definir", "nota": "a definir com sondagem", "fase": "adic", "servicos": ["Execução"] }
  }
}
$json$::jsonb);

-- ---------------------------------------------------------------------------
-- 3. Ajustes da empresa sobre os adicionais de referência
-- ---------------------------------------------------------------------------
CREATE TABLE public.estimativa_ajustes_empresa (
  empresa_id uuid PRIMARY KEY REFERENCES public.empresas(id) ON DELETE CASCADE,
  -- Mesmas chaves e formato dos adicionais dos parâmetros, só os campos que a empresa muda.
  adicionais jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(adicionais) = 'object'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT auth.uid()
);

ALTER TABLE public.estimativa_ajustes_empresa ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.estimativa_ajustes_empresa FROM anon;

CREATE POLICY estimativa_ajustes_select ON public.estimativa_ajustes_empresa
  FOR SELECT TO authenticated USING (empresa_id = public.get_user_empresa_id());
CREATE POLICY estimativa_ajustes_insert ON public.estimativa_ajustes_empresa
  FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_user_empresa_id());
CREATE POLICY estimativa_ajustes_update ON public.estimativa_ajustes_empresa
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id())
  WITH CHECK (empresa_id = public.get_user_empresa_id());
CREATE POLICY estimativa_ajustes_delete ON public.estimativa_ajustes_empresa
  FOR DELETE TO authenticated USING (empresa_id = public.get_user_empresa_id());

CREATE TRIGGER trg_estimativa_ajustes_updated_at
  BEFORE UPDATE ON public.estimativa_ajustes_empresa
  FOR EACH ROW EXECUTE FUNCTION public.tg_pilar_touch_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Estimativas da empresa
-- ---------------------------------------------------------------------------
CREATE TABLE public.estimativas_obra (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id   uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome         text NOT NULL CHECK (length(btrim(nome)) BETWEEN 1 AND 200),
  cliente_id   uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  cliente_nome text CHECK (cliente_nome IS NULL OR length(cliente_nome) <= 200),
  lead_id      uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  proposta_id  uuid REFERENCES public.propostas(id) ON DELETE SET NULL,
  obra_id      uuid REFERENCES public.obras(id) ON DELETE SET NULL,
  status       text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'enviada', 'virou_obra')),
  versao_atual integer NOT NULL DEFAULT 0 CHECK (versao_atual >= 0),
  ficha        jsonb NOT NULL CHECK (jsonb_typeof(ficha) = 'object'),
  premissas    jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(premissas) = 'object'),
  -- Último resultado calculado (snapshot); a verdade de cada versão fica em estimativa_obra_versoes.
  resultado    jsonb,
  created_by   uuid NOT NULL DEFAULT auth.uid(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_estimativas_obra_empresa ON public.estimativas_obra (empresa_id, updated_at DESC);
CREATE INDEX idx_estimativas_obra_lead ON public.estimativas_obra (lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX idx_estimativas_obra_proposta ON public.estimativas_obra (proposta_id) WHERE proposta_id IS NOT NULL;
CREATE INDEX idx_estimativas_obra_obra ON public.estimativas_obra (obra_id) WHERE obra_id IS NOT NULL;
CREATE INDEX idx_estimativas_obra_cliente ON public.estimativas_obra (cliente_id) WHERE cliente_id IS NOT NULL;

COMMENT ON TABLE public.estimativas_obra IS
  'SPEC 136: estimativa paramétrica de obra da empresa. Vive antes de haver projeto ou obra; obra_id fica preenchido quando virou obra.';

ALTER TABLE public.estimativas_obra ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.estimativas_obra FROM anon;

CREATE POLICY estimativas_obra_select ON public.estimativas_obra
  FOR SELECT TO authenticated USING (empresa_id = public.get_user_empresa_id());

-- Vínculos opcionais revalidados contra a empresa (padrão obra_frente): sem isso, dava para
-- ligar a estimativa a um lead, proposta, cliente ou obra de outra empresa.
CREATE POLICY estimativas_obra_insert ON public.estimativas_obra
  FOR INSERT TO authenticated WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND (cliente_id IS NULL OR EXISTS (
      SELECT 1 FROM public.clientes c WHERE c.id = cliente_id AND c.empresa_id = public.get_user_empresa_id()))
    AND (lead_id IS NULL OR EXISTS (
      SELECT 1 FROM public.leads l WHERE l.id = lead_id AND l.empresa_id = public.get_user_empresa_id()))
    AND (proposta_id IS NULL OR EXISTS (
      SELECT 1 FROM public.propostas p WHERE p.id = proposta_id AND p.empresa_id = public.get_user_empresa_id()))
    AND (obra_id IS NULL OR EXISTS (
      SELECT 1 FROM public.obras o WHERE o.id = obra_id AND o.empresa_id = public.get_user_empresa_id()))
  );

CREATE POLICY estimativas_obra_update ON public.estimativas_obra
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id())
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND (cliente_id IS NULL OR EXISTS (
      SELECT 1 FROM public.clientes c WHERE c.id = cliente_id AND c.empresa_id = public.get_user_empresa_id()))
    AND (lead_id IS NULL OR EXISTS (
      SELECT 1 FROM public.leads l WHERE l.id = lead_id AND l.empresa_id = public.get_user_empresa_id()))
    AND (proposta_id IS NULL OR EXISTS (
      SELECT 1 FROM public.propostas p WHERE p.id = proposta_id AND p.empresa_id = public.get_user_empresa_id()))
    AND (obra_id IS NULL OR EXISTS (
      SELECT 1 FROM public.obras o WHERE o.id = obra_id AND o.empresa_id = public.get_user_empresa_id()))
  );

-- Exclusão definitiva (rascunho descartado). Sem soft delete: a policy de SELECT que filtra
-- deleted_at é a armadilha de RLS da SPEC 060.
CREATE POLICY estimativas_obra_delete ON public.estimativas_obra
  FOR DELETE TO authenticated USING (empresa_id = public.get_user_empresa_id());

CREATE TRIGGER trg_estimativas_obra_updated_at
  BEFORE UPDATE ON public.estimativas_obra
  FOR EACH ROW EXECUTE FUNCTION public.tg_pilar_touch_updated_at();

-- ---------------------------------------------------------------------------
-- 5. Versões (snapshots imutáveis)
-- ---------------------------------------------------------------------------
CREATE TABLE public.estimativa_obra_versoes (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id            uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  estimativa_id         uuid NOT NULL REFERENCES public.estimativas_obra(id) ON DELETE CASCADE,
  -- Sempre atribuída pelo trigger (próximo número da estimativa), nunca pelo client.
  versao                integer NOT NULL DEFAULT 0,
  nota                  text CHECK (nota IS NULL OR length(nota) <= 500),
  ficha                 jsonb NOT NULL CHECK (jsonb_typeof(ficha) = 'object'),
  premissas             jsonb NOT NULL CHECK (jsonb_typeof(premissas) = 'object'),
  resultado             jsonb NOT NULL CHECK (jsonb_typeof(resultado) = 'object'),
  -- Foto de como estavam os parâmetros: PDF e anexo só valem para versão com parâmetros validados.
  parametros_validados  boolean NOT NULL DEFAULT false,
  created_by            uuid NOT NULL DEFAULT auth.uid(),
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (estimativa_id, versao)
);

CREATE INDEX idx_estimativa_versoes_empresa ON public.estimativa_obra_versoes (empresa_id);

COMMENT ON TABLE public.estimativa_obra_versoes IS
  'SPEC 136: snapshot imutável de cada versão da estimativa. Só insert e select: a versão enviada ao cliente nunca muda.';

ALTER TABLE public.estimativa_obra_versoes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.estimativa_obra_versoes FROM anon;

CREATE POLICY estimativa_versoes_select ON public.estimativa_obra_versoes
  FOR SELECT TO authenticated USING (empresa_id = public.get_user_empresa_id());

CREATE POLICY estimativa_versoes_insert ON public.estimativa_obra_versoes
  FOR INSERT TO authenticated WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND EXISTS (
      SELECT 1 FROM public.estimativas_obra e
      WHERE e.id = estimativa_id AND e.empresa_id = public.get_user_empresa_id()
    )
  );
-- Sem policy de UPDATE nem de DELETE: nega por padrão. A exclusão da estimativa apaga as versões em cascata.

-- Numera a versão sob lock da estimativa (duas abas salvando juntas não colidem) e
-- atualiza o ponteiro da estimativa.
CREATE OR REPLACE FUNCTION public.tg_estimativa_versao_numerar()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_atual integer;
BEGIN
  SELECT versao_atual INTO v_atual
    FROM public.estimativas_obra
   WHERE id = NEW.estimativa_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Estimativa não encontrada' USING ERRCODE = 'foreign_key_violation';
  END IF;
  NEW.versao := v_atual + 1;
  UPDATE public.estimativas_obra SET versao_atual = NEW.versao WHERE id = NEW.estimativa_id;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.tg_estimativa_versao_numerar() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_estimativa_versao_numerar
  BEFORE INSERT ON public.estimativa_obra_versoes
  FOR EACH ROW EXECUTE FUNCTION public.tg_estimativa_versao_numerar();
