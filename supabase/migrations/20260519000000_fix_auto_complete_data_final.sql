-- Fix: trigger auto_complete_disciplinas usa CURRENT_DATE como default
-- de NEW.data_final, gerando "Concluído com Atraso" falso quando o
-- projeto é marcado como Concluído administrativamente depois da entrega.
--
-- Correção: usar MAX(data_fim_real) das disciplinas relacionais quando
-- disponível; cair para CURRENT_DATE só se não houver disciplinas concluídas.

CREATE OR REPLACE FUNCTION public.auto_complete_disciplinas() RETURNS trigger
  LANGUAGE plpgsql
AS $$
DECLARE
  disciplina JSONB;
  updated_disciplinas JSONB := '[]'::jsonb;
  v_max_data_fim DATE;
BEGIN
  IF NEW.status = 'Concluído' AND (OLD.status IS NULL OR OLD.status != 'Concluído') THEN
    -- Atualiza JSONB legado (mantém compatibilidade)
    IF NEW.disciplinas IS NOT NULL AND jsonb_array_length(NEW.disciplinas) > 0 THEN
      FOR disciplina IN SELECT * FROM jsonb_array_elements(NEW.disciplinas)
      LOOP
        updated_disciplinas := updated_disciplinas || jsonb_build_array(
          disciplina || jsonb_build_object(
            'status', 'Concluído',
            'data_final', COALESCE(disciplina->>'data_final', to_char(CURRENT_DATE, 'YYYY-MM-DD'))
          )
        );
      END LOOP;
      NEW.disciplinas := updated_disciplinas;
    END IF;

    -- Preenche data_final só se vier NULL.
    -- Prioriza a maior data_fim_real das disciplinas relacionais —
    -- reflete a entrega real, não o momento administrativo do toggle.
    IF NEW.data_final IS NULL THEN
      SELECT MAX(data_fim_real) INTO v_max_data_fim
      FROM public.projeto_disciplinas
      WHERE projeto_id = NEW.id
        AND data_fim_real IS NOT NULL;

      NEW.data_final := COALESCE(v_max_data_fim, CURRENT_DATE);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
