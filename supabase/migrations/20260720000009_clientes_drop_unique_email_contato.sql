-- ACH-CLI-03: a unicidade por empresa de email e telefone bloqueava cadastros
-- legítimos (cônjuges com o mesmo email, filiais com a mesma central de
-- telefone). O único identificador que deve ser único de fato é o CPF/CNPJ.
-- Removemos os índices únicos parciais de email e contato, mantendo o de
-- cpf_cnpj (clientes_empresa_cpf_cnpj_uidx) intacto.

DROP INDEX IF EXISTS public.clientes_empresa_email_uidx;
DROP INDEX IF EXISTS public.clientes_empresa_contato_uidx;
