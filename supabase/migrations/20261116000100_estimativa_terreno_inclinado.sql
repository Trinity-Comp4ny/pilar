-- SPEC 136 (BEZ-68): terreno inclinado na estimativa de obra.
--
-- Duas chaves novas em estimativa_parametros.parametros.adicionais, usadas só quando a ficha diz que o
-- terreno é inclinado:
--   arrimo         muro de arrimo, R$ por m² de parede (a ficha traz os m²; sem eles, "a definir")
--   terraplenagem  corte, aterro e fundação especial: depende de levantamento topográfico e sondagem,
--                  então fica sempre "a definir" até alguém orçar
--
-- O valor do arrimo é PROVISÓRIO, como todo o resto do seed: a faixa de mercado citada é de R$ 300 a
-- R$ 2.500 por m², e o SINAPI deve substituir isto. A mudança derruba a validação dos parâmetros.

UPDATE public.estimativa_parametros
SET parametros = jsonb_set(
      parametros,
      '{adicionais}',
      (parametros -> 'adicionais') || $json$
{
  "arrimo": {
    "rotulo": "Muro de arrimo",
    "tipo": "por_m2_arrimo",
    "valor": 1200,
    "nota": "valor provisório por m² de parede; confirmar com orçamento ou SINAPI",
    "fase": "fund",
    "servicos": ["Muro de arrimo e drenagem"]
  },
  "terraplenagem": {
    "rotulo": "Terraplenagem e fundação especial",
    "tipo": "a_definir",
    "nota": "depende de levantamento topográfico e sondagem",
    "fase": "fund",
    "servicos": ["Corte e aterro", "Fundação especial"]
  }
}
$json$::jsonb
    ),
    validado_em = NULL,
    validado_por = NULL
WHERE id = 'default';
