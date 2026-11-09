-- SPEC 137 (BEZ-82): itens do catálogo na estimativa de obra, cada um com a origem do preço.
--
-- 1. Oito chaves novas em estimativa_parametros.parametros.adicionais (ar-condicionado por porte, instalação
--    de ar, aquecedor solar, energia solar e automação). Nenhuma traz valor: ficam "a definir" até haver preço
--    do SINAPI, da empresa ou do usuário. Os códigos de `sinapi.codigo` são insumos do SINAPI (ISD/ICD).
-- 2. faixa_extra_provisoria: quando muito do total vem de referência provisória do Pilar, a faixa abre mais.
--    Acima de 10% provisório, +1 ponto a cada 5% a mais, no máximo 8 pontos.
-- 3. sinapi_precos_insumo: preço de insumo do SINAPI por código, UF, regime e mês. Global, como o cub_valores:
--    só o ultra admin escreve (aal2), toda empresa lê. Só entram códigos do catálogo (importação, BEZ-69).
--
-- A mudança derruba a validação dos parâmetros: alguém confere e valida de novo.

UPDATE public.estimativa_parametros p
SET parametros = jsonb_set(
      p.parametros,
      '{adicionais}',
      (p.parametros -> 'adicionais') || (n.novo -> 'adicionais')
    ) || (n.novo - 'adicionais'),
    validado_em = NULL,
    validado_por = NULL
FROM (
  SELECT $json$
{
  "adicionais": {
    "ac9": {
      "rotulo": "Ar-condicionado split 9.000 BTU",
      "tipo": "a_definir",
      "categoria": "climatizacao",
      "unidade": "un",
      "sinapi": { "codigo": 42424 },
      "nota": "preço do aparelho no SINAPI, sem instalação",
      "fase": "inst",
      "servicos": ["Fornecimento do aparelho"]
    },
    "ac12": {
      "rotulo": "Ar-condicionado split 12.000 BTU",
      "tipo": "a_definir",
      "categoria": "climatizacao",
      "unidade": "un",
      "sinapi": { "codigo": 42425 },
      "nota": "preço do aparelho no SINAPI, sem instalação",
      "fase": "inst",
      "servicos": ["Fornecimento do aparelho"]
    },
    "ac18": {
      "rotulo": "Ar-condicionado split 18.000 BTU",
      "tipo": "a_definir",
      "categoria": "climatizacao",
      "unidade": "un",
      "sinapi": { "codigo": 42422 },
      "nota": "preço do aparelho no SINAPI, sem instalação",
      "fase": "inst",
      "servicos": ["Fornecimento do aparelho"]
    },
    "ac24": {
      "rotulo": "Ar-condicionado split 24.000 BTU",
      "tipo": "a_definir",
      "categoria": "climatizacao",
      "unidade": "un",
      "sinapi": { "codigo": 43184 },
      "nota": "preço do aparelho no SINAPI, sem instalação",
      "fase": "inst",
      "servicos": ["Fornecimento do aparelho"]
    },
    "acinst": {
      "rotulo": "Instalação dos aparelhos de ar-condicionado",
      "tipo": "a_definir",
      "categoria": "climatizacao",
      "unidade": "ponto",
      "nota": "infraestrutura, dreno e mão de obra por ponto; sem preço público, informe o valor",
      "fase": "inst",
      "servicos": ["Infraestrutura frigorífica", "Dreno", "Instalação dos aparelhos"]
    },
    "aqsolar": {
      "rotulo": "Aquecedor solar",
      "tipo": "a_definir",
      "categoria": "energia",
      "unidade": "conjunto",
      "sinapi": { "codigo": 34469 },
      "nota": "conjunto de 1.000 litros, preço do SINAPI sem instalação",
      "fase": "inst",
      "servicos": ["Fornecimento do conjunto"]
    },
    "fv": {
      "rotulo": "Energia solar fotovoltaica",
      "tipo": "a_definir",
      "categoria": "energia",
      "unidade": "kWp",
      "nota": "sem preço público confiável; informe o valor por kWp",
      "fase": "inst",
      "servicos": ["Módulos e inversor", "Instalação e homologação"]
    },
    "automacao": {
      "rotulo": "Automação residencial",
      "tipo": "a_definir",
      "categoria": "automacao",
      "unidade": "ponto",
      "nota": "varia muito com o escopo; informe o valor",
      "fase": "inst",
      "servicos": ["Infraestrutura", "Equipamentos", "Programação"]
    }
  },
  "faixa_extra_provisoria": { "acima_de_pct": 10, "a_cada_pct": 5, "pontos": 1, "max_pontos": 8 }
}
$json$::jsonb AS novo
) n
WHERE p.id = 'default';

-- ---------------------------------------------------------------------------
-- Preço de insumo do SINAPI (global)
-- ---------------------------------------------------------------------------
CREATE TABLE public.sinapi_precos_insumo (
  codigo        integer NOT NULL CHECK (codigo > 0),
  uf            text NOT NULL CHECK (uf ~ '^[A-Z]{2}$'),
  regime        text NOT NULL CHECK (regime IN ('onerado', 'desonerado')),
  mes_base      date NOT NULL CHECK (mes_base = date_trunc('month', mes_base)::date),
  valor         numeric(12, 2) NOT NULL CHECK (valor > 0 AND valor < 100000000),
  -- C = coletado em pesquisa de preço; CR = derivado de um coletado (nível de confiança do SINAPI).
  origem        text NOT NULL CHECK (origem IN ('C', 'CR')),
  descricao     text NOT NULL CHECK (length(btrim(descricao)) > 0 AND length(descricao) <= 300),
  unidade       text NOT NULL CHECK (length(btrim(unidade)) > 0 AND length(unidade) <= 20),
  fonte         text NOT NULL CHECK (length(btrim(fonte)) > 0 AND length(fonte) <= 200),
  importado_por uuid DEFAULT auth.uid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (codigo, uf, regime, mes_base)
);

COMMENT ON TABLE public.sinapi_precos_insumo IS
  'SPEC 137: preço de insumo do SINAPI por código, UF, regime e mês-base, só dos itens do catálogo. Global: só o ultra admin escreve, toda empresa lê.';

ALTER TABLE public.sinapi_precos_insumo ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.sinapi_precos_insumo FROM anon;

CREATE POLICY sinapi_precos_insumo_select ON public.sinapi_precos_insumo
  FOR SELECT TO authenticated USING (true);
CREATE POLICY sinapi_precos_insumo_insert ON public.sinapi_precos_insumo
  FOR INSERT TO authenticated WITH CHECK (public.is_ultra_admin());
CREATE POLICY sinapi_precos_insumo_update ON public.sinapi_precos_insumo
  FOR UPDATE TO authenticated USING (public.is_ultra_admin()) WITH CHECK (public.is_ultra_admin());
CREATE POLICY sinapi_precos_insumo_delete ON public.sinapi_precos_insumo
  FOR DELETE TO authenticated USING (public.is_ultra_admin());
