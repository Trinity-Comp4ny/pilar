-- Spec 017: importação de extrato/fatura por arquivo.
-- Rastreio de origem da importação em despesas/receitas, para:
--   (a) desfazer um lote inteiro (import_batch_id)
--   (b) detectar duplicata entre uploads (import_line_hash = hash de data+valor+descricao)
-- Ambas as tabelas já têm RLS por empresa_id; colunas novas herdam a policy existente.

alter table public.despesas
  add column if not exists import_batch_id uuid,
  add column if not exists import_line_hash text;

alter table public.receitas
  add column if not exists import_batch_id uuid,
  add column if not exists import_line_hash text;

-- Índices parciais: só as linhas importadas entram (barato, não pesa nos inserts manuais).
create index if not exists idx_despesas_import_batch
  on public.despesas (import_batch_id) where import_batch_id is not null;
create index if not exists idx_receitas_import_batch
  on public.receitas (import_batch_id) where import_batch_id is not null;

create index if not exists idx_despesas_import_hash
  on public.despesas (empresa_id, import_line_hash) where import_line_hash is not null;
create index if not exists idx_receitas_import_hash
  on public.receitas (empresa_id, import_line_hash) where import_line_hash is not null;

comment on column public.despesas.import_batch_id is 'Spec 017: id do lote de importação (permite desfazer). Null = lançamento manual.';
comment on column public.despesas.import_line_hash is 'Spec 017: hash estável de data+valor+descrição da linha importada (dedupe).';
comment on column public.receitas.import_batch_id is 'Spec 017: id do lote de importação (permite desfazer). Null = lançamento manual.';
comment on column public.receitas.import_line_hash is 'Spec 017: hash estável de data+valor+descrição da linha importada (dedupe).';
