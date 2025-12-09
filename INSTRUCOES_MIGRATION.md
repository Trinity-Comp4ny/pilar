# Instruções para Aplicar as Migrations no Supabase

## ⚠️ IMPORTANTE: Execute este SQL no Supabase Dashboard

Para corrigir os erros e adicionar as novas funcionalidades, você precisa executar o SQL abaixo diretamente no Supabase Dashboard.

### Passos:

1. Acesse o **Supabase Dashboard** (https://supabase.com/dashboard)
2. Selecione seu projeto
3. Vá em **SQL Editor** no menu lateral
4. Clique em **New Query**
5. Cole o SQL abaixo
6. Clique em **Run** para executar

---

## SQL para Executar:

```sql
-- ============================================================================
-- MIGRATION COMPLETA: Adiciona coluna disciplinas e status_data
-- ============================================================================

-- 1. Adiciona coluna disciplinas como JSONB na tabela projetos
ALTER TABLE public.projetos 
ADD COLUMN IF NOT EXISTS disciplinas JSONB DEFAULT '[]'::jsonb;

-- 2. Adiciona coluna status_data para armazenar o status de prazo
ALTER TABLE public.projetos 
ADD COLUMN IF NOT EXISTS status_data TEXT;

-- 3. Migra dados existentes de projetos_responsaveis para a nova coluna disciplinas
UPDATE public.projetos p
SET disciplinas = (
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'disciplina', pr.disciplina,
      'responsavel_id', pr.pessoa_id,
      'responsavel_nome', pes.nome
    )
  ), '[]'::jsonb)
  FROM public.projetos_responsaveis pr
  LEFT JOIN public.pessoas pes ON pes.id = pr.pessoa_id
  WHERE pr.projeto_id = p.id
)
WHERE EXISTS (
  SELECT 1 FROM public.projetos_responsaveis pr WHERE pr.projeto_id = p.id
);

-- 4. Atualiza a função create_projeto_completo para usar a nova coluna disciplinas
CREATE OR REPLACE FUNCTION public.create_projeto_completo(
  p_codigo TEXT,
  p_nome TEXT,
  p_cliente_id UUID,
  p_data_inicio DATE,
  p_data_previsao DATE,
  p_data_final DATE,
  p_valor_contrato DECIMAL,
  p_observacao TEXT,
  p_localizacao TEXT,
  p_parcelas TEXT,
  p_area_m2 NUMERIC,
  p_disciplinas JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_projeto_id UUID;
  v_empresa_id UUID;
BEGIN
  -- Get empresa_id from current user
  v_empresa_id := public.get_user_empresa_id();
  
  -- Insert Projeto com disciplinas
  INSERT INTO public.projetos (
    empresa_id, codigo_projeto, nome, cliente_id, data_inicio, data_previsao, data_final, 
    valor_contrato, observacao, localizacao, parcelas, area_m2, disciplinas, status
  ) VALUES (
    v_empresa_id, p_codigo, p_nome, p_cliente_id, p_data_inicio, p_data_previsao, p_data_final, 
    p_valor_contrato, p_observacao, p_localizacao, p_parcelas, p_area_m2, 
    COALESCE(p_disciplinas, '[]'::jsonb), 'Planejamento'
  )
  RETURNING id INTO v_projeto_id;

  RETURN v_projeto_id;
END;
$$;

-- 5. Cria função para atualizar projeto completo (para edição)
CREATE OR REPLACE FUNCTION public.update_projeto_completo(
  p_projeto_id UUID,
  p_codigo TEXT,
  p_nome TEXT,
  p_cliente_id UUID,
  p_data_inicio DATE,
  p_data_previsao DATE,
  p_data_final DATE,
  p_valor_contrato DECIMAL,
  p_observacao TEXT,
  p_localizacao TEXT,
  p_parcelas TEXT,
  p_area_m2 NUMERIC,
  p_disciplinas JSONB,
  p_status TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_empresa_id UUID;
BEGIN
  -- Get empresa_id from current user
  v_empresa_id := public.get_user_empresa_id();
  
  -- Update Projeto
  UPDATE public.projetos
  SET 
    codigo_projeto = p_codigo,
    nome = p_nome,
    cliente_id = p_cliente_id,
    data_inicio = p_data_inicio,
    data_previsao = p_data_previsao,
    data_final = p_data_final,
    valor_contrato = p_valor_contrato,
    observacao = p_observacao,
    localizacao = p_localizacao,
    parcelas = p_parcelas,
    area_m2 = p_area_m2,
    disciplinas = COALESCE(p_disciplinas, '[]'::jsonb),
    status = p_status::status_projeto,
    updated_at = NOW()
  WHERE id = p_projeto_id 
    AND empresa_id = v_empresa_id;

  RETURN FOUND;
END;
$$;

-- 6. Cria função para calcular status_data automaticamente
CREATE OR REPLACE FUNCTION public.calculate_status_data()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Se projeto está concluído, verifica se foi no prazo ou com atraso
  IF NEW.status = 'Concluído' AND NEW.data_final IS NOT NULL AND NEW.data_previsao IS NOT NULL THEN
    IF NEW.data_final <= NEW.data_previsao THEN
      NEW.status_data := 'concluido_no_prazo';
    ELSE
      NEW.status_data := 'concluido_com_atraso';
    END IF;
  -- Se projeto está cancelado
  ELSIF NEW.status = 'Cancelado' THEN
    NEW.status_data := 'cancelado';
  -- Se projeto tem data de previsão
  ELSIF NEW.data_previsao IS NOT NULL THEN
    DECLARE
      dias_diferenca INTEGER;
    BEGIN
      dias_diferenca := NEW.data_previsao - CURRENT_DATE;
      
      IF dias_diferenca < 0 THEN
        NEW.status_data := 'em_atraso';
      ELSIF dias_diferenca <= 7 THEN
        NEW.status_data := 'atencao';
      ELSE
        NEW.status_data := 'no_prazo';
      END IF;
    END;
  ELSE
    NEW.status_data := NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 7. Cria trigger para atualizar status_data automaticamente
DROP TRIGGER IF EXISTS tr_calculate_status_data ON public.projetos;
CREATE TRIGGER tr_calculate_status_data
  BEFORE INSERT OR UPDATE ON public.projetos
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_status_data();
```

---

## ✅ Após executar o SQL:

1. Verifique se não houve erros
2. Recarregue a página do seu aplicativo
3. Teste criar um novo projeto
4. Teste editar um projeto existente
5. Teste mover cards entre colunas (drag and drop) ⭐ **CORRIGIDO**
6. Verifique se as datas estão mostrando corretamente ⭐ **CORRIGIDO**
7. Teste a lógica de status_data ao concluir projetos ⭐ **NOVO**

## 📝 Notas:

- A tabela `projetos_responsaveis` ainda existe mas não é mais usada
- Você pode removê-la manualmente depois se quiser com: `DROP TABLE IF EXISTS public.projetos_responsaveis;`
- Todos os dados foram migrados para a coluna `disciplinas` em formato JSON
- O `status_data` é calculado automaticamente por um trigger sempre que o projeto é criado ou atualizado
- As datas agora são formatadas corretamente sem o problema de timezone

## 🆕 Correções Aplicadas:

1. **Drag and Drop**: Adicionado verificação de permissão e melhor tratamento de erros
2. **Status Data**: Implementado trigger automático que calcula:
   - `concluido_no_prazo`: Se data final ≤ data previsão
   - `concluido_com_atraso`: Se data final > data previsão
   - `em_atraso`: Se data previsão < hoje
   - `atencao`: Se faltam ≤ 7 dias
   - `no_prazo`: Se faltam > 7 dias
3. **Datas**: Corrigido problema de timezone adicionando 'T00:00:00' ao criar Date objects
