-- Adiciona coluna explícita tipo_pessoa (PF/PJ) na tabela clientes.
--
-- Antes o tipo de pessoa era inferido pelo tamanho do documento e sumia quando o
-- cpf_cnpj ficava vazio, deixando o formulário sem como esconder Sobrenome para
-- pessoa jurídica ou ajustar os rótulos. Coluna aditiva e não-destrutiva: nada
-- é removido e registros antigos continuam válidos.

BEGIN;

ALTER TABLE "public"."clientes"
  ADD COLUMN IF NOT EXISTS "tipo_pessoa" "text";

-- Só aceita PF, PJ ou NULL (cliente sem tipo definido).
ALTER TABLE "public"."clientes"
  DROP CONSTRAINT IF EXISTS "clientes_tipo_pessoa_check";
ALTER TABLE "public"."clientes"
  ADD CONSTRAINT "clientes_tipo_pessoa_check"
  CHECK ("tipo_pessoa" IS NULL OR "tipo_pessoa" IN ('PF', 'PJ'));

-- Backfill: infere o tipo pelos registros existentes.
--   14 dígitos -> PJ, 11 dígitos -> PF.
--   Sem documento, mas com sobrenome -> PF (comportamento antigo do form).
UPDATE "public"."clientes"
SET "tipo_pessoa" = CASE
    WHEN length(regexp_replace(coalesce("cpf_cnpj", ''), '\D', '', 'g')) = 14 THEN 'PJ'
    WHEN length(regexp_replace(coalesce("cpf_cnpj", ''), '\D', '', 'g')) = 11 THEN 'PF'
    WHEN "sobrenome" IS NOT NULL AND btrim("sobrenome") <> '' THEN 'PF'
    ELSE NULL
  END
WHERE "tipo_pessoa" IS NULL;

COMMIT;
