-- SPEC 136 (BEZ-68): natureza do custo da base calibrada com a composição oficial do CUB.
--
-- O seed mostrava material 50%, mão de obra 43%, equipamentos 2% e despesas 5%. A composição publicada
-- pelo Sinduscon-PR (Relatório 5, set/2026) para as residências unifamiliares dá, em média dos três padrões
-- (R1-B, R1-N e R1-A): material 40,7%, mão de obra 54,5%, despesas administrativas 4,7% e equipamentos 0,1%.
-- A natureza só reparte o total entre materiais e mão de obra: o valor da estimativa não muda.
--
-- Arredondado para 41 / 54 / 4,5 / 0,5. A mudança derruba a validação dos parâmetros.

UPDATE public.estimativa_parametros
SET parametros = jsonb_set(
      parametros,
      '{natureza_base}',
      $json$
{ "material": 41, "mao_de_obra": 54, "equipamentos": 0.5, "despesas": 4.5 }
$json$::jsonb
    ),
    validado_em = NULL,
    validado_por = NULL
WHERE id = 'default';
