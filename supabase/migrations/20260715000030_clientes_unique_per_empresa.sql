-- Corrige multi-tenancy dos clientes.
--
-- O schema base (000_base_schema.sql) criou UNIQUE GLOBAL em cpf_cnpj, email e
-- contato (telefone). Isso fura o isolamento entre empresas: o erro 23505 vazava
-- que outro tenant já tinha aquele documento/e-mail/telefone. Além disso, a
-- constraint por empresa existente (clientes_unique_empresa_cpf_cnpj) não
-- considerava soft delete, então excluir e recadastrar o mesmo cliente falhava.
--
-- Solução: remover as constraints globais e a antiga por empresa, e recriar como
-- índices únicos PARCIAIS por empresa, válidos só para registros ativos
-- (deleted_at IS NULL).

BEGIN;

-- Remove os UNIQUE globais herdados do schema base.
ALTER TABLE "public"."clientes" DROP CONSTRAINT IF EXISTS "clientes_cpf_cnpj_key";
ALTER TABLE "public"."clientes" DROP CONSTRAINT IF EXISTS "clientes_email_key";
ALTER TABLE "public"."clientes" DROP CONSTRAINT IF EXISTS "clientes_contato_key";

-- Remove a antiga unicidade por empresa (não respeitava soft delete).
ALTER TABLE "public"."clientes" DROP CONSTRAINT IF EXISTS "clientes_unique_empresa_cpf_cnpj";

-- Unicidade por empresa, apenas entre clientes ativos.
-- cpf_cnpj é opcional: valores NULL não entram no índice, então clientes sem
-- documento não colidem entre si.
CREATE UNIQUE INDEX IF NOT EXISTS "clientes_empresa_cpf_cnpj_uidx"
    ON "public"."clientes" ("empresa_id", "cpf_cnpj")
    WHERE "deleted_at" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "clientes_empresa_email_uidx"
    ON "public"."clientes" ("empresa_id", "email")
    WHERE "deleted_at" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "clientes_empresa_contato_uidx"
    ON "public"."clientes" ("empresa_id", "contato")
    WHERE "deleted_at" IS NULL;

COMMIT;
