-- ============================================================================
-- Migration: adiciona valor 'ultra_admin' ao enum user_role
-- ----------------------------------------------------------------------------
-- ultra_admin é o papel cross-empresa (gestores Pilar). Pode ler/editar
-- qualquer empresa. Concedido EXCLUSIVAMENTE via SQL direto — nenhuma UI
-- (nem company admin) pode promover alguém a ultra_admin.
--
-- Migration separada porque PostgreSQL não permite usar um novo valor de
-- enum dentro da mesma transação em que ele foi criado. Migrations seguintes
-- (incluindo 20260425000001) podem usar 'ultra_admin' livremente.
-- ============================================================================

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'ultra_admin' BEFORE 'admin';
