-- O cadastro é compartilhado por Gestão, Obra e Financeiro. Os atalhos
-- existentes continuam criando fornecedores sem categoria.
ALTER TABLE public.fornecedores ADD COLUMN categorias text[] NOT NULL DEFAULT '{}';

CREATE TABLE public.fornecedor_categorias (
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  chave text NOT NULL,
  nome text NOT NULL,
  PRIMARY KEY (empresa_id, chave)
);
ALTER TABLE public.fornecedor_categorias ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fornecedor_categorias FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.fornecedor_categorias TO authenticated;
CREATE POLICY fornecedor_categorias_leitura ON public.fornecedor_categorias FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id() AND
    (public.user_has_feature('obras','viewer') OR public.user_has_feature('financeiro','viewer') OR public.can_view_financeiro()));

CREATE FUNCTION public.tg_fornecedor_categorias()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_categoria text;
  v_nome text;
  v_chave text;
  v_normalizadas text[] := '{}';
BEGIN
  IF cardinality(NEW.categorias) > 30 THEN RAISE EXCEPTION 'Selecione até 30 categorias'; END IF;
  FOR v_categoria IN
    SELECT nome FROM unnest(NEW.categorias) WITH ORDINALITY AS entrada(nome, posicao)
    ORDER BY lower(btrim(regexp_replace(nome, '[[:space:]]+', ' ', 'g'))), posicao
  LOOP
    v_nome := nullif(btrim(regexp_replace(v_categoria, '[[:space:]]+', ' ', 'g')), '');
    IF v_nome IS NULL OR length(v_nome) > 80 THEN RAISE EXCEPTION 'Confira o nome da categoria'; END IF;
    v_chave := lower(v_nome);
    INSERT INTO public.fornecedor_categorias AS c (empresa_id, chave, nome) VALUES (NEW.empresa_id, v_chave, v_nome)
    ON CONFLICT (empresa_id, chave) DO UPDATE SET nome = c.nome
    RETURNING nome INTO v_nome;
    IF NOT v_nome = ANY(v_normalizadas) THEN v_normalizadas := array_append(v_normalizadas, v_nome); END IF;
  END LOOP;
  NEW.categorias := v_normalizadas;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.tg_fornecedor_categorias() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER normalizar_fornecedor_categorias
  BEFORE INSERT OR UPDATE OF categorias ON public.fornecedores
  FOR EACH ROW EXECUTE FUNCTION public.tg_fornecedor_categorias();
