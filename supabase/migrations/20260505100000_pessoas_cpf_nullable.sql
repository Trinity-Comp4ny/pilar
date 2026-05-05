-- CPF e telefone são opcionais na UI mas tinham NOT NULL no schema original.
-- A constraint UNIQUE permanece: Postgres permite múltiplos NULLs em coluna UNIQUE.
ALTER TABLE pessoas
  ALTER COLUMN cpf      DROP NOT NULL;

ALTER TABLE pessoas
  ALTER COLUMN telefone DROP NOT NULL;
