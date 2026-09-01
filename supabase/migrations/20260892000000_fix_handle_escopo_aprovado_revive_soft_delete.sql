-- Fix: handle_escopo_aprovado() soma valor numa linha soft-deletada de
-- projeto_orcamento_fases quando ela colide com o ON CONFLICT (projeto_id, disciplina).
--
-- Achado durante a verificação manual da spec 084 (aba Pendências de /agentes):
-- projeto_orcamento_fases tem UNIQUE(projeto_id, disciplina) SEM particionar por
-- deleted_at (não é um índice parcial). O trigger, ao aprovar um aditivo, faz
-- INSERT ... ON CONFLICT (projeto_id, disciplina) DO UPDATE — se a linha que colide
-- já estiver soft-deletada (ex.: apagada manualmente, ou por um fluxo futuro de
-- "remover disciplina do orçamento"), o UPDATE soma horas/valor nela mesmo assim,
-- SEM tirar o deleted_at. O valor aprovado fica pra sempre invisível: toda leitura
-- do app filtra `deleted_at IS NULL` (useOrcamentoFases, rpc_dashboard_rentabilidade,
-- projetos_com_escopo_estourado), então o aditivo "some" do orçamento vivo mesmo
-- aprovado — reproduzido de verdade em ambiente local, não é só leitura de código.
--
-- Por que não virar índice parcial (WHERE deleted_at IS NULL) em vez de consertar o
-- trigger: o upsert manual de orçamento (spec 083, useSalvarOrcamentoFase) usa
-- `.upsert(..., {onConflict: "projeto_id,disciplina"})`, que gera um ON CONFLICT SEM
-- cláusula WHERE — Postgres só resolve isso contra um índice único CHEIO, não um
-- parcial. Trocar pra índice parcial quebraria esse upsert. Mais barato e mais
-- seguro corrigir só o trigger: quando a linha que colide está soft-deletada, revive
-- ela do zero (deleted_at=NULL, valores = só o item do aditivo, não soma) em vez de
-- empilhar em cima de dado morto. Quando a linha está viva, comportamento IDÊNTICO
-- ao de antes (soma horas/valor_venda, custo_hora não muda — mesma limitação
-- pré-existente, fora do escopo deste fix).
CREATE OR REPLACE FUNCTION "public"."handle_escopo_aprovado"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_item RECORD;
  v_empresa_id UUID;
BEGIN
  -- Só executa quando status muda para 'aprovado' e tipo é 'aditivo'
  IF NEW.status = 'aprovado' AND NEW.tipo = 'aditivo'
     AND (OLD.status IS DISTINCT FROM 'aprovado') THEN

    v_empresa_id := NEW.empresa_id;

    -- Para cada item do escopo, upsert no orçamento
    FOR v_item IN
      SELECT disciplina, horas, custo
      FROM escopo_itens
      WHERE escopo_id = NEW.id
    LOOP
      INSERT INTO projeto_orcamento_fases (
        empresa_id, projeto_id, disciplina, horas_estimadas, custo_hora, valor_venda
      ) VALUES (
        v_empresa_id, NEW.projeto_id, v_item.disciplina,
        COALESCE(v_item.horas, 0),
        CASE WHEN v_item.horas > 0 THEN COALESCE(v_item.custo, 0) / v_item.horas ELSE 0 END,
        COALESCE(v_item.custo, 0) * 1.3 -- margem 30% sobre custo
      )
      ON CONFLICT (projeto_id, disciplina) DO UPDATE SET
        deleted_at = NULL,
        horas_estimadas = CASE
          WHEN projeto_orcamento_fases.deleted_at IS NOT NULL THEN COALESCE(v_item.horas, 0)
          ELSE projeto_orcamento_fases.horas_estimadas + COALESCE(v_item.horas, 0)
        END,
        custo_hora = CASE
          WHEN projeto_orcamento_fases.deleted_at IS NOT NULL
            THEN (CASE WHEN v_item.horas > 0 THEN COALESCE(v_item.custo, 0) / v_item.horas ELSE 0 END)
          ELSE projeto_orcamento_fases.custo_hora
        END,
        valor_venda = CASE
          WHEN projeto_orcamento_fases.deleted_at IS NOT NULL THEN COALESCE(v_item.custo, 0) * 1.3
          ELSE projeto_orcamento_fases.valor_venda + (COALESCE(v_item.custo, 0) * 1.3)
        END,
        updated_at = NOW();
    END LOOP;

    -- Atualizar valor_contrato do projeto
    IF NEW.valor_aditivo IS NOT NULL AND NEW.valor_aditivo > 0 THEN
      UPDATE projetos
      SET valor_contrato = COALESCE(valor_contrato, 0) + NEW.valor_aditivo,
          updated_at = NOW()
      WHERE id = NEW.projeto_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
