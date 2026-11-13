-- Estimativa de obra (SPEC 137): ar-condicionado de 36.000 BTU no catálogo.
--
-- Feedback de 12/11: o cliente precisava de um aparelho de 36.000 BTU e a lista parava em 24.000. Na linha
-- residencial o 36.000 BTU é piso-teto; o SINAPI tem o insumo 42419 (split inverter piso-teto, 36.000 BTU/h,
-- ciclo frio), da mesma família dos códigos de 9 a 24 mil já no catálogo. Sem valor do Pilar: o preço vem do
-- SINAPI quando a coleta mensal gravar o código, e até lá fica "a definir" (o usuário ou a empresa informam).
--
-- Não derruba a validação dos parâmetros: o item é novo e não tem valor próprio, então nenhum cálculo existente
-- muda.

UPDATE public.estimativa_parametros p
SET parametros = jsonb_set(
      p.parametros,
      '{adicionais}',
      (p.parametros -> 'adicionais') || $json$
{
  "ac36": {
    "rotulo": "Ar-condicionado split piso-teto 36.000 BTU",
    "tipo": "a_definir",
    "categoria": "climatizacao",
    "unidade": "un",
    "sinapi": { "codigo": 42419 },
    "nota": "preço do aparelho no SINAPI, sem instalação",
    "fase": "inst",
    "servicos": ["Fornecimento do aparelho"]
  }
}
$json$::jsonb
    )
WHERE p.id = 'default'
  AND p.parametros ? 'adicionais'
  AND NOT (p.parametros -> 'adicionais') ? 'ac36';
